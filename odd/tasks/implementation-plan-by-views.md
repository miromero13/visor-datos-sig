# Feature Tasks — Implementation Plan by Views

## Goal
Create a technical Markdown plan that consolidates fragmented SIG work into end-to-end phases organized by user-facing views.

## Tasks

- [x] Define the global execution model and dependencies.
- [x] Document authentication/access, migration, viewer, search/results, administration, and hardening phases.
- [x] Reference existing `ScriptDatabase/`, `DatosSIG/`, `backend/`, `frontend/`, and OpenPencil design inputs.
- [x] Add technical details for database, backend, frontend, security, tests, and acceptance criteria per phase.
- [x] Review the document for consistency and unresolved decisions.

## Decisions and constraints

- The document is a plan, not implementation.
- Work is grouped by complete views/vertical slices rather than isolated Jira tickets.
- Technical artifacts default to English, but this project-facing plan follows the user's Spanish request.
- The official SQL physical design and actual DBF fields remain authoritative.
- Source CRS must be explicitly validated/reprojected to target SRID 4326.
