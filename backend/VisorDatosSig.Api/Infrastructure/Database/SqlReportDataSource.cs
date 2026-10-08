using System.Data;
using System.Runtime.CompilerServices;
using Microsoft.Data.SqlClient;

namespace VisorDatosSig.Api;

/// <summary>
/// Builds parameterized SQL for custom reports. Table and column names come only from <see cref="ExportColumnCatalog"/>;
/// every user value travels as a typed <see cref="SqlParameter"/>.
/// </summary>
public static class ReportQueryBuilder
{
    public sealed record Query(string Table, string Where, string OrderBy, IReadOnlyList<SqlParameter> Parameters);

    public static Query Build(ValidatedReport report)
    {
        var layer = report.Layer;
        var clauses = new List<string> { "[Geom] IS NOT NULL" };
        var parameters = new List<SqlParameter>();
        string Add(SqlDbType type, object value, int? size = null)
        {
            var name = "@p" + parameters.Count;
            var parameter = size is null ? new SqlParameter(name, type) : new SqlParameter(name, type, size.Value);
            parameter.Value = value;
            if (type == SqlDbType.Decimal) { parameter.Precision = 38; parameter.Scale = 10; }
            parameters.Add(parameter);
            return name;
        }

        if (report.Q is { Length: > 0 } q)
        {
            // Same fields as the search screen (SearchQueryService), so a report finds what the user searched for.
            var name = Add(SqlDbType.NVarChar, $"%{EscapeLike(q)}%", 410);
            clauses.Add("(" + string.Join(" OR ", layer.SearchFields.Select(c => $"TRY_CONVERT(nvarchar(4000),[{c}]) LIKE {name} ESCAPE '\\'")) + ")");
        }

        foreach (var filter in report.Filters)
        {
            var column = $"[{filter.Column.Key}]";
            var kind = filter.Column.FilterKind;
            string Param(object value) => kind switch
            {
                ColumnKind.Integer => Add(SqlDbType.BigInt, value),
                ColumnKind.Decimal or ColumnKind.Coordinate or ColumnKind.Currency => Add(SqlDbType.Decimal, value),
                ColumnKind.Date => Add(SqlDbType.DateTime2, ((DateOnly)value).ToDateTime(TimeOnly.MinValue)),
                _ => Add(SqlDbType.NVarChar, value, 410)
            };
            // Dates compare by day: "until" includes the whole selected day.
            string EndOfRange(object value) => kind == ColumnKind.Date ? $"{column} < {Add(SqlDbType.DateTime2, ((DateOnly)value).AddDays(1).ToDateTime(TimeOnly.MinValue))}" : $"{column} <= {Param(value)}";
            clauses.Add(filter.Operator switch
            {
                FilterOperator.Contains => $"{column} LIKE {Add(SqlDbType.NVarChar, $"%{EscapeLike((string)filter.Values[0])}%", 410)} ESCAPE '\\'",
                FilterOperator.StartsWith => $"{column} LIKE {Add(SqlDbType.NVarChar, $"{EscapeLike((string)filter.Values[0])}%", 410)} ESCAPE '\\'",
                FilterOperator.Equals => $"{column} = {Param(filter.Values[0])}",
                FilterOperator.In => $"{column} IN ({string.Join(",", filter.Values.Select(Param))})",
                FilterOperator.Gte => $"{column} >= {Param(filter.Values[0])}",
                FilterOperator.Lte => EndOfRange(filter.Values[0]),
                _ => $"({column} >= {Param(filter.Values[0])} AND {EndOfRange(filter.Values[1])})"
            });
        }

        var order = new List<string>();
        var seenOrderColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (report.GroupBy is { } group && seenOrderColumns.Add(group.Key))
        {
            order.Add($"[{group.Key}] ASC");
        }

        foreach (var sort in report.Sort)
        {
            if (seenOrderColumns.Add(sort.Column.Key))
            {
                order.Add($"[{sort.Column.Key}] {(sort.Descending ? "DESC" : "ASC")}");
            }
        }

        if (seenOrderColumns.Add(layer.IdColumn))
        {
            order.Add($"[{layer.IdColumn}] ASC");
        }

        return new(layer.Table, string.Join(" AND ", clauses), string.Join(", ", order), parameters);
    }

    public static string EscapeLike(string value) => value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_").Replace("[", "\\[");
}

public sealed class SqlReportDataSource(IConfiguration configuration) : IReportDataSource
{
    private const int CommandTimeoutSeconds = 300;

    public async Task<long> CountAsync(ValidatedReport report, CancellationToken cancellationToken)
    {
        var query = ReportQueryBuilder.Build(report);
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = Command(connection, $"SELECT COUNT_BIG(*) FROM dbo.[{query.Table}] WHERE {query.Where}", query);
        return (long)(await command.ExecuteScalarAsync(cancellationToken) ?? 0L);
    }

    public async IAsyncEnumerable<object?[]> ReadRowsAsync(ValidatedReport report, int take, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var query = ReportQueryBuilder.Build(report);
        var select = string.Join(",", report.Columns.Select(c => $"[{c.Key}]"));
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = Command(connection, $"SELECT TOP (@take) {select} FROM dbo.[{query.Table}] WHERE {query.Where} ORDER BY {query.OrderBy}", query);
        command.Parameters.Add("@take", SqlDbType.Int).Value = take;
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SequentialAccess, cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var row = new object?[report.Columns.Count];
            for (var i = 0; i < row.Length; i++) row[i] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            yield return row;
        }
    }

    public async Task<IReadOnlyList<(object? Value, long Count)>> GroupCountsAsync(ValidatedReport report, int take, CancellationToken cancellationToken)
    {
        if (report.GroupBy is not { } group) return [];
        var query = ReportQueryBuilder.Build(report);
        await using var connection = await OpenAsync(cancellationToken);
        await using var command = Command(connection, $"SELECT TOP (@take) [{group.Key}], COUNT_BIG(*) FROM dbo.[{query.Table}] WHERE {query.Where} GROUP BY [{group.Key}] ORDER BY [{group.Key}]", query);
        command.Parameters.Add("@take", SqlDbType.Int).Value = take;
        var groups = new List<(object?, long)>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) groups.Add((reader.IsDBNull(0) ? null : reader.GetValue(0), reader.GetInt64(1)));
        return groups;
    }

    private static SqlCommand Command(SqlConnection connection, string sql, ReportQueryBuilder.Query query)
    {
        var command = new SqlCommand(sql, connection) { CommandTimeout = CommandTimeoutSeconds };
        // Parameters are cloned because a SqlParameter cannot belong to two commands.
        foreach (var parameter in query.Parameters) command.Parameters.Add(((ICloneable)parameter).Clone());
        return command;
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken cancellationToken)
    {
        var connectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Report database connection is not configured.");
        var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
