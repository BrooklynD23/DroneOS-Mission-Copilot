# WAVE-06 — Integration: one page wires the full loop
Depends on: WAVE-05
Human prerequisites: none

Deps pre-installed by WAVE-00.

## Tasks
### T06.1 — MissionApp page wiring
- Files: `src/components/MissionApp.tsx`, `src/components/MissionApp.module.css`, `src/app/page.tsx`, `e2e/demo.spec.ts`, `e2e/injection.spec.ts`, `e2e/helpers.ts`
- Do:
  1. `page.tsx`: server component rendering the WAVE-01 shell with `<MissionApp scenarios={listScenarios()} tileUrl={process.env.NEXT_PUBLIC_TILE_URL ?? default} />`. Inside `MissionApp.tsx` (client), load `MapView` via `next/dynamic(() => import(…), { ssr: false })` (not allowed in Server Components).
  2. `MissionApp` (`'use client'`): `useReducer(flow)`; on mount `getHealth()` (from `@/lib/api-client`, WAVE-05) → `liveAvailable`; mode shown by `ModeBanner` from each response's `mode`.
  3. Plan → `postPlan({ op: 'plan', … })` → `PLAN_OK` with server validation. Badges come from the server validation; after a deterministic fix, from local `validate`.
  4. Repair → `postPlan({ op: 'repair', round })` → `REPAIR_OK` with `buildRepairDiff('llm', …)`. When `canAutoFix`, Deterministic fix → `autoFix` + `buildRepairDiff('deterministic', 0, …)` → `AUTOFIX_OK`.
  5. Approve → `loadReplay(scenarioId)`; `pickSource` → recorded replay or `replayFromSynth(synthReplay({ created: new Date().toISOString() }))`. Playback loop with `requestAnimationFrame` + `advance`; respects `prefers-reduced-motion` (start paused).
  6. Report: recorded replay → its `report.json`; synthesized → `buildReport`; in live mode also `postPlan({ op: 'report' })` and swap in captions on success (keep template on failure). `onSeekFrame` → `timeOfFrame` → set `t`, pause.
  7. Map shows fence, no-fly, area (editable in idle/review), path with bad waypoints, POIs, drone at `sampleAt(t)`.
  8. All API errors rendered via PlanPanel `error` (`role="alert"`); `replay_miss` message suggests the preset buttons.
- Tests (write first, see them fail, then wire the page; pure logic is already covered by flow, api-client, replay, report, repair tests):
  1. `e2e/helpers.ts`: `blockTiles(page)` routes `**/*tile*.png` and the `NEXT_PUBLIC_TILE_URL` host to a 1×1 PNG (offline, deterministic, respects OSM policy); `expectNoConsoleErrors(page)`; `uniqueIp(testInfo)` → `203.0.113.<n>` from `testInfo.workerIndex`/`testInfo.title` hash, applied with `page.setExtraHTTPHeaders({ 'x-forwarded-for': ip })` in a `beforeEach`, so tests never share a rate-limit bucket (locally every request would otherwise be key `unknown`; Vercel overwrites the header in prod).
  2. `e2e/demo.spec.ts` (mirrors PLAN-00 §3): open `/` → banner contains `REPLAY` (or `LIVE` when `E2E_EXPECT_LIVE=1`) → select **North roof** → click preset "Inspect the north roof, stay below 40 m" → Plan → `✗ GEOFENCE` visible and Approve disabled → Repair → diff row for `wp7` → all badges `✓` → Approve → playback label matches `/RECORDED SITL|SYNTHETIC/` → 4× → play → telemetry time advances → Report shows ≥1 observed finding and the `hvac-3` abstention → click the first frame chip → FrameViewer shows that frame id.
  3. `e2e/injection.spec.ts`: **Injection** preset → `✗ NO-FLY` and `✗ CEILING`, Approve disabled; Repair twice → Approve enabled only after round 2; free-text request in replay mode → `role="alert"` with the preset suggestion; rate limit: 11 rapid `request.post('/api/plan', …)` all sending one fresh unique `x-forwarded-for` (not the page's) → 11th is 429 with `Retry-After`; skipped when `E2E_SKIP_RATELIMIT=1`.
  4. Whole suite ≤90 s.
- Acceptance: `pnpm biome check src/components/MissionApp.tsx src/app/page.tsx e2e`, `pnpm build`, `pnpm e2e`

## Wave gate
- Commands: `pnpm lint && pnpm test && pnpm build && pnpm e2e && uv run --project sim pytest -q sim/tests`
- Review focus: `pnpm e2e` green covers the whole PLAN-00 §3 demo in replay mode with no env vars (zero Anthropic calls); specs assert behaviour, not implementation details; Approve impossible while violations exist; SYNTHETIC vs RECORDED label correct; clicking a finding seeks the player; no hydration warnings; no console errors; API errors visible, never silent.
