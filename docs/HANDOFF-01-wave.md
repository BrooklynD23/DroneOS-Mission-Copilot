# HANDOFF-01 — contracts and shell

## What exists now
- `src/lib/schema/` — geo.ts, mission.ts, scenario.ts, validation.ts, replay.ts, report.ts, api.ts. Every `z.object` `.strict()` incl. nested; `Finding` cross-field rule via `.check()` (observed⇒evidence / abstained⇒reason), both directions tested. No barrel index.ts.
- `scripts/export-schema.ts` → `schemas/*.schema.json` (5 files, deterministic — export twice → `git diff` clean). Committed.
- `.github/workflows/web.yml` — `pnpm schema:export && git diff --exit-code schemas/` drift step after unit tests.
- `src/app/page.tsx` + `page.module.css` + `layout.tsx`/`globals.css` — logic-free regions shell (static regions data); a11y: skip link, landmarks, 3px `:focus-visible` ring, `prefers-reduced-motion` block, tokens ≥4.5:1.
- `e2e/smoke.spec.ts` — region assertions + tab-focus outline, matches page regions.

## Deviations
- `Waypoint`/`Poi`/`TelemetrySample`/`Evidence` carry inline lat/lon bounds (same bounds as LatLon — safe superset of the sketch).
- `report.schema.json` drops the Finding cross-field rule (JSON Schema can't express it) — enforce sim-side in a later wave if needed.
- Gate round 2: `biome.json` `files.includes` gained `"!visuals"` (orchestrator anatomy sidecar broke repo-root lint).

## Known warnings
- `biome.json:31` deprecation info on `linter.rules.recommended` — informational only.
- Home `47.397742, 8.545594` is UNVERIFIED (HUMAN-05 checks it).

## Next wave must know
- Import zod types from `src/lib/schema/*` — never re-declare.
- `pnpm vitest run <path>` for task tests; gate runs the full chain incl. `pnpm e2e` (~5 min, don't kill).
- Geometry helper for fixtures: `dlat = north_m/111_320`, `dlon = east_m/(111_320*cos(lat0))`.
