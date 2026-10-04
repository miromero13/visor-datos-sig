using System.Data;
using Microsoft.Data.SqlClient;

namespace VisorDatosSig.Api;

public sealed record CodigoFijoSimulationResult(int Total, IReadOnlyDictionary<int, int> Counts, DateTimeOffset CompletedAt);

public sealed class CodigoFijoSimulationService(IConfiguration configuration)
{
    private static readonly int[] States = [1, 3, 2, 4, 5];
    private static readonly int[] Weights = [50, 20, 15, 10, 5];

    public async Task<CodigoFijoSimulationResult> SimulateAsync(CancellationToken cancellationToken)
    {
        var connectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Migration database connection is not configured.");
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            var ids = new List<int>();
            await using (var read = new SqlCommand("SELECT IdCodigo FROM dbo.CodigosFijos WITH (UPDLOCK, HOLDLOCK) ORDER BY IdCodigo", connection, transaction))
            await using (var reader = await read.ExecuteReaderAsync(cancellationToken))
                while (await reader.ReadAsync(cancellationToken)) ids.Add(reader.GetInt32(0));

            var counts = Allocate(ids.Count);
            var limits = new int[States.Length];
            for (var i = 0; i < States.Length; i++) limits[i] = (i == 0 ? 0 : limits[i - 1]) + counts[States[i]];
            // CompletedAt is UTC operation metadata; FechaCambioEstado follows the database's local SYSDATETIME() convention.
            var completedAt = DateTimeOffset.UtcNow;
            if (ids.Count > 0)
            {
                await using var update = new SqlCommand("""
                    ;WITH Ranked AS (
                        SELECT IdCodigo, ROW_NUMBER() OVER (ORDER BY IdCodigo) AS rn
                        FROM dbo.CodigosFijos WITH (UPDLOCK, HOLDLOCK)
                    )
                    UPDATE target SET Estado = CASE
                        WHEN ranked.rn <= @normal THEN @normalState
                        WHEN ranked.rn <= @cortado THEN @cortadoState
                        WHEN ranked.rn <= @paraCorte THEN @paraCorteState
                        WHEN ranked.rn <= @bajaParcial THEN @bajaParcialState
                        ELSE @bajaTotalState END,
                        FechaCambioEstado = SYSDATETIME()
                    FROM dbo.CodigosFijos AS target JOIN Ranked AS ranked ON ranked.IdCodigo = target.IdCodigo;
                    """, connection, transaction);
                update.Parameters.Add("@normal", SqlDbType.Int).Value = limits[0];
                update.Parameters.Add("@cortado", SqlDbType.Int).Value = limits[1];
                update.Parameters.Add("@paraCorte", SqlDbType.Int).Value = limits[2];
                update.Parameters.Add("@bajaParcial", SqlDbType.Int).Value = limits[3];
                for (var i = 0; i < States.Length; i++) update.Parameters.Add($"@{new[] { "normalState", "cortadoState", "paraCorteState", "bajaParcialState", "bajaTotalState" }[i]}", SqlDbType.Int).Value = States[i];
                await update.ExecuteNonQueryAsync(cancellationToken);
            }
            await transaction.CommitAsync(cancellationToken);
            return new(ids.Count, counts, completedAt);
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
    }

    private static IReadOnlyDictionary<int, int> Allocate(int total)
    {
        var counts = States.ToDictionary(state => state, _ => 0);
        if (total == 0) return counts;
        var remaining = total;
        if (total >= States.Length)
        {
            foreach (var state in States) counts[state] = 1;
            remaining -= States.Length;
        }

        // Largest-remainder apportionment; ties follow the specified state order.
        var floors = new int[States.Length];
        var fractions = new double[States.Length];
        for (var i = 0; i < States.Length; i++)
        {
            var quota = (double)remaining * Weights[i] / Weights.Sum();
            floors[i] = (int)Math.Floor(quota);
            fractions[i] = quota - floors[i];
            counts[States[i]] += floors[i];
        }
        var leftovers = remaining - floors.Sum();
        foreach (var index in Enumerable.Range(0, States.Length).OrderByDescending(i => fractions[i]).ThenBy(i => i).Take(leftovers))
            counts[States[index]]++;
        return counts;
    }
}
