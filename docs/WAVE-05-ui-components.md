# WAVE-05 — UI components (props-only, logic in tested helpers)
Depends on: WAVE-04
Human prerequisites: none

Deps pre-installed by WAVE-00. Every component is a `'use client'` function component that takes props and emits callbacks; no fetching, no global state. Styles in a sibling `*.module.css` using tokens from `globals.css`. Status is always text + icon, never colour alone ([A18](../../../AI/loop-research/scratchpads/A18-ui-ux.md)). Components are type-checked and built in the gate and exercised end-to-end in WAVE-07; each task's logic lives in a `src/lib/ui/*.ts` helper with unit tests.

## Tasks
### T05.1 — MapView (Leaflet + Geoman, no react-leaflet)
- Files: `src/components/MapView.tsx`, `src/components/MapView.module.css`, `src/lib/ui/geo.ts`, `src/lib/ui/geo.test.ts`
- Do:
  1. Props: `{ tileUrl, home, geofence, noFly, area, editableArea, onAreaChange, path, badWaypointIds, drone?, pois }`.
  2. In `useEffect`, `await import('leaflet')` and `await import('@geoman-io/leaflet-geoman-free')` (both touch `window`); import their CSS (`leaflet/dist/leaflet.css`, `@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css`). Create the map once; `map.remove()` on unmount.
  3. Layers: fence (outline), no-fly (hatched, labelled tooltip), area (editable via `map.pm` draw/edit polygon only when `editableArea`), path polyline with numbered waypoint markers (bad ones marked `✗` and red), POI circles, drone marker. Update layers on prop change without recreating the map.
  4. Tile layer with attribution `© OpenStreetMap contributors` ([OSM tile policy](https://operations.osmfoundation.org/policies/tiles/)).
  5. `geo.ts`: `toLatLngs(ring)`, `fromLeafletRing(latlngs) → Ring | null` (drops closing duplicate, rejects <3 or >100 vertices), `boundsOf(rings)`.
- Tests (write first): `src/lib/ui/geo.test.ts` (round trip; closing point dropped; vertex limits; bounds).
- Acceptance: `pnpm vitest run src/lib/ui/geo.test.ts`, `pnpm biome check src/components/MapView.tsx src/lib/ui/geo.ts`

### T05.2 — PlanPanel + ModeBanner
- Files: `src/components/PlanPanel.tsx`, `src/components/PlanPanel.module.css`, `src/components/ModeBanner.tsx`, `src/components/ModeBanner.module.css`, `src/lib/ui/request.ts`, `src/lib/ui/request.test.ts`
- Do:
  1. PlanPanel props: `{ scenarios, scenarioId, request, presets, liveAvailable, accessCode, busy, error, onScenario, onRequest, onAccessCode, onPlan }`. Scenario `<select>`, preset buttons, labelled `<textarea maxLength=500>` with live char count, access-code `<input type="password">` shown only when `liveAvailable`, Plan button disabled while busy/invalid. Errors in `role="alert"`.
  2. ModeBanner props: `{ mode: 'live'|'replay', model? }` → `LIVE · claude-sonnet-5-5` or `REPLAY · recorded fixtures (no API calls)`.
  3. `request.ts`: `checkRequest(text) → { ok, message? }` (3–500 chars after trim), `isPreset(text, presets)` (normalized compare).
- Tests (write first): `src/lib/ui/request.test.ts`.
- Acceptance: `pnpm vitest run src/lib/ui/request.test.ts`, `pnpm biome check src/components/PlanPanel.tsx src/components/ModeBanner.tsx src/lib/ui/request.ts`

### T05.3 — ReviewPanel + ConstraintBadges + DiffView
- Files: `src/components/ReviewPanel.tsx`, `src/components/ReviewPanel.module.css`, `src/components/ConstraintBadges.tsx`, `src/components/DiffView.tsx`, `src/lib/ui/badges.ts`, `src/lib/ui/badges.test.ts`
- Do:
  1. `badges.ts`: `toBadges(validation) → { code, label, ok, text }[]` — one badge per check (GEOFENCE, CEILING, MIN ALT, NO-FLY, BATTERY, WAYPOINTS, LEG LENGTH), text like `✗ GEOFENCE — wp7 18 m outside` or `✓ BATTERY — 41% reserve left`; `summary(validation)` for a `role="status"` line.
  2. ReviewPanel props: `{ mission, validation, diffs, round, canRepair, canAutoFix, busy, onRepair, onAutoFix, onApprove }`; waypoint `<table>` with caption; Approve disabled unless `validation.ok`, with visible reason; Repair label `Repair (round n/2)`; AutoFix button labelled `Deterministic fix`.
  3. DiffView: per change row `moved / altitude / removed / added` with before → after values and the source label (`LLM repair round 1` / `DETERMINISTIC FIX`).
- Tests (write first): `src/lib/ui/badges.test.ts` (all-ok; each code; multiple violations of one code collapse into one badge with a count).
- Acceptance: `pnpm vitest run src/lib/ui/badges.test.ts`, `pnpm biome check src/components/ReviewPanel.tsx src/components/ConstraintBadges.tsx src/components/DiffView.tsx src/lib/ui/badges.ts`

### T05.4 — ReplayPlayer + FrameViewer + TelemetryStrip
- Files: `src/components/ReplayPlayer.tsx`, `src/components/ReplayPlayer.module.css`, `src/components/FrameViewer.tsx`, `src/components/TelemetryStrip.tsx`, `src/lib/ui/telemetry-format.ts`, `src/lib/ui/telemetry-format.test.ts`
- Do:
  1. ReplayPlayer props: `{ replay, t, playing, speed, onSeek, onPlayPause, onSpeed }`; source label from `manifest.source` (`RECORDED SITL · PX4 geofence enforced (GF_ACTION=2)` or `SYNTHETIC · validator-only, no autopilot`); `<input type="range">` scrubber with `aria-valuetext` "t = 42 s"; speed buttons `1× 2× 4×` with the label always visible; Space toggles play.
  2. The animation loop lives in the parent (WAVE-06); this component is controlled.
  3. FrameViewer: `<img alt="Frame 000041 at 42 s, 35 m">` + frame id caption; empty state text.
  4. TelemetryStrip: alt, battery, mode, lat/lon from `sampleAt`.
  5. `telemetry-format.ts`: `formatTime`, `formatAlt`, `formatBattery`, `formatLatLon`, `sourceLabel(manifest)`.
- Tests (write first): `src/lib/ui/telemetry-format.test.ts`.
- Acceptance: `pnpm vitest run src/lib/ui/telemetry-format.test.ts`, `pnpm biome check src/components/ReplayPlayer.tsx src/components/FrameViewer.tsx src/components/TelemetryStrip.tsx src/lib/ui/telemetry-format.ts`

### T05.5 — ReportPanel
- Files: `src/components/ReportPanel.tsx`, `src/components/ReportPanel.module.css`, `src/lib/ui/report-view.ts`, `src/lib/ui/report-view.test.ts`
- Do:
  1. Props: `{ report, frames, onSeekFrame }`; observed findings first, each with caption, `AI`/`TEMPLATE` provenance badge from `generated_by`, and frame chips `000041 · 42 s · 47.39890, 8.54559 · 35 m` as buttons calling `onSeekFrame(id)`; "Abstentions" list with reasons.
  2. `report-view.ts`: `orderFindings(report)`, `chipLabel(evidence)`, `counts(report)`.
- Tests (write first): `src/lib/ui/report-view.test.ts`.
- Acceptance: `pnpm vitest run src/lib/ui/report-view.test.ts`, `pnpm biome check src/components/ReportPanel.tsx src/lib/ui/report-view.ts`

### T05.6 — API client
- Files: `src/lib/api-client.ts`, `src/lib/api-client.test.ts`
- Do:
  1. `getHealth(fetchFn = fetch)`, `postPlan(body, fetchFn = fetch)`: POST JSON to `/api/plan`, parse with `PlanResponse`; non-2xx with a valid error body → return it; network error, timeout (`AbortSignal.timeout(30_000)`) or unparseable body → `{ ok: false, error: { code: 'upstream', message: 'Service unavailable, try again or use a preset' } }`. Never throws.
- Tests (write first): fake `fetchFn` for 200, 422 `replay_miss`, 429, non-JSON 500, rejected promise, abort.
- Acceptance: `pnpm vitest run src/lib/api-client.test.ts`, `pnpm biome check src/lib/api-client.ts`

## Wave gate
- Commands: `pnpm lint && pnpm test && pnpm build && uv run --project sim pytest -q sim/tests`
- Review focus: components props-only and logic-free; no `dangerouslySetInnerHTML`; Leaflet/Geoman only imported client-side; every input labelled, icon buttons have `aria-label`, status not colour-only, keyboard path works; Approve disabled with a visible reason while violations exist; source label always visible during playback.
