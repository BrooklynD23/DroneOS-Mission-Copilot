# WAVE-04 — API route, security headers, replay fixtures, replay loader/player
Depends on: WAVE-03
Human prerequisites: none

Deps pre-installed by WAVE-00.

## Tasks
### T04.1 — `/api/plan` route handler + security headers
- Files: `src/app/api/plan/route.ts`, `src/app/api/plan/route.test.ts`, `next.config.ts`
- Do:
  1. `export const runtime = 'nodejs'`; `export const maxDuration = 60` ([Vercel duration](https://vercel.com/docs/functions/configuring-functions/duration)).
  2. `GET` → `{ live_available: getServerConfig().liveConfigured }`. No secrets, no rate limit.
  3. `POST` order: rate limit by `clientIp` (429 + `Retry-After`) → `readJsonBody(req, MAX_BODY_BYTES)` → `PlanRequest.safeParse` (400 with field paths only, no echoed values) → `getScenario` (unknown → 400) → mode: code present and wrong → 401; `isLive` → anthropic, else replay (`selectProvider`).
  4. `plan`: `provider.plan` → `validate` → `{ ok: true, mode, model?, mission, validation }`.
  5. `repair`: server recomputes `validate(mission)`; already ok → return it unchanged; else `provider.repair({ …, violations, round })` → validate → respond.
  6. `report`: rebuild findings server-side with `buildFindings` from the committed replay when `public/replays/<id>/mission.json` equals the request mission; otherwise use client `evidence` (`// ponytail: client evidence trusted for captions only; no safety impact, captions still pass applyCaptions`). Then `provider.caption` → `applyCaptions` → `{ ok: true, mode, report }` (`generated_by` = `claude-haiku-5-5` in live, `template` in replay).
  7. `ReplayMissError` → 422 `replay_miss`; `UpstreamError` → 502 `upstream`; anything else → 500 generic. Log `console.error({ route: 'plan', op, code, cause: err.name })` — never the API key, access code or request text.
  8. `next.config.ts`: `headers()` for all routes: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`; in production only, `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` (add the host of `NEXT_PUBLIC_TILE_URL` to `img-src` when set). Also set `outputFileTracingIncludes: { '/api/plan': ['./public/replays/*/mission.json', './public/replays/*/telemetry.jsonl'] }` so the server can read committed missions and samples for `buildFindings` on Vercel; any read error → use client `evidence` ([docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)).
- Tests (write first, `route.test.ts`, mock `@/lib/llm/anthropic` with `vi.mock`, env via `vi.stubEnv`, a unique `x-forwarded-for` per test): GET shape in both modes; replay plan for `north-roof` preset → `geofence` violation; repair round 1 → ok; injection preset ("ignore the geofence…") → violations returned, never `ok: true` validation on the draft; unknown op / extra key / 501-char request → 400; 17 KB body → 413; bad JSON → 400; free text in replay mode → 422; wrong access code → 401; live mode uses mocked provider; upstream throw → 502 without leaking `cause`; 11th request from one IP → 429 with `Retry-After`.
- Acceptance: `pnpm vitest run src/app/api/plan`, `pnpm biome check src/app/api next.config.ts` (build runs in the wave gate)

### T04.2 — Replay generation script + committed synthetic replays
- Files: `scripts/synth-replays.ts`, `public/replays/**`, `src/lib/replay/fixtures.test.ts`
- Do:
  1. `scripts/synth-replays.ts`: for `north-roof` and `solar-east`, take the preset fixture's final valid mission (last `repairs` entry or `plan`), `synthReplay({ created: '2026-10-14T00:00:00.000Z' })`, `buildReport`, write `manifest.json`, `mission.json`, `telemetry.jsonl`, `report.json`, `frames/<id>.svg`. Second mode `--report <replay_dir> <scenario_id>` rebuilds only `report.json` from an existing (e.g. recorded) replay — used by HUMAN-05. Refuse to overwrite a replay whose manifest says `recorded-sitl` unless `--force`.
  2. Run `pnpm replays:synth`; commit outputs (keep total under 5 MB).
- Tests (write first, `fixtures.test.ts`, reads files with `node:fs`): each manifest/mission/report parses; every telemetry line parses; mission deep-equals the fixture's final mission and `validate` is ok; every evidence `frame_id` has a file on disk; `north-roof` report has ≥1 observed and ≥1 abstained finding.
- Acceptance: `pnpm replays:synth && cat public/replays/*/telemetry.jsonl public/replays/*/report.json | sha256sum > /tmp/replays.sha && pnpm replays:synth && cat public/replays/*/telemetry.jsonl public/replays/*/report.json | sha256sum | diff - /tmp/replays.sha` (deterministic), `pnpm vitest run src/lib/replay/fixtures.test.ts`, `uv run --project sim python -m droneos_sim.oracle public/replays/north-roof src/data/scenarios/north-roof.json`, `uv run --project sim python -m droneos_sim.oracle public/replays/solar-east src/data/scenarios/solar-east.json`

### T04.3 — Replay loader + player state (pure)
- Files: `src/lib/replay/load.ts`, `src/lib/replay/load.test.ts`, `src/lib/replay/player.ts`, `src/lib/replay/player.test.ts`
- Do:
  1. `load.ts`: `loadReplay(scenarioId, fetchFn = fetch)` → `{ manifest, mission, samples, frames, report }`; zod-parse each file; JSONL error names the line number; `frames` derived from samples (`url = /replays/<id>/frames/<id>.<ext>`); 404 manifest → `null` (no recorded replay). `replayFromSynth(output)` → same shape with frame `url` = `data:image/svg+xml;charset=utf-8,` + `encodeURIComponent(svg)`.
  2. `player.ts`: `pickSource(approved, recorded)` → `'recorded' | 'synthesize'` by deep equality; `sampleAt(samples, t)` binary search + linear interpolation (lat, lon, alt, battery); `frameAt(frames, t)` = last frame ≤ t; `timeOfFrame(frames, id)`; `advance(t, dtMs, speed: 1|2|4, duration)` clamped.
- Tests (write first): fake `fetchFn` for good, 404, and corrupt-line cases; interpolation midpoint; `frameAt` before first frame → `undefined`; `advance` clamps at duration; `pickSource` equal vs one changed waypoint.
- Acceptance: `pnpm vitest run src/lib/replay/load.test.ts src/lib/replay/player.test.ts`, `pnpm biome check src/lib/replay/load.ts src/lib/replay/player.ts`

## Wave gate
- Commands: `pnpm lint && pnpm test && pnpm build && uv run --project sim pytest -q sim/tests && uv run --project sim python -m droneos_sim.oracle public/replays/north-roof src/data/scenarios/north-roof.json && uv run --project sim python -m droneos_sim.oracle public/replays/solar-east src/data/scenarios/solar-east.json`
- Review focus: every public-endpoint boundary (size, schema, rate limit, access code) tested; server never trusts client geometry or client violations; no secret or request text in logs or responses; CSP allows only needed origins; replays deterministic, small, and accepted by the independent Python oracle; loader fails closed on corrupt data.
