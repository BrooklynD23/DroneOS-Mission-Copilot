# WAVE-07 — Deployed-URL E2E, E2E workflow, release review
Depends on: WAVE-06
Human prerequisites: HUMAN-02

HUMAN-02 (Vercel deploy) is listed only so the gate can run E2E against the public URL. The demo specs were written and passed in WAVE-06 (T06.1); everything in these tasks also passes locally without HUMAN-02 (Playwright starts its own replay-mode server when `BASE_URL` is unset). Deps and Playwright Chromium pre-installed by WAVE-00.

## Tasks
### T07.1 — Deployed-run mode for the E2E suite
- Files: `playwright.config.ts`, `e2e/deployed.spec.ts`
- Do:
  1. `playwright.config.ts`: when `BASE_URL` is set, no `webServer`, `retries: 1`, `workers: 2`; when unset, unchanged.
  2. `e2e/deployed.spec.ts` (runs only when `BASE_URL` is set, `test.skip` otherwise): `GET /api/plan` returns exactly the key `live_available` (no other fields, no secret-looking strings); response headers include `content-security-policy` with `frame-ancestors 'none'` and `x-content-type-options: nosniff`; `/replays/north-roof/manifest.json` is served; `E2E_EXPECT_LIVE=1` requires `live_available: true`.
- Tests: `e2e/deployed.spec.ts` is the test (write first; it fails until pointed at a deployed URL with headers from T04.1).
- Acceptance: `pnpm biome check playwright.config.ts e2e/deployed.spec.ts`, `pnpm exec playwright test --list` (full local E2E runs in the wave gate; deployed spec skipped locally)

### T07.2 — E2E workflow against the deployed URL
- Files: `.github/workflows/e2e.yml`
- Do:
  1. Job `deployed` on `workflow_dispatch` and `deployment_status` (state `success` only): `actions/checkout@v6`, `actions/setup-node@v6` (`.nvmrc`), `npm i -g pnpm@12.11.2`, `pnpm install --frozen-lockfile`, `pnpm exec playwright install --with-deps chromium`, then `pnpm e2e` with env `BASE_URL: ${{ vars.DEMO_URL }}`, `E2E_SKIP_RATELIMIT: 1`; upload `playwright-report/` on failure (`actions/upload-artifact@v4`). Uses a repo **variable**, not a secret ([GitHub variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables)). Local-server E2E already runs in `web.yml`.
- Tests: workflow commands are the same ones run locally in the gate.
- Acceptance: `test -f .github/workflows/e2e.yml`, `grep -q "pnpm e2e" .github/workflows/e2e.yml`, `grep -q "vars.DEMO_URL" .github/workflows/e2e.yml`

## Wave gate
- Commands: `pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build && pnpm e2e && uv sync --project sim --locked && uv run --project sim ruff check sim && uv run --project sim ruff format --check sim && uv run --project sim pytest -q sim/tests && test -n "$DEMO_URL" && BASE_URL="$DEMO_URL" E2E_SKIP_RATELIMIT=1 pnpm e2e`
- Review focus: release readiness — full suites green locally and against the deployed URL; secret scan `git grep -nE "(sk-|api[_-]?key|secret).{0,4}[:=]"` finds only `.env.example` names; `.env*` ignored; deployed `GET /api/plan` reveals no secrets; replay mode needs zero keys; README demo link filled; every `docs/HUMAN-*` marked done or pending in `docs/STATUS.md`; coverage ≥80% on both sides; no dependency outside PLAN-01 §7.
