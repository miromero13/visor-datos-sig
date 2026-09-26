# VisorDatosSIG frontend

Standalone Vite + React + TypeScript presentation app for the VisorDatosSIG academic project.

## Setup

Requirements: Node.js and npm.

```sh
cd frontend
npm install
npm run dev
```

The app provides `/` (project landing page) and `/login` (interface-only login screen). Run the route and content tests with `npm run test -- --run`; create a production bundle with `npm run build`.

## UI foundation

Tailwind CSS v4 is connected through its Vite plugin. The generated shadcn/ui Button, Card, Input, and Alert components are owned in `src/components/ui` and used by the landing/login interface. `components.json`, the `@` source alias, CSS design tokens, and the `cn` utility package keep the setup ready for additional shadcn components. Their generated styling is customized to match the project palette and spacing. To regenerate the component set from the frontend directory, run `npx shadcn@latest add button card input alert`.

Inter is self-hosted from `@fontsource/inter`. React Router provides client-side routes. Vitest, jsdom, React Testing Library, jest-dom, and user-event support interface tests.

## Project status

This site presents the documented architecture and technology choices as planned work. It does not implement the GIS migration, spatial validation, API, or authentication services. The map-like hero artwork is an abstract illustration and does not depict actual spatial data. Login fields are disabled until an authentication backend is available; the page does not store credentials or simulate a successful sign-in.
