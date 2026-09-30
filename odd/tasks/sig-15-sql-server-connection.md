# SIG-15 — SQL Server connection

## Objective
Implement the first backend slice for Jira SIG-15: configure the SQL Server destination from environment configuration and provide a safe connection preflight/test before migration work proceeds.

## Scope and decisions
- Jira: `SIG-15`, “Configurar y probar conexión a SQL Server”; parameters/storage were explicitly left open in Jira.
- User selected environment-based configuration; no new frontend connection form.
- Use ASP.NET Core 10 Web API and SQL Server 2022 as documented in `docs/CONTEXT_PROJECT.md`.
- Document the environment key and a placeholder-only `.env`-format example in `backend/README.md`, per the user's safer-plan choice. Never put real credentials in the repository or ask the user to paste them into chat.
- Installed .NET 10 SDK version 10.0.401 with the user-authorized Homebrew `dotnet@10` formula after the `dotnet-sdk` cask required unavailable sudo. Do not install unrelated tools or packages.
- TDD is explicitly disabled by the user for this task; add and run ordinary tests if the available toolchain permits.
- Preserve pre-existing `frontend/package-lock.json` modification and untracked `docs/.DS_Store`. Do not update Jira status or commit.

## Tasks
1. Inspect SIG-15 in Jira and repository contracts; select environment-based configuration; identify no existing backend. (Done.)
2. Create a minimal backend project and SQL Server connection-test/preflight path using environment variables; document configuration and ignore real local secrets. (Done: API, probe, preflight gate, README and `.gitignore` implemented; protected `.env.example` path left untouched.)
3. Add focused tests for missing/invalid connection handling and clear, non-secret error responses; ensure failed preflight does not call migration work. (Done: four tests pass.)
4. Verify source, tests, and security boundaries. (Done: `dotnet test` passes 4/4; `dotnet build` passes with 0 warnings/errors; independent read-only review confirms sanitized errors and preflight gating.)
5. Test the connection endpoint with the user's local `.env` and reachable SQL Server; do not request or record real credentials in chat. (Pending user-side setup: no live database configuration/credentials were provided; the README contains the steps.)
6. Add structured, sanitized server-side diagnostics for failed connection probes; log only safe provider error codes/types, never exception messages or connection details. (Done: SQL failures log number/state/class, other failures log only exception type; response stays generic.)

## Acceptance criteria
- Operator can configure the destination through documented environment configuration.
- A connection can be tested before migration.
- Missing/invalid destination is reported clearly without exposing credentials and prevents migration work from being invoked.
- Connection failures produce safe diagnostic logs (provider number/state/class or exception type only), without logging exception text or connection details.
- README documents the environment key with a placeholder-only `.env`-format example; note ASP.NET Core does not auto-load `.env` files. No real credentials are committed, and real environment files are ignored.

## Progress
- Branch: `feature/sig-15-sql-connection` (created from `main`; existing uncommitted user files preserved).
- TDD: disabled by explicit user instruction.
- .NET 10 SDK 10.0.401 is installed after user authorization. No live SQL Server credentials or target were provided; live endpoint-to-database verification remains pending.
- User explicitly disabled TDD. The `dotnet-sdk` cask required sudo and failed because this shell has no interactive password; Homebrew's `dotnet@10` formula installed successfully. `dotnet --version` reports `10.0.401`.
- Backend API, sanitized probe, migration preflight seam, focused tests, README and `.gitignore` changes were written. README now shows `.env`-format configuration plus copy/load, restore, build, test, run, and endpoint-check steps. Independent read-only verification found no credential exposure in readable source and confirmed the migration callback is gated on a successful probe.
- Host safety policy blocked access to `backend/.env.example`; Git's untracked inventory reports the path exists, but its contents cannot be read or removed. User approved the README as the safe location, so it now includes `.env`-format content with placeholder host/user/password only and explains that ASP.NET Core needs a dotenv loader to consume it. Do not retry the protected path.
- Native review inspect is blocked on explicit intended-untracked selection; no review START was run. No commit or Jira update.
- `dotnet test` passes 4 tests with no failures or skips; `dotnet build` passes with zero warnings and errors. A parent spot-check also passed the test command.
- User showed `nc -zv <host> <port>` succeeded, confirming TCP reachability only; SQL protocol/authentication/database/TLS remain unverified. The probe now logs only safe SQL number/state/class or exception type; HTTP stays generic.
- `dotnet test` passes 4/4; `dotnet build` passes with 0 warnings/errors after the diagnostics change. Independent verification found no secret leakage, and a parent test spot-check passed.
- Next: test `POST /api/sql-connection/test` against the user's local SQL Server configuration when available; keep the protected `.env.example` path untouched.