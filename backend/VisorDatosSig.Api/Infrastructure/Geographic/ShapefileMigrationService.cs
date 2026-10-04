using System.Data;
using System.Globalization;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Http;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;

namespace VisorDatosSig.Api;

public sealed record MigrationLayerPreview(string Layer, string Table, int Records, string SourceCrs, IReadOnlyList<string> MappedFields);
public sealed record MigrationValidationResult(bool Valid, IReadOnlyList<MigrationLayerPreview> Layers, IReadOnlyList<string> Errors);
public sealed record MigrationExecutionResult(string Mode, DateTimeOffset CompletedAt, IReadOnlyList<MigrationLayerResult> Layers, MigrationProgress Progress);
public sealed record MigrationLayerResult(string Layer, string Table, int Inserted);
public sealed record MigrationProgress(string Phase, int CompletedLayers, int TotalLayers, int ProcessedRecords, int TotalRecords);

public sealed class ShapefileMigrationService(IConfiguration configuration, ILogger<ShapefileMigrationService> logger)
{
    private static readonly System.Text.RegularExpressions.Regex WktDimensionMarker = new(
        @"\b(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s+(?:ZM|Z|M)\b",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.CultureInvariant);
    public const long MaxFileBytes = 256 * 1024 * 1024;
    public const int MaxRecordsPerLayer = 250_000;
    private static readonly IReadOnlyDictionary<string, LayerDefinition> Definitions = new Dictionary<string, LayerDefinition>(StringComparer.OrdinalIgnoreCase)
    {
        ["Exp_CodigoFijo_4326"] = new("CodigosFijos", ["CodF_SQL", "CodF_SIG", "Longitud", "Latitud", "CodFijo", "Nombre"], ["CodF_SQL", "CodF_SIG", "Longi", "Latid", "CodFijo", "Nombre"]),
        ["Exp_MapaBase_LOTES_4326"] = new("Lotes", ["IdOrigen", "NroLote"], ["Id", "NroLote"]),
        ["Exp_MapaBase_MZA_4326"] = new("Manzanas", ["IdOrigen", "UV_MZA", "UV", "MZA"], ["Id", "UV_MZA", "UV", "MZA"]),
        ["Exp_MapaBase_VIAS_4326"] = new("Vias", ["OBJECTID", "Nombre", "TipoVia", "OSMID"], ["OBJECTID", "Nombre", "type", "OSMID"])
    };

    public async Task<MigrationValidationResult> ValidateAsync(IFormFileCollection files, CancellationToken cancellationToken)
    {
        var errors = new List<string>();
        var previews = new List<MigrationLayerPreview>();
        using var upload = await SaveFilesAsync(files, errors, cancellationToken);
        foreach (var group in upload.Groups)
        {
            if (!Definitions.TryGetValue(group.Key, out var definition)) { errors.Add("A supplied layer is not allowed."); continue; }
            var missing = new[] { ".shp", ".shx", ".dbf", ".prj" }.Where(ext => !group.Value.ContainsKey(ext)).ToArray();
            if (missing.Length != 0) { errors.Add($"Layer {group.Key} is missing required components: {string.Join(", ", missing)}."); continue; }
            try
            {
                var sourceCrs = DetectSourceCrs(group.Value[".prj"]);
                var records = ReadFeatures(group.Value[".shp"], group.Value[".dbf"], definition, null, cancellationToken);
                previews.Add(new(group.Key, definition.Table, records.Count, sourceCrs, definition.SourceFields));
            }
            catch (Exception ex) when (ex is not OperationCanceledException) { errors.Add($"Layer {group.Key} could not be validated: {SafeMessage(ex)}"); }
        }
        if (previews.Count == 0 && errors.Count == 0) errors.Add("No recognized Shapefile layers were supplied.");
        return new(errors.Count == 0, previews, errors);
    }

