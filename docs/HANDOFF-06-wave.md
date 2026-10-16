# HANDOFF 06 — Integration

## What now exists
- `src/app/page.tsx`: server page, renders `MissionApp` with `listScenarios()` and tile URL (`NEXT_PUBLIC_TILE_URL` or `DEFAULT_TILE_URL` from `src/lib/env.ts`).
- `src/components/MissionApp.tsx` (+ `.module.css`): client component, wires full loop: plan -> validate -> repair/diff -> approve -> replay -> report. Uses lib helpers: flow, repair, replay, report, validator, api-client. MapView via `next/dynamic` (`ssr:false`). Approve guarded by `validation.ok` and disabled state.
- API: `GET/POST src/app/api/plan/route.ts` (health + plan, rate-limited, 429 + Retry-After on request 11).
- E2E: `e2e/demo.spec.ts`, `e2e/injection.spec.ts`, `e2e/smoke.spec.ts`, `e2e/helpers.ts`.
- Commands: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm e2e`, `uv run --project sim pytest -q sim/tests`.

## Deviations from plan
- T06.1: none (tasks passed review in previous run).
- `playwright.config.ts`: `reuseExistingServer` set `false` (was `!process.env.CI`). Guarantees empty `ANTHROPIC_API_KEY` (zero Anthropic calls). Cost: every local run rebuilds.

## Known warnings
- Gate: lint 0 errors, 3 unused-var warnings, 1 biome migrate info.
- Coverage: stmts 98.38, branches 93.51, funcs 99.41, lines 99.33. Sim pytest 35 passed, 97.47%.
- e2e 10/10 in replay mode; suite 5.3 min wall (almost all webServer build), tests ~6 s.
- `e2e/demo.spec.ts`: `getByText(/HVAC 3/)` only proves POI mentioned, not that hvac-3 is an abstention. Match abstention text or row role.
- `MissionApp.tsx` onApprove: `catch {}` drops error object; synthReplay/buildReport bugs show generic 'Could not load the replay'. Add `console.error(e)` in dev or keep cause.
- Rate-limit spec checks only request 11 -> 429 + Retry-After, not that 1-10 were not 429 (route tests cover it).

## Next wave must know
- WAVE-07: e2e runs in replay mode with `ANTHROPIC_API_KEY` and `DEMO_ACCESS_CODE` empty; set `BASE_URL` to skip the local webServer build (e.g. against a deployed URL).
- Reuse `DEFAULT_TILE_URL`; do not duplicate lib helpers in UI.
- Secret scan clean (matches only docs, var names, fixture 'abc123', lockfile js-tokens).
