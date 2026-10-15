# DroneOS Mission Copilot

**Live demo:** `<DEMO_URL — set in HUMAN-02>` · **Video:** `<DEMO_VIDEO_URL — set in HUMAN-06>`

Type an inspection request. Claude drafts a drone mission, a deterministic validator checks geofence, ceiling, no-fly zones and battery, the mission is repaired and shown as a diff, you approve it, and a recorded PX4 SITL (or labelled synthetic) flight replays with a report whose every finding cites frame IDs. Simulation only; the LLM never flies the drone.

Works with no API key (REPLAY mode, recorded fixtures). LIVE mode needs `ANTHROPIC_API_KEY` + `DEMO_ACCESS_CODE`.

## Run locally
1. Node 24, pnpm 12.11.2, Python 3.12, uv 0.13.1.
2. `pnpm install --frozen-lockfile && pnpm exec playwright install chromium && uv sync --project sim`
3. `pnpm dev` → http://localhost:3000 (REPLAY mode).
4. Optional LIVE mode: `cp .env.example .env.local`, fill both vars ([HUMAN-01](docs/HUMAN-01-anthropic-key-spend-cap.md)).
5. Checks: `pnpm lint && pnpm test && pnpm build && pnpm e2e && uv run --project sim pytest -q sim/tests`
6. Local PX4 SITL recording: [HUMAN-04](docs/HUMAN-04-docker-wsl2-sitl.md), [HUMAN-05](docs/HUMAN-05-record-sitl-replays.md).

## Docs
| Doc | What |
|---|---|
| [AGENT.md](AGENT.md) | Stack, commands, conventions |
| [PLAN-00](docs/PLAN-00-overview.md) | Scope, demo script, risks, hours |
| [PLAN-01](docs/PLAN-01-architecture.md) | Architecture and contracts |
| [PLAN-02](docs/PLAN-02-waves.md) | Build waves; [STATUS](docs/STATUS.md) |
| `docs/HUMAN-*` | Human-only setup (keys, Vercel, GitHub, Docker, SITL, video) |

Limitations: one site, three preset scenarios; seeded points of interest instead of a detector; free-text requests need LIVE mode.
