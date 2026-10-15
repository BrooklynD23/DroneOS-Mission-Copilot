# HANDOFF — WAVE-00 → WAVE-01

## What exists
- Next.js 16.4.1 app (App Router): `src/app/{layout,page,page.module.css}`, `globals.css`, favicon; `next.config.ts`; `next-env.d.ts` committed.
- `src/lib/env.ts`: `readEnv()` → `{mode:"replay"|"live", hasKey}`; live only with `ANTHROPIC_API_KEY` + `DEMO_ACCESS_CODE`; `timingSafeEqual` with length guard for codes; never returns secrets.
- Tooling: react 19.3.1, typescript 5.9.3, vitest 5.0.4 (80% thresholds on src/lib + src/app/api), @biomejs/biome 2.5.15 (`files.includes` skips schemas/, public/replays, .claude, docs etc), playwright (`use.baseURL`, webServer forces replay env, only when `BASE_URL` unset, 600s timeout for /mnt/c).
- `sim/` uv project: pyproject (shapely 2.2.0, jsonschema 4.26.0, mavsdk-grpc 4.0.5, pytest/ruff dev), `droneos_sim/__init__.py`, `tests/test_smoke.py`; `uv sync --project sim --locked` works.
- `.github/workflows/web.yml` (checkout@v6, setup-node@v6, upload-artifact@v4 only). `.env.example` placeholders. git initialized; commit `0a3b615`.

## Deviations
- `pnpm-workspace.yaml` uses `allowBuilds: {esbuild: true}` — pnpm 12 ignores `ignoredBuiltDependencies` (empirically verified; WAVE-00 spec text is stale but file itself is correct).
- playwright `webServer.timeout: 600_000` — cold next build on /mnt/c takes ~4.5 min.
- `ReactNode` prop type over LayoutProps helper; env param `Record<string,string|undefined>`.

## Warnings
- `export PATH=/home/danny/.nvm/versions/node/v24.22.0/bin:$PATH` first (default node v26; pnpm must be 12.11.2). /mnt/c I/O very slow — installs/e2e take minutes; never kill.
- biome `linter.rules.recommended` deprecated → `preset` (cosmetic warning).
- `pytest -q sim/tests` regenerates root `.coverage` — now gitignored.

## For WAVE-01 (contracts + shell)
- zod contracts live ONLY in `src/lib/schema/`; `pnpm schema:export` writes `schemas/` (gitignored from biome). Server re-parses client input; request text is untrusted → `<request>` wrapping.
