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

}
