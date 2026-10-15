# WAVE-01 — Shared contracts (zod + JSON Schema) and page shell
Depends on: WAVE-00
Human prerequisites: none

Deps are pre-installed by WAVE-00. No task edits `package.json`.

## Tasks
### T01.1 — Zod schemas, JSON Schema export, drift check in CI
- Files: `src/lib/schema/**`, `scripts/export-schema.ts`, `schemas/*.schema.json`, `.github/workflows/web.yml`
- Do:
  1. Implement every schema in `docs/PLAN-01-architecture.md` §2 exactly (names, fields, `.strict()`), one file per group: `geo.ts`, `mission.ts`, `scenario.ts`, `validation.ts`, `replay.ts`, `report.ts`, `api.ts`. Export inferred types (`export type Mission = z.infer<typeof Mission>`). No barrel `index.ts`.
  2. Add the cross-field rule on `Finding` with `.check()`/`.superRefine()`: `status === 'observed'` ⇒ `evidence.length ≥ 1`; `status === 'abstained'` ⇒ `abstain_reason` present.
  3. `scripts/export-schema.ts`: write `schemas/{mission,scenario,telemetry-sample,replay-manifest,report}.schema.json` with `z.toJSONSchema(schema, { target: 'draft-2020-12' })`, 2-space JSON + trailing newline (deterministic output).
  4. Run `pnpm schema:export` and commit the outputs.
  5. `web.yml`: add step after tests: `pnpm schema:export && git diff --exit-code schemas/`.
- Tests: `src/lib/schema/schema.test.ts` (write first): one valid + one invalid sample per schema; `Mission` rejects extra keys, >50 waypoints, bad `id` pattern; `PlanRequest` rejects unknown `op`, `request` > 500 chars, `round: 3`; `Finding` cross-field rule; `TelemetrySample` frame_id pattern. `src/lib/schema/export.test.ts`: exported JSON for `Mission` has `additionalProperties: false` and `required` containing `waypoints`; on-disk `schemas/*.json` equal a fresh export (drift test).
- Acceptance: `pnpm vitest run src/lib/schema`, `pnpm schema:export && git add schemas/ && pnpm schema:export && git diff --exit-code schemas/`, `pnpm biome check src/lib/schema scripts/export-schema.ts`

### T01.2 — Page shell, layout, design tokens, accessibility base
- Files: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/page.module.css`, `e2e/smoke.spec.ts`
- Do:
  1. `layout.tsx`: `<html lang="en">`, metadata title "DroneOS Mission Copilot", description, viewport.
  2. `page.tsx`: static shell with four labelled regions (`<section aria-labelledby>`): Plan, Review, Fly, Report; header with product name and a placeholder slot for the mode badge; footer "Simulation only. LLM drafts, validator checks, you approve."
  3. `globals.css`: tokens (`--ok`, `--bad`, `--warn`, `--fg`, `--bg`, `--focus`), base 18px font, visible `:focus-visible` ring, `@media (prefers-reduced-motion: reduce)` disables transitions, contrast ≥4.5:1 for all token pairs used as text.
  4. `page.module.css`: two-column grid (map left, panels right) ≥1024 px; single column below.
- Tests: `e2e/smoke.spec.ts` (update first): four regions reachable by role/name; Tab moves focus with a visible outline (`toHaveCSS('outline-style', …)` not `none`).
- Acceptance: `pnpm biome check src/app e2e/smoke.spec.ts`, `pnpm exec playwright test --list e2e/smoke.spec.ts` (build and E2E run in the wave gate)

## Wave gate
- Commands: `pnpm lint && pnpm test && pnpm build && pnpm e2e && pnpm schema:export && git add schemas/ && pnpm schema:export && git diff --exit-code schemas/ && uv run --project sim pytest -q sim/tests`
- Review focus: schemas match PLAN-01 §2 field-for-field; every object `.strict()`; exported JSON Schema deterministic and committed; no logic in page shell; a11y basics (landmarks, focus ring, reduced motion).
