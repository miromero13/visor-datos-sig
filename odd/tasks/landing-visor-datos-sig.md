# VisorDatosSIG landing and login route

## Objective
Create a responsive React + TypeScript landing page for VisorDatosSIG in `/frontend`, matching the existing OpenPencil visual direction, and provide a `/login` route.

## Problem and rationale
The repository currently contains project documentation and a high-fidelity OpenPencil design but no frontend application. This implementation makes the project presentable while preserving documented facts and keeping login clearly non-functional until an authentication backend exists.

## Scope and constraints
- Create a standalone Vite React + TypeScript app under `/frontend`, using actual shadcn/ui components and a `/login` route.
- Match `docs/design/visor-datos-sig.op`: deep GIS blue and cobalt, light surfaces, Inter typography, restrained radii and clear map-oriented visuals.
- Include the project overview, project team (Luis Gabriel Janco and María Ilse Romero), technologies, and academic details supplied or documented: Universidad Autónoma Gabriel René Moreno, FICCT, Sistemas de Información Geográfica, docente Ing. Perez Ferreira Ubaldo, carrera Ingeniería en Sistemas.
- Treat implementation status accurately: present technologies as the planned project stack, not as already implemented components. The backend and authentication are not in this repository.
- Do not modify GIS datasets, SQL scripts, Jira, or the OpenPencil source file. Do not add claims about data validation or completed migration.
- Use Spanish UI copy consistent with the existing project; no fabricated metrics or map data. Keep `/login` as a UI-only form without fake authentication.
- Keep all implementation files under `frontend/`; feature tracking stays in `odd/tasks/`.

## TDD configuration
Strict TDD explicitly selected by the user. Source: user choice in this session. Runner: Vitest (new standalone Vite app; no existing project runner). Required sequence: observed RED, GREEN, then REFACTOR. Use React Testing Library for route/content assertions if needed.

## Work units

### T1 - Build and refactor the landing page and login route
- [ ] Keep the responsive React + TypeScript landing page and UI-only `/login` route aligned with the OpenPencil visual direction.
- [ ] Use the existing local shadcn/ui components and Tailwind utilities throughout the UI; remove custom application CSS and do not add pure-CSS styling.
- [ ] Refactor the React source so each source file defines at most one React component function, including local shadcn/ui components.
- [ ] Preserve project identity, supplied academic details, contributors, planned technology wording, and non-functional login behavior.
- Acceptance: app starts/builds; `/` and `/login` render; navigation works; layout is responsive; application styling is Tailwind/shadcn without custom CSS rules; no source file contains more than one component function; visible facts do not overstate implementation status.
- Route: delegated to one bounded `gentle-ai-worker` because this is a multi-file refactor. Allowed edit surface: `frontend/**`.
- TDD: strict; add or update tests first, observe RED, then implement and observe GREEN using Vitest.
- Verification: writer reports RED/GREEN, test, build, and structural/CSS audit evidence; parent performs a delegated read-only spot-check. RDD is on; assess the resulting candidate and follow its risk-gated verification plan.

### T2 - Resolve frontend editor diagnostics
- [x] Add Vite client type declarations so the CSS side-effect import in `src/main.tsx` resolves in TypeScript.
- [x] Remove the test-local duplicate `ImportMeta.glob` declaration now supplied by Vite client types.
- [ ] Identify and address the reported class/className warnings where repository config or source code owns the cause; do not suppress unknown editor diagnostics blindly.
- [x] Reconcile the login test with the UI-only contract: explain that authentication/backend are unavailable and keep the email/password fields and submit action disabled.
- Acceptance: TypeScript build resolves `./styles.css`; login remains visibly non-functional; class warnings are either fixed at source/config or precisely attributed to an external editor extension with the missing diagnostic details documented.
- Route: bounded fix after scout diagnosis; allowed edit surface `frontend/**`.
- TDD/verification: use existing Vitest/build checks; verify the editor-facing TypeScript configuration and scan class attributes/utility usage.

## Current progress
- Exploration complete. The standalone app exists under `frontend/`; project facts and planned architecture are documented in repository requirements.
- User requires actual shadcn/ui components, Tailwind styling without custom CSS, and at most one React component function per source file.
- Read-only scout found custom application CSS in `src/styles.css`, six components in `App.tsx`, and grouped subcomponents in shadcn Card/Alert files. It also found stale prior notes: Button/Card/Input/Alert were already present and imported by the app.
- Refactor delegated to `gentle-ai-worker` on branch `feature/frontend-shadcn-tailwind-refactor`, limited to `frontend/**`; no dependencies were installed and no commit was made.
- Writer added structural/style regression assertions, split app and shadcn components across files, moved styling to Tailwind utilities, and left `src/styles.css` with only `@import "tailwindcss";`.
- Writer reports strict-TDD RED then GREEN; `npm run test -- --run` passed (4 tests), and `npm run build` passed.
- Independent `gentle-ai-verify` reran both commands successfully. Its source scan found no file with more than one component-like function, no inline `style=`, and no authored CSS rules beyond Tailwind import. Scan was pattern-based, not TypeScript AST.
- Native review approved and acknowledged for the initial frontend refactor candidate; unrelated untracked project files were excluded from that review.
- Follow-up T2 added `src/vite-env.d.ts` with Vite client types, resolving TS(2882), and removed the redundant manual `ImportMeta.glob` declaration that conflicted with Vite's definitions.
- Corrected the surfaced login regression: copy states authentication/backend are unavailable and all login controls remain disabled. Independent verification passed tests (4) and build.
- JSX/TSX has no raw `class=` attributes; React uses `className`. No ESLint/class validator is configured in frontend. The user's remaining class warnings cannot yet be attributed without their exact text and extension/source.
- Follow-up candidate still needs native review. No commit was created; delivery remains a separate user decision.

## Next step
Request the exact class warning text and editor extension/source, then fix or configure the responsible tool. Authentication/backend remain unimplemented.
