# Backend SQL Server preflight

This is the initial ASP.NET Core 10 Web API slice for SIG-15. Configure the connection using the .NET configuration key `ConnectionStrings:MigrationDb`, supplied as the process environment variable `ConnectionStrings__MigrationDb` or through another normal .NET configuration provider (for example, user secrets or deployment secrets). Never commit real credentials.

Example `.env` file content (replace every placeholder; never commit real credentials):

```dotenv
ConnectionStrings__MigrationDb='Server=YOUR_SQL_SERVER;Database=VisorDatosSIG;User Id=YOUR_SQL_USER;Password=YOUR_SQL_PASSWORD;Encrypt=True;TrustServerCertificate=False'
```

## SIG-16 temporary Shapefile analysis

1. Start the API locally with `dotnet run --project backend/VisorDatosSig.Api/VisorDatosSig.Api.csproj` (from the repository root; the documented local address is `http://localhost:5000`).
2. Start the frontend with `cd frontend && npm run dev`; Vite proxies `/api` requests to that API.
3. On `/sources`, choose files or a folder, then explicitly select **Enviar archivos para análisis temporal**. The browser sends multipart fields named `files` to `POST /api/shapefile-sources/analyze`.

The response is `{ "layers": [{ "name": "Roads", "files": ["Roads.shp"], "missingExtensions": [".prj"], "complete": false }] }`. Grouping is case-insensitive by basename; `.shp`, `.shx`, `.dbf`, and `.prj` are required. The endpoint inspects filenames only: it does not parse GIS data or CRS, write files, persist to SQL, or retain the request after analysis. The endpoint does not override ASP.NET Core/Kestrel request limits. If the host rejects a multipart request as too large, the frontend reports that response; no application-specific size limit is asserted here. No permissive CORS policy is configured; local browser requests use the Vite proxy.

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

6. In a second terminal, test the configured SQL Server connection. Use the HTTP address printed by `dotnet run` (usually `http://localhost:5000`):

   ```sh
   curl -i -X POST http://localhost:5000/api/sql-connection/test
   ```

A successful probe returns HTTP 200; missing configuration returns HTTP 503 with setup guidance; connection failure returns HTTP 502 with a sanitized message. The endpoint and probe never include provider exception details or connection data in their response. For troubleshooting failed probes, inspect the API server logs: SQL provider failures include only numeric provider metadata (number, state, and class), while other failures include only the exception type. Exception details and secrets are intentionally omitted.

`MigrationPreflight.RunAsync` is the integration seam for a future migration runner: call it before migration work, and it invokes the supplied callback only after a successful probe. This repository slice does not implement migration execution.

The project is intended for SQL Server 2022, consistent with the project context. No database connection is attempted during tests using live credentials.
