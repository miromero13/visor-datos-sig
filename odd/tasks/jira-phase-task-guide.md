# Jira Phase Task Guide

## Goal
Maintain a Spanish Markdown execution checklist for every SIG issue and formally plan meaningful mock-backed frontend/GIS viewer progress in Phase 1, followed by production integration in Phase 2.

## Scope
- Include all reviewed SIG issues, SIG-15 through SIG-103 (89 total), exactly once.
- Phase 1 includes geographic data migration plus a parallel early React/Leaflet viewer track using synthetic GeoJSON; Phase 2 completes the web system and integrates production API/data.
- Preserve Jira issue keys and acceptance scope; do not invent issue prerequisites or official data/schema decisions.
- Explain `RF-*` traceability references and note external design/data gates where relevant.
- Do not modify Jira, code, or the existing untracked `docs/.DS_Store`.

## Tasks
1. Reconcile phase boundaries and ordered task groups against project context and reviewed Jira issues. (Done: prior Jira review captured SIG-15–103 and priorities/dependency links.)
2. Write the Spanish phase checklist with a checkbox for every issue, grouped in dependency-aware order and with conditional/desirable gates called out. (Done: `docs/PHASE_TASKS.md`; dashboard quick actions follow the dashboard summary.)
3. Verify issue coverage/counts, links, Markdown structure, and repository diff; preserve unrelated untracked files. (Done: 89 unique issues; Phase 1 has 17, Phase 2 has 72; no missing/extra issue keys or trailing whitespace.)

## Evidence
- Output: `docs/PHASE_TASKS.md`.
- Source phase definitions: `docs/CONTEXT_PROJECT.md`.
- Requirement reference catalog: `docs/FUNCTIONAL_REQUIREMENTS.md`.
- Jira project SIG issue range: SIG-15–SIG-103, 89 issues.

## Scope Extension: Early Web Progress in Phase 1

The user selected a formal redefinition of the phases so Phase 1 includes meaningful frontend and GIS viewer progress. Keep the migration track intact and add a parallel demo track based on synthetic/mock GeoJSON. Do not mark Jira stories as complete from prototype-only work and do not change Jira in this documentation task.

4. Define a bounded early web track using repository evidence and explicit mock-data boundaries. (Done: React/Vite exists; no Leaflet dependency or real viewer; choose synthetic fixtures because data metadata includes unresolved CRS concerns.)
5. Revise `docs/CONTEXT_PROJECT.md` to define Phase 1 as migration plus web/viewer foundation, and Phase 2 as production API/auth and data integration. (Done: updated outcomes, gates, CRS validation language, and both phase flows.)
6. Revise `docs/PHASE_TASKS.md` with an ordered parallel web checklist, preserving exactly one Jira checklist entry per issue and keeping prototype work distinct from full issue acceptance. (Done: six mock-viewer preparation tasks added; existing 89 Jira entries and Phase 2 issue acceptance preserved.)
7. Verify phase outcomes, issue coverage/uniqueness, and formatting; preserve unrelated files. (Done: all 89 issue keys unique, 17 Phase 1 Jira and 72 Phase 2 Jira checkboxes; six separate Phase 1 viewer tasks; gates/flows consistent; no whitespace or code-fence issues.)
