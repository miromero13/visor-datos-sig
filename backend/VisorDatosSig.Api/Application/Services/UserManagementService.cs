using System.Security.Cryptography;
using Microsoft.Data.SqlClient;

namespace VisorDatosSig.Api;

public sealed record UserListItem(
    int Id,
    string Login,
    string Nombre,
    bool Activo,
    DateTime FechaRegistro,
    List<string> Roles
);

public sealed record RoleListItem(
    int Id,
    string NombreRol,
    string? Descripcion,
    bool Estado,
    int UsuariosCount
);

public sealed record CreateUserRequest(
    string Login,
    string Nombre,
    string Password,
    List<string>? Roles
);

public sealed record UpdateUserRequest(
    string Nombre,
    List<string>? Roles
);

public sealed record UpdateUserStatusRequest(
    bool Activo
);

public sealed record CreateRoleRequest(
    string NombreRol,
    string? Descripcion
);

public sealed record UpdateRoleRequest(
    string? Descripcion,
    bool Estado
);

public sealed class UserManagementService(IConfiguration configuration, ILogger<UserManagementService> logger)
{
    private SqlConnection CreateConnection()
    {
        var connectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            logger.LogError("Database connection string MigrationDb is not configured.");
            throw new InvalidOperationException("Connection string is not configured.");
        }
        return new SqlConnection(connectionString);
    }

    public async Task<List<UserListItem>> GetUsersAsync(CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);

        const string sql = """
            SELECT 
                u.IdUsuario,
                u.Login,
                u.Nombre,
                u.Activo,
                u.FechaRegistro,
                r.NombreRol
            FROM dbo.Usuarios u
            LEFT JOIN dbo.UsuariosRoles ur ON ur.IdUsuario = u.IdUsuario
            LEFT JOIN dbo.Roles r ON r.IdRol = ur.IdRol AND r.Estado = 1
            ORDER BY u.IdUsuario DESC, r.NombreRol ASC;
            """;

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var usersMap = new Dictionary<int, UserListItem>();

        while (await reader.ReadAsync(cancellationToken))
        {
            var id = reader.GetInt32(0);
            if (!usersMap.TryGetValue(id, out var user))
            {
                user = new UserListItem(
                    Id: id,
                    Login: reader.GetString(1),
                    Nombre: reader.GetString(2),
                    Activo: reader.GetBoolean(3),
                    FechaRegistro: reader.GetDateTime(4),
                    Roles: new List<string>()
                );
                usersMap[id] = user;
            }

            if (!reader.IsDBNull(5))
            {
                user.Roles.Add(reader.GetString(5));
            }
        }

        return usersMap.Values.ToList();
    }

    public async Task<UserListItem?> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Login) || string.IsNullOrWhiteSpace(request.Nombre) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new ArgumentException("Login, Nombre y Password son obligatorios.");
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            // Verificar si el login ya existe
            await using (var checkCmd = new SqlCommand("SELECT COUNT(1) FROM dbo.Usuarios WHERE Login = @login", connection, transaction))
            {
                checkCmd.Parameters.AddWithValue("@login", request.Login.Trim());
                var count = (int)(await checkCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
                if (count > 0)
                {
                    throw new InvalidOperationException($"El usuario '{request.Login}' ya existe.");
                }
            }

            // Hashear contraseña
            const int iterations = 100000;
            var salt = RandomNumberGenerator.GetBytes(32);
            var hash = Rfc2898DeriveBytes.Pbkdf2(request.Password, salt, iterations, HashAlgorithmName.SHA256, 32);

            int newUserId;
            DateTime fechaRegistro;

            const string insertUserSql = """
                INSERT INTO dbo.Usuarios (Login, Nombre, PasswordHash, PasswordSalt, Iteraciones, Activo)
                OUTPUT INSERTED.IdUsuario, INSERTED.FechaRegistro
                VALUES (@login, @nombre, @hash, @salt, @iterations, 1);
                """;

            await using (var insertCmd = new SqlCommand(insertUserSql, connection, transaction))
            {
                insertCmd.Parameters.AddWithValue("@login", request.Login.Trim());
                insertCmd.Parameters.AddWithValue("@nombre", request.Nombre.Trim());
                insertCmd.Parameters.AddWithValue("@hash", hash);
                insertCmd.Parameters.AddWithValue("@salt", salt);
                insertCmd.Parameters.AddWithValue("@iterations", iterations);

                await using var reader = await insertCmd.ExecuteReaderAsync(cancellationToken);
                if (!await reader.ReadAsync(cancellationToken))
                {
                    throw new InvalidOperationException("No se pudo insertar el usuario.");
                }
                newUserId = reader.GetInt32(0);
                fechaRegistro = reader.GetDateTime(1);
            }

            // Asignar roles
            var assignedRoles = new List<string>();
            if (request.Roles != null && request.Roles.Count > 0)
            {
                foreach (var roleName in request.Roles.Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    const string assignRoleSql = """
                        INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol)
                        SELECT @userId, r.IdRol
                        FROM dbo.Roles r
                        WHERE r.NombreRol = @roleName AND r.Estado = 1;
                        """;
                    await using var assignCmd = new SqlCommand(assignRoleSql, connection, transaction);
                    assignCmd.Parameters.AddWithValue("@userId", newUserId);
                    assignCmd.Parameters.AddWithValue("@roleName", roleName.Trim());
                    if (await assignCmd.ExecuteNonQueryAsync(cancellationToken) > 0)
                    {
                        assignedRoles.Add(roleName.Trim());
                    }
                }
            }

            await transaction.CommitAsync(cancellationToken);

            return new UserListItem(
                Id: newUserId,
                Login: request.Login.Trim(),
                Nombre: request.Nombre.Trim(),
                Activo: true,
                FechaRegistro: fechaRegistro,
                Roles: assignedRoles
            );
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<bool> UpdateUserAsync(int id, UpdateUserRequest request, CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            const string updateSql = "UPDATE dbo.Usuarios SET Nombre = @nombre WHERE IdUsuario = @id";
            await using (var updateCmd = new SqlCommand(updateSql, connection, transaction))
            {
                updateCmd.Parameters.AddWithValue("@id", id);
                updateCmd.Parameters.AddWithValue("@nombre", request.Nombre.Trim());
                var affected = await updateCmd.ExecuteNonQueryAsync(cancellationToken);
                if (affected == 0) return false;
            }

            if (request.Roles != null)
            {
                // Limpiar roles existentes
                const string deleteRolesSql = "DELETE FROM dbo.UsuariosRoles WHERE IdUsuario = @id";
                await using (var delCmd = new SqlCommand(deleteRolesSql, connection, transaction))
                {
                    delCmd.Parameters.AddWithValue("@id", id);
                    await delCmd.ExecuteNonQueryAsync(cancellationToken);
                }

                // Insertar roles nuevos
                foreach (var roleName in request.Roles.Distinct(StringComparer.OrdinalIgnoreCase))
                {
                    const string insertRoleSql = """
                        INSERT INTO dbo.UsuariosRoles (IdUsuario, IdRol)
                        SELECT @userId, r.IdRol
                        FROM dbo.Roles r
                        WHERE r.NombreRol = @roleName AND r.Estado = 1;
                        """;
                    await using var insertCmd = new SqlCommand(insertRoleSql, connection, transaction);
                    insertCmd.Parameters.AddWithValue("@userId", id);
                    insertCmd.Parameters.AddWithValue("@roleName", roleName.Trim());
                    await insertCmd.ExecuteNonQueryAsync(cancellationToken);
                }
            }

            await transaction.CommitAsync(cancellationToken);
            return true;
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<bool> UpdateUserStatusAsync(int id, bool activo, CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);

        const string sql = "UPDATE dbo.Usuarios SET Activo = @activo WHERE IdUsuario = @id";
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@activo", activo);

        var affected = await command.ExecuteNonQueryAsync(cancellationToken);
        return affected > 0;
    }

    public async Task<List<RoleListItem>> GetRolesAsync(CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);

        const string sql = """
            SELECT 
                r.IdRol,
                r.NombreRol,
                r.Descripcion,
                r.Estado,
                COUNT(ur.IdUsuario) AS UsuariosCount
            FROM dbo.Roles r
            LEFT JOIN dbo.UsuariosRoles ur ON ur.IdRol = r.IdRol
            GROUP BY r.IdRol, r.NombreRol, r.Descripcion, r.Estado
            ORDER BY r.IdRol ASC;
            """;

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var list = new List<RoleListItem>();
        while (await reader.ReadAsync(cancellationToken))
        {
            list.Add(new RoleListItem(
                Id: reader.GetInt32(0),
                NombreRol: reader.GetString(1),
                Descripcion: reader.IsDBNull(2) ? null : reader.GetString(2),
                Estado: reader.GetBoolean(3),
                UsuariosCount: reader.GetInt32(4)
            ));
        }

        return list;
    }

    public async Task<RoleListItem?> CreateRoleAsync(CreateRoleRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.NombreRol))
        {
            throw new ArgumentException("El nombre del rol es obligatorio.");
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);

        const string checkSql = "SELECT COUNT(1) FROM dbo.Roles WHERE NombreRol = @nombre";
        await using (var checkCmd = new SqlCommand(checkSql, connection))
        {
            checkCmd.Parameters.AddWithValue("@nombre", request.NombreRol.Trim());
            var count = (int)(await checkCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
            if (count > 0)
            {
                throw new InvalidOperationException($"El rol '{request.NombreRol}' ya existe.");
            }
        }

        const string insertSql = """
            INSERT INTO dbo.Roles (NombreRol, Descripcion, Estado)
            OUTPUT INSERTED.IdRol, INSERTED.Estado
            VALUES (@nombre, @descripcion, 1);
            """;

        await using var insertCmd = new SqlCommand(insertSql, connection);
        insertCmd.Parameters.AddWithValue("@nombre", request.NombreRol.Trim());
        insertCmd.Parameters.AddWithValue("@descripcion", (object?)request.Descripcion?.Trim() ?? DBNull.Value);

        await using var reader = await insertCmd.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            return new RoleListItem(
                Id: reader.GetInt32(0),
                NombreRol: request.NombreRol.Trim(),
                Descripcion: request.Descripcion?.Trim(),
                Estado: reader.GetBoolean(1),
                UsuariosCount: 0
            );
        }

        return null;
    }

    public async Task<bool> UpdateRoleAsync(int id, UpdateRoleRequest request, CancellationToken cancellationToken)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);

        const string updateSql = "UPDATE dbo.Roles SET Descripcion = @descripcion, Estado = @estado WHERE IdRol = @id";
        await using var command = new SqlCommand(updateSql, connection);
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@descripcion", (object?)request.Descripcion?.Trim() ?? DBNull.Value);
        command.Parameters.AddWithValue("@estado", request.Estado);

        var affected = await command.ExecuteNonQueryAsync(cancellationToken);
        return affected > 0;
    }
}
