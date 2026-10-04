using System.Security.Cryptography;
using Microsoft.Data.SqlClient;

namespace VisorDatosSig.Api;

public sealed record AuthUser(int Id, string Login, string Name, string[] Roles);

public sealed class AuthenticationInfrastructureException : Exception
{
    public AuthenticationInfrastructureException() : base("Authentication infrastructure is unavailable.") { }
}

public sealed class AuthService(IConfiguration configuration, ILogger<AuthService> logger)
{
    public async Task<AuthUser?> AuthenticateAsync(string login, string password, CancellationToken cancellationToken)
    {
        var connectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            logger.LogError("Authentication configuration is unavailable.");
            throw new AuthenticationInfrastructureException();
        }
        try
        {
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT u.IdUsuario, u.Login, u.Nombre, u.PasswordHash, u.PasswordSalt, u.Iteraciones, u.Activo
                FROM dbo.Usuarios u WHERE u.Login = @login
                """;
            command.Parameters.AddWithValue("@login", login);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken) || !reader.GetBoolean(6)) return null;
            var id = reader.GetInt32(0);
            var storedLogin = reader.GetString(1);
            var name = reader.GetString(2);
            var hash = (byte[])reader[3];
            var salt = (byte[])reader[4];
            var iterations = reader.GetInt32(5);
            if (iterations <= 0 || hash.Length == 0) return null;
            var derived = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, hash.Length);
            if (!CryptographicOperations.FixedTimeEquals(hash, derived)) return null;
            await reader.CloseAsync();
            await using var rolesCommand = connection.CreateCommand();
            rolesCommand.CommandText = "SELECT r.NombreRol FROM dbo.UsuariosRoles ur JOIN dbo.Roles r ON r.IdRol = ur.IdRol WHERE ur.IdUsuario = @id AND r.Estado = 1";
            rolesCommand.Parameters.AddWithValue("@id", id);
            var roles = new List<string>();
            await using var rolesReader = await rolesCommand.ExecuteReaderAsync(cancellationToken);
            while (await rolesReader.ReadAsync(cancellationToken)) roles.Add(rolesReader.GetString(0));
            return new AuthUser(id, storedLogin, name, roles.ToArray());
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (SqlException exception)
        {
            logger.LogError("Authentication SQL failure: {ExceptionType}, error number {SqlErrorNumber}, state {SqlErrorState}.", exception.GetType().Name, exception.Number, exception.State);
            throw new AuthenticationInfrastructureException();
        }
        catch (Exception exception)
        {
            logger.LogError("Authentication infrastructure failure: {ExceptionType}.", exception.GetType().Name);
            throw new AuthenticationInfrastructureException();
        }
    }

    public async Task<bool> ChangePasswordAsync(AuthUser user, string currentPassword, string newPassword, CancellationToken cancellationToken)
    {
        var connectionString = configuration.GetConnectionString("MigrationDb");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            logger.LogError("Authentication configuration is unavailable.");
            throw new AuthenticationInfrastructureException();
        }
        try
        {
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT PasswordHash, PasswordSalt, Iteraciones FROM dbo.Usuarios WHERE IdUsuario = @id AND Activo = 1";
            command.Parameters.AddWithValue("@id", user.Id);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken)) return false;
            var storedHash = (byte[])reader[0];
            var storedSalt = (byte[])reader[1];
            var iterations = reader.GetInt32(2);
            if (iterations <= 0 || storedHash.Length == 0) return false;
            var currentHash = Rfc2898DeriveBytes.Pbkdf2(currentPassword, storedSalt, iterations, HashAlgorithmName.SHA256, storedHash.Length);
            if (!CryptographicOperations.FixedTimeEquals(storedHash, currentHash)) return false;
            await reader.CloseAsync();

            const int newIterations = 100000;
            var newSalt = RandomNumberGenerator.GetBytes(32);
            var newHash = Rfc2898DeriveBytes.Pbkdf2(newPassword, newSalt, newIterations, HashAlgorithmName.SHA256, 32);
            await using var update = connection.CreateCommand();
            update.CommandText = "UPDATE dbo.Usuarios SET PasswordHash = @hash, PasswordSalt = @salt, Iteraciones = @iterations WHERE IdUsuario = @id AND Activo = 1";
            update.Parameters.AddWithValue("@hash", newHash);
            update.Parameters.AddWithValue("@salt", newSalt);
            update.Parameters.AddWithValue("@iterations", newIterations);
            update.Parameters.AddWithValue("@id", user.Id);
            return await update.ExecuteNonQueryAsync(cancellationToken) == 1;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (SqlException exception)
        {
            logger.LogError("Authentication SQL failure: {ExceptionType}, error number {SqlErrorNumber}, state {SqlErrorState}.", exception.GetType().Name, exception.Number, exception.State);
            throw new AuthenticationInfrastructureException();
        }
        catch (Exception exception)
        {
            logger.LogError("Authentication infrastructure failure: {ExceptionType}.", exception.GetType().Name);
            throw new AuthenticationInfrastructureException();
        }
    }

}
