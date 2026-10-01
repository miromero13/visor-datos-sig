# VisorDatosSIG frontend

Standalone Vite + React + TypeScript presentation app for the VisorDatosSIG academic project.

## Setup

Requirements: Node.js and npm.

```sh
cd frontend
npm install
npm run dev
```

The app provides `/` (project landing page), `/login` (backend-connected login), and protected `/sources` (source analysis). The API base URL is documented in `ENV_EXAMPLE.md`; leave `VITE_API_BASE_URL` empty to use the Vite proxy to `http://localhost:5000`. Create a production bundle with `npm run build`.

## UI foundation

Tailwind CSS v4 is connected through its Vite plugin. The generated shadcn/ui Button, Card, Input, and Alert components are owned in `src/components/ui` and used by the landing/login interface. `components.json`, the `@` source alias, CSS design tokens, and the `cn` utility package keep the setup ready for additional shadcn components. Their generated styling is customized to match the project palette and spacing. To regenerate the component set from the frontend directory, run `npx shadcn@latest add button card input alert`.

Inter is self-hosted from `@fontsource/inter`. React Router provides client-side routes. Vitest, jsdom, React Testing Library, jest-dom, and user-event support interface tests.

## Backend connection

Start the API from the repository root after sourcing `backend/.env`:

```sh
set -a
source backend/.env
set +a
dotnet run --project backend/VisorDatosSig.Api/VisorDatosSig.Api.csproj
```

The browser sends authentication and source-analysis requests to `/api/...`; leave `VITE_API_BASE_URL` empty (recommended) to use the existing Vite proxy to `http://localhost:5000`. If you set `VITE_API_BASE_URL=http://localhost:5000` instead, the API allows credentialed browser requests from the Vite origin `http://localhost:5173`. Access JWTs expire after 15 minutes; persistent refresh JWT cookies expire after 14 days when “remember me” is selected. Both tokens are held only in HttpOnly cookies, never in React state or browser storage. Configure `Jwt__SigningKey` in the local `backend/.env` as documented in the backend README.
