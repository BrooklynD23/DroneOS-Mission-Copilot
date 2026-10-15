# AGENT.md — DroneOS Mission Copilot

## Mission
A hosted web MVP where an operator types an inspection request ("Inspect the north roof, stay below 40 m"), Claude drafts a typed mission, a deterministic validator checks geofence, ceiling, no-fly, battery and limits, the LLM (≤2 rounds) or a deterministic fix repairs it, the operator approves a visible diff, and a recorded or synthetic flight replays with an evidence-linked report. Simulation only; the LLM never touches flight controls. Works with zero keys (replay mode). Details: [PLAN-00](docs/PLAN-00-overview.md).

## Stack (pinned; full table with links in [PLAN-01 §7](docs/PLAN-01-architecture.md))
| Area | Pins |
|---|---|
| Runtime | Node 24 LTS, pnpm 12.11.2, Python 3.12, uv 0.13.1 |
| Web | next 16.4.1 (App Router), react 19.3.1, typescript 5.9.3, plain CSS modules |
| Map | leaflet 1.9.4 (direct, no react-leaflet), @geoman-io/leaflet-geoman-free 2.20.2 |
| Logic | zod 4.6.7, @turf/* 7.4.0, @anthropic-ai/sdk 0.134.0 |
| Test/lint | vitest 5.0.4 (+coverage-v8, vite 8.3.4), @playwright/test 1.64.1, @biomejs/biome 2.5.15, tsx 4.23.15 |
| Sim | shapely 2.2.0, jsonschema 4.26.0, mavsdk-grpc 4.0.5, pytest 9.1.1, pytest-cov 7.1.0, ruff 0.17.0, PX4 image `px4io/px4-sitl-gazebo:v1.18.0-rc1` |
| Models | `claude-sonnet-5-5` (plan/repair), `claude-haiku-5-5` (report captions) |
| Host | Vercel Hobby (non-commercial) |

## Repo layout
```
src/app/            page + api/plan/route.ts
src/components/     props-only React components (+ .module.css)
src/lib/schema/     zod contracts (single source of truth)
src/lib/validator/  deterministic checks + 100 cases
src/lib/{repair,llm,http,replay,report,ui}/  logic with tests
src/lib/{env,flow,scenarios,api-client}.ts
src/data/scenarios/ scenario JSON
schemas/            JSON Schema exported from zod (committed)
public/replays/     <scenario>/{manifest,mission,telemetry.jsonl,report,frames/}
scripts/            export-schema.ts, synth-replays.ts
e2e/                Playwright
sim/                Python: droneos_sim/{contract,geo,oracle,fly,frames,sitl}.py, tests/, compose.yaml
docs/               PLAN, WAVE, HUMAN, RESEARCH, STATUS
```

## Commands
| Task | Command |
|---|---|
| Install | `pnpm install --frozen-lockfile && pnpm exec playwright install chromium && uv sync --project sim` |
| Dev (replay mode) | `pnpm dev` → http://localhost:3000 |
| Dev (live) | put `ANTHROPIC_API_KEY`, `DEMO_ACCESS_CODE` in `.env.local` ([HUMAN-01](docs/HUMAN-01-anthropic-key-spend-cap.md)) |
| Unit tests + coverage | `pnpm test` (one file: `pnpm vitest run src/lib/validator`) |
| Lint + types | `pnpm lint` (Biome + `tsc --noEmit`); fix format: `pnpm format` |
| Build | `pnpm build` |
| E2E | `pnpm e2e` (own server, replay mode); deployed: `BASE_URL=$DEMO_URL E2E_SKIP_RATELIMIT=1 pnpm e2e` |
| Export schemas | `pnpm schema:export` (CI fails on drift) |
| Regenerate replays | `pnpm replays:synth`; rebuild a report: `pnpm replays:synth --report <dir> <scenario>` |
| Python tests/lint | `uv run --project sim pytest -q sim/tests`, `uv run --project sim ruff check sim`, `uv run --project sim ruff format --check sim` |
| Oracle | `uv run --project sim python -m droneos_sim.oracle public/replays/<id> src/data/scenarios/<id>.json` |
| SITL (local only) | `docker compose -f sim/compose.yaml up`; then `uv run --project sim python -m droneos_sim.sitl --scenario … --mission … --out …` ([HUMAN-05](docs/HUMAN-05-record-sitl-replays.md)) |

## Conventions
1. Contracts change only in `src/lib/schema`; run `pnpm schema:export` and commit `schemas/`.
2. Logic lives in `src/lib` with a test next to it; components hold no logic.
3. Pure modules: no `Date.now`, randomness, network or fs (pass them in).
4. Immutable updates; `.strict()` zod objects; exact version pins; no new deps without a PLAN-01 §7 row.
5. Server trusts nothing from the client: re-parse with zod, load scenario by id, recompute validation.
6. Request text is untrusted data: always inside `<request>…</request>`, never in the system prompt.
7. Labels are honest: `LIVE`/`REPLAY`, `RECORDED SITL`/`SYNTHETIC`, `LLM repair`/`DETERMINISTIC FIX`, playback speed.
8. Deliberate shortcuts carry a `ponytail:` comment naming the ceiling and upgrade path.
9. Secrets only via env; never log keys, access codes or request text.
10. Status is text + icon, never colour alone; every input labelled.

## Quality bar
- `pnpm lint && pnpm test && pnpm build && pnpm e2e` and the sim commands exit 0.
- Coverage ≥80% (vitest thresholds on `src/lib/**`, `src/app/api/**`; pytest-cov on `droneos_sim`, `sitl.py` omitted).
- Validator: 100% on 50 valid + 50 invalid cases. Oracle passes on every committed replay.
- Public endpoint: size cap, zod, rate limit, access code — each tested.

## Loop kit
| Piece | Path | Model |
|---|---|---|
| Researcher | `.claude/agents/loop-researcher.md` | haiku |
| Planner | `.claude/agents/loop-planner.md` | opus |
| Implementer | `.claude/agents/loop-implementer.md` | sonnet |
| Reviewer | `.claude/agents/loop-reviewer.md` | opus |
| Workflow | `.claude/workflows/loop-build.js` | — |

Run: ask Claude Code "run the loop-build workflow", or `Workflow({name:'loop-build', args:{from:0}})` (args: `from`, `to`, `maxFix`). It builds `docs/WAVE-*.md` in order, stops on unmet `Human prerequisites`, commits each passed wave and updates `docs/STATUS.md`. Never edit `.claude/` from a task.

## Where to look
| Need | Doc |
|---|---|
| Scope, demo script, metrics, risks, hours | [PLAN-00](docs/PLAN-00-overview.md) |
| Components, contracts, tree, stack, provider, security | [PLAN-01](docs/PLAN-01-architecture.md) |
| Wave map | [PLAN-02](docs/PLAN-02-waves.md), [STATUS](docs/STATUS.md) |
| Task details | `docs/WAVE-00…07-*.md` |
| Human-only setup | `docs/HUMAN-01…06-*.md` |
| Version/link evidence | [RESEARCH-01](docs/RESEARCH-01-web-stack-hosting.md), [RESEARCH-02](docs/RESEARCH-02-sim-stack.md), [RESEARCH-03](docs/RESEARCH-03-repo-answers-deepwiki.md) |
