# Backend SQL Server preflight

This is the initial ASP.NET Core 10 Web API slice for SIG-15. Configure the connection using the .NET configuration key `ConnectionStrings:MigrationDb`, supplied as the process environment variable `ConnectionStrings__MigrationDb` or through another normal .NET configuration provider (for example, user secrets or deployment secrets). Never commit real credentials.

Example `.env` file content (replace every placeholder; never commit real credentials):

```dotenv
ConnectionStrings__MigrationDb='Server=YOUR_SQL_SERVER;Database=VisorDatosSIG;User Id=YOUR_SQL_USER;Password=YOUR_SQL_PASSWORD;Encrypt=True;TrustServerCertificate=False'
```

## Build, test, and run locally

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

4. Compile the API and run its tests:

   ```sh
   dotnet build VisorDatosSig.Api/VisorDatosSig.Api.csproj
   dotnet test VisorDatosSig.Api.Tests/VisorDatosSig.Api.Tests.csproj
   ```

5. Start the API:

   ```sh
   dotnet run --project VisorDatosSig.Api/VisorDatosSig.Api.csproj
   ```