    public async Task<MigrationExecutionResult> ExecuteAsync(IFormFileCollection files, string mode, int? userId, CancellationToken cancellationToken)
    {
        if (mode is not ("replace" or "append")) throw new ArgumentException("Mode must be replace or append.");
        var validation = await ValidateAsync(files, cancellationToken);
        if (!validation.Valid) throw new InvalidDataException(string.Join(" ", validation.Errors));
        using var upload = await SaveFilesAsync(files, [], cancellationToken);
        var layers = validation.Layers;
        var connectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(connectionString)) throw new InvalidOperationException("Migration database connection is not configured.");
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);
        var results = new List<MigrationLayerResult>();
        var total = layers.Sum(x => x.Records);
        try
        {
            if (mode == "replace")
            {
                var selectedTables = layers.Select(layer => Definitions[layer.Layer].Table).ToHashSet(StringComparer.OrdinalIgnoreCase);
                if (selectedTables.Contains("Manzanas"))
                    await ExecuteSqlAsync("UPDATE dbo.Lotes SET IdManzana = NULL", connection, transaction, cancellationToken);
                if (selectedTables.Contains("Lotes"))
                    await ExecuteSqlAsync("UPDATE dbo.CodigosFijos SET IdLote = NULL", connection, transaction, cancellationToken);

                foreach (var table in new[] { "CodigosFijos", "Lotes", "Manzanas", "Vias" })
                {
                    if (selectedTables.Contains(table))
                        await ExecuteSqlAsync($"DELETE FROM dbo.{table}", connection, transaction, cancellationToken);
                }
            }
            foreach (var preview in layers)
            {
                var definition = Definitions[preview.Layer];
                var group = upload.Groups[preview.Layer];
                var transform = preview.SourceCrs == "EPSG:32720" ? CreateTransform() : null;
                var features = ReadFeatures(group[".shp"], group[".dbf"], definition, transform, cancellationToken);
                logger.LogInformation("Shapefile migration layer staging started. Layer={Layer}; Records={RecordCount}", preview.Layer, features.Count);
                var inserted = await BulkInsertLayerAsync(connection, transaction, definition, features, preview.Layer, logger, cancellationToken);
                logger.LogInformation("Shapefile migration layer inserted. Layer={Layer}; Records={RecordCount}", preview.Layer, inserted);
                results.Add(new(preview.Layer, definition.Table, inserted));
            }
            await transaction.CommitAsync(cancellationToken);
            logger.LogInformation("Shapefile migration completed. UserId={UserId}; Mode={Mode}; Layers={LayerCount}; Records={RecordCount}", userId, mode, results.Count, total);
            return new(mode, DateTimeOffset.UtcNow, results, new("completed", results.Count, layers.Count, total, total));
        }
        catch { await transaction.RollbackAsync(CancellationToken.None); throw; }
    }

    private static async Task ExecuteSqlAsync(string sql, SqlConnection connection, SqlTransaction transaction, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(sql, connection, transaction);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private const int BulkBatchSize = 1000;

    private static async Task<int> BulkInsertLayerAsync(SqlConnection connection, SqlTransaction transaction, LayerDefinition layer, IReadOnlyList<Feature> features, string layerName, ILogger logger, CancellationToken cancellationToken)
    {
        // Both identifiers originate exclusively in Definitions, the fixed layer allowlist.
        var stagingTable = "#Migration_" + layer.Table;
        var stagingColumns = layer.StagingColumns;
        await ExecuteSqlAsync($"CREATE TABLE {stagingTable} ({string.Join(",", stagingColumns.Select(column => $"[{column.Name}] {column.SqlType} NULL"))}, [Wkt] nvarchar(max) NOT NULL)", connection, transaction, cancellationToken);
        try
        {
            for (var offset = 0; offset < features.Count; offset += BulkBatchSize)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var count = Math.Min(BulkBatchSize, features.Count - offset);
                var batch = new DataTable();
                foreach (var column in stagingColumns) batch.Columns.Add(column.Name, column.DataType);
                batch.Columns.Add("Wkt", typeof(string));
                for (var index = offset; index < offset + count; index++)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var feature = features[index];
                    var row = batch.NewRow();
                    double? canonicalLongitude = null;
                    double? canonicalLatitude = null;
                    if (layer.Table == "CodigosFijos")
                    {
                        if (feature.Geometry is not Point point)
                            throw new InvalidDataException("CodigosFijos features must have point geometry to derive coordinate attributes.");
                        if (!double.IsFinite(point.X) || !double.IsFinite(point.Y))
                            throw new InvalidDataException("CodigosFijos point geometry must have finite X and Y coordinates.");
                        canonicalLongitude = point.X;
                        canonicalLatitude = point.Y;
                    }
                    for (var field = 0; field < layer.SourceFields.Length; field++)
                    {
                        object? value = layer.SourceFields[field] switch
                        {
                            "Longi" when layer.Table == "CodigosFijos" => canonicalLongitude,
                            "Latid" when layer.Table == "CodigosFijos" => canonicalLatitude,
                            _ => feature.Attributes[layer.SourceFields[field]]
                        };
                        if (layer.Table == "Vias" && layer.SourceFields[field] == "OSMID" && value is not null) value = Convert.ToString(value, CultureInfo.InvariantCulture);
                        if (layer.SourceFields[field] is "Longi" or "Latid" && value is not null) value = Convert.ToDouble(value, CultureInfo.InvariantCulture);
                        if (value is not null && layer.StagingColumns[field].DataType != typeof(string))
                            value = Convert.ChangeType(value, layer.StagingColumns[field].DataType, CultureInfo.InvariantCulture);
                        row[field] = value ?? DBNull.Value;
                    }
                    var (dimension, _) = GetWktDimensions(feature.Geometry);
                    var wkt = WktDimensionMarker.Replace(new WKTWriter(dimension).Write(feature.Geometry), "$1");
                    if (wkt.Contains("NaN", StringComparison.OrdinalIgnoreCase) || wkt.Contains("Infinity", StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Geometry contains unsupported or missing coordinate values; all Shapefile ordinates must be preserved.");
                    row["Wkt"] = wkt;
                    batch.Rows.Add(row);
                }
                using var bulkCopy = new SqlBulkCopy(connection, SqlBulkCopyOptions.Default, transaction) { DestinationTableName = stagingTable, BatchSize = BulkBatchSize };
                foreach (DataColumn column in batch.Columns) bulkCopy.ColumnMappings.Add(column.ColumnName, column.ColumnName);
                await bulkCopy.WriteToServerAsync(batch, cancellationToken);
                var batchNumber = offset / BulkBatchSize + 1;
                var processedRecords = offset + count;
                logger.LogInformation("Shapefile migration bulk batch loaded. Layer={Layer}; BatchNumber={BatchNumber}; ProcessedRecords={ProcessedRecords}; TotalRecords={TotalRecords}", layerName, batchNumber, processedRecords, features.Count);
            }
            var columns = string.Join(",", layer.Columns.Select(column => $"[{column}]"));
            logger.LogInformation("Shapefile migration geometry insert started. Layer={Layer}; Records={RecordCount}", layerName, features.Count);
            await ExecuteSqlAsync($"INSERT dbo.{layer.Table} ({columns},[Geom]) SELECT {columns},geometry::STGeomFromText([Wkt],4326) FROM {stagingTable}", connection, transaction, cancellationToken);
            logger.LogInformation("Shapefile migration geometry insert completed. Layer={Layer}; Records={RecordCount}", layerName, features.Count);
            return features.Count;
        }
        finally
        {
            await ExecuteSqlAsync($"DROP TABLE IF EXISTS {stagingTable}", connection, transaction, CancellationToken.None);
        }
    }

    private static (int Dimension, Ordinates Ordinates) GetWktDimensions(Geometry geometry)
    {
        var ordinates = Ordinates.XY;
        geometry.Apply(new OrdinatesFilter(sequence => ordinates |= sequence.Ordinates & (Ordinates.Z | Ordinates.M)));
        var hasZ = (ordinates & Ordinates.Z) != 0;
        var hasM = (ordinates & Ordinates.M) != 0;
        var dimension = hasZ && hasM ? 4 : hasZ || hasM ? 3 : 2;
        var required = Ordinates.XY | (hasZ ? Ordinates.Z : 0) | (hasM ? Ordinates.M : 0);

        geometry.Apply(new CoordinateValuesFilter(sequence =>
        {
            if ((sequence.Ordinates & required) != required)
                throw new InvalidDataException("Geometry contains unsupported or missing coordinate dimensions; all Shapefile ordinates must be preserved.");
            for (var index = 0; index < sequence.Count; index++)
            {
                foreach (var ordinate in new[] { Ordinates.X, Ordinates.Y, Ordinates.Z, Ordinates.M })
                {
                    if ((required & ordinate) == 0) continue;
                    var value = sequence.GetOrdinate(index, (int)Math.Log2((int)ordinate));
                    if (!double.IsFinite(value))
                        throw new InvalidDataException("Geometry contains unsupported or missing coordinate values; all Shapefile ordinates must be preserved.");
                }
            }
        }));
        return (dimension, required);
    }

    private sealed class OrdinatesFilter(Action<CoordinateSequence> action) : ICoordinateSequenceFilter
    {
        public bool Done => false;
        public bool GeometryChanged => false;
        public void Filter(CoordinateSequence sequence, int index) { if (index == 0) action(sequence); }
    }

    private sealed class CoordinateValuesFilter(Action<CoordinateSequence> action) : ICoordinateSequenceFilter
    {
        public bool Done => false;
        public bool GeometryChanged => false;
        public void Filter(CoordinateSequence sequence, int index) { if (index == 0) action(sequence); }
    }

    private static List<Feature> ReadFeatures(string shp, string dbf, LayerDefinition definition, MathTransform? transform, CancellationToken cancellationToken)
    {
        using var reader = new ShapefileDataReader(shp, new GeometryFactory());
        var fieldIndexes = definition.SourceFields.Select(name => (name, index: FindField(reader, name))).ToDictionary(x => x.name, x => x.index, StringComparer.OrdinalIgnoreCase);
        var result = new List<Feature>();
        while (reader.Read())
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (result.Count >= MaxRecordsPerLayer) throw new InvalidDataException("Layer exceeds the maximum record count.");
            var geometry = reader.Geometry;
            if (geometry is null || geometry.IsEmpty) throw new InvalidDataException("Empty geometry records are not supported.");
            if (transform is not null) geometry = TransformGeometry(geometry, transform);
            var attributes = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
            foreach (var field in fieldIndexes) attributes[field.Key] = reader.GetValue(field.Value) is DBNull ? null : reader.GetValue(field.Value);
            result.Add(new(geometry, attributes));
        }
        return result;
    }

    private static int FindField(ShapefileDataReader reader, string name)
    {
        for (var i = 0; i < reader.FieldCount; i++) if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase)) return i;
        throw new InvalidDataException("A required mapped DBF field is missing.");
    }

    private static string DetectSourceCrs(string path)
    {
        var text = File.ReadAllText(path);
        var declaresUtm20 = text.Contains("32720", StringComparison.OrdinalIgnoreCase)
            || text.Contains("WGS_1984_UTM_Zone_20S", StringComparison.OrdinalIgnoreCase);
        var declaresGeographicWgs84 = text.Contains("GEOGCS", StringComparison.OrdinalIgnoreCase)
            && (text.Contains("GCS_WGS_1984", StringComparison.OrdinalIgnoreCase)
                || text.Contains("WGS_1984", StringComparison.OrdinalIgnoreCase))
            && (text.Contains("UNIT[\"Degree\"", StringComparison.OrdinalIgnoreCase)
                || text.Contains("UNIT[\"degree\"", StringComparison.OrdinalIgnoreCase));

        var isGeographicWgs84 = declaresGeographicWgs84;
        if (declaresUtm20 == isGeographicWgs84)
            throw new InvalidDataException("The PRJ is missing an unambiguous declaration of approved EPSG:4326 or EPSG:32720.");
        if (declaresUtm20) return "EPSG:32720";
        if (isGeographicWgs84) return "EPSG:4326";
        throw new InvalidDataException("The PRJ does not declare an approved EPSG:4326 or EPSG:32720 source CRS.");
    }

    private static MathTransform CreateTransform()
    {
        var factory = new CoordinateTransformationFactory();
        var source = ProjectedCoordinateSystem.WGS84_UTM(20, true);
        var target = GeographicCoordinateSystem.WGS84;
        return factory.CreateFromCoordinateSystems(source, target).MathTransform;
    }

    private static Geometry TransformGeometry(Geometry geometry, MathTransform transform)
    {
        var copy = (Geometry)geometry.Copy();
        copy.Apply(new CoordinateSequenceFilter(transform));
        copy.GeometryChanged();
        copy.SRID = 4326;
        return copy;
    }

    private static async Task<UploadSet> SaveFilesAsync(IFormFileCollection files, List<string> errors, CancellationToken cancellationToken)
    {
        var root = Path.Combine(Path.GetTempPath(), "visordatos-migrations", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        var groups = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
        try
        {
            if (files.Count > 16) errors.Add("Too many uploaded files.");
            foreach (var file in files)
            {
                if (file.Length == 0 || file.Length > MaxFileBytes) { errors.Add("An uploaded file is empty or exceeds the file size limit."); continue; }
                var name = Path.GetFileName(file.FileName.Replace('\\', '/'));
                var extension = Path.GetExtension(name).ToLowerInvariant();
                if (!new[] { ".shp", ".shx", ".dbf", ".prj" }.Contains(extension)) { errors.Add("Unsupported uploaded file type."); continue; }
                var layer = Path.GetFileNameWithoutExtension(name);
                if (!Definitions.ContainsKey(layer)) { errors.Add("An uploaded layer is not allowed."); continue; }
                if (!groups.TryGetValue(layer, out var components)) groups[layer] = components = new(StringComparer.OrdinalIgnoreCase);
                if (components.ContainsKey(extension)) { errors.Add("Duplicate layer component supplied."); continue; }
                var safeLayer = Path.GetFileName(layer);
                var path = Path.Combine(root, safeLayer + extension);
                await using (var output = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, true))
                {
                    await file.CopyToAsync(output, cancellationToken);
                }
                if (new FileInfo(path).Length > MaxFileBytes)
                {
                    File.Delete(path);
                    errors.Add("An uploaded file exceeds the file size limit.");
                    continue;
                }
                components.Add(extension, path);
            }
            return new UploadSet(root, groups);
        }
        catch { Directory.Delete(root, true); throw; }
    }

    private static string SafeMessage(Exception exception) => exception is InvalidDataException ? exception.Message : "The supplied Shapefile is malformed or unreadable.";
    private sealed record StagingColumn(string Name, string SqlType, Type DataType);
    private sealed record LayerDefinition(string Table, string[] Columns, string[] SourceFields)
    {
        public StagingColumn[] StagingColumns => Table switch
        {
            "CodigosFijos" => [new("CodF_SQL", "int", typeof(int)), new("CodF_SIG", "nvarchar(25)", typeof(string)), new("Longitud", "float", typeof(double)), new("Latitud", "float", typeof(double)), new("CodFijo", "int", typeof(int)), new("Nombre", "nvarchar(120)", typeof(string))],
            "Lotes" => [new("IdOrigen", "int", typeof(int)), new("NroLote", "nvarchar(15)", typeof(string))],
            "Manzanas" => [new("IdOrigen", "int", typeof(int)), new("UV_MZA", "nvarchar(20)", typeof(string)), new("UV", "nvarchar(15)", typeof(string)), new("MZA", "nvarchar(10)", typeof(string))],
            "Vias" => [new("OBJECTID", "int", typeof(int)), new("Nombre", "nvarchar(40)", typeof(string)), new("TipoVia", "nvarchar(30)", typeof(string)), new("OSMID", "nvarchar(20)", typeof(string))],
            _ => throw new InvalidOperationException("Layer is not allowlisted.")
        };
    }
    private sealed record Feature(Geometry Geometry, Dictionary<string, object?> Attributes);
    private sealed class UploadSet(string root, Dictionary<string, Dictionary<string, string>> groups) : IDisposable
    {
        public Dictionary<string, Dictionary<string, string>> Groups { get; } = groups;
        public void Dispose() { if (Directory.Exists(root)) Directory.Delete(root, true); }
    }
    private sealed class CoordinateSequenceFilter(MathTransform transform) : ICoordinateSequenceFilter
    {
        public bool Done => false;
        public bool GeometryChanged => true;
        public void Filter(CoordinateSequence sequence, int index)
        {
            var point = transform.Transform([sequence.GetX(index), sequence.GetY(index)]);
            sequence.SetOrdinate(index, 0, point[0]); sequence.SetOrdinate(index, 1, point[1]);
        }
    }
}
