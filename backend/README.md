# Backend SQL Server preflight

This is the initial ASP.NET Core 10 Web API slice for SIG-15. Configure the connection using the .NET configuration key `ConnectionStrings:MigrationDb`, supplied as the process environment variable `ConnectionStrings__MigrationDb` or through another normal .NET configuration provider (for example, user secrets or deployment secrets). Never commit real credentials.

Example `.env` file content (replace every placeholder; never commit real credentials):

```dotenv
ConnectionStrings__MigrationDb='Server=YOUR_SQL_SERVER;Database=VisorDatosSIG;User Id=YOUR_SQL_USER;Password=YOUR_SQL_PASSWORD;Encrypt=True;TrustServerCertificate=False'
```

## Authentication diagnostics

Login returns HTTP 401 (`Login failed.`) for invalid credentials or an inactive/missing user. HTTP 503 (`Authentication service unavailable.`) indicates SQL or configuration unavailability.

## Migration, build, test, and run locally

Commands below assume macOS/Linux and a .NET 10 SDK. ASP.NET Core does not load `.env` files automatically, so load the file into the current shell before running the API.

1. From the repository root, create your local environment file and edit it with your SQL Server values:

   ```sh
   cd backend
   cp .env.example .env
   ```

2. Load the settings into this shell. Keep `.env` local; it is ignored by Git:

   ```sh
   set -a
   source .env
   set +a
   ```

3. Confirm the .NET 10 SDK is available, then restore packages:

   ```sh
   dotnet --version
   dotnet restore VisorDatosSig.Api/VisorDatosSig.Api.csproj
   ```

4. After sourcing the environment, run the ordered scripts in `ScriptDatabase/` without starting the API:

    ```sh
    dotnet run --project VisorDatosSig.Api/VisorDatosSig.Api.csproj -- --migrate-database
    ```

    An alternate scripts directory can be supplied as the optional argument:

    ```sh
    dotnet run --project VisorDatosSig.Api/VisorDatosSig.Api.csproj -- --migrate-database /path/to/ScriptDatabase
    ```

5. Compile the API and run its tests:

   ```sh
   dotnet build VisorDatosSig.Api/VisorDatosSig.Api.csproj
   dotnet test VisorDatosSig.Api.Tests/VisorDatosSig.Api.Tests.csproj
   ```

6. Start the API:

   ```sh
   dotnet run --project VisorDatosSig.Api/VisorDatosSig.Api.csproj
   ```
