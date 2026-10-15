Verdict: PASS

# REVIEW-02 — Adversarial plan review, round 2

Reviewed 2026-10-14 after the planner's round-1 fixes. All 4 round-1 blockers are fixed; no new blocking regressions. 4 non-blocking items below.

## Round-1 blockers re-verified

| # | Blocker | Result | Evidence |
|---|---|---|---|
| B1 | Biome reformats generated `schemas/*.json` | FIXED | `WAVE-00-bootstrap.md:15` excludes `schemas`; review focus `WAVE-00:38` |
| B2 | Demo flow untested until WAVE-07; WAVE-07 couldn't fix app code | FIXED | Specs moved into T06.1 Files `WAVE-06:9`, write-first/see-fail `WAVE-06:19`, acceptance `pnpm e2e` `WAVE-06:24`; manual pass replaced by `pnpm e2e` `WAVE-06:28` |
| B3 | Rate-limit E2E shares the `unknown` key with the demo E2E | FIXED | `uniqueIp` + `setExtraHTTPHeaders` per test `WAVE-06:20`; rate test uses its own fresh IP `WAVE-06:22` |
| B4 | Per-task pytest subsets fail `--cov-fail-under=80` | FIXED | `--no-cov` at `WAVE-02:66`, `WAVE-03:56`; note at `WAVE-00:29` |

## Structure

| Item | Result | Evidence |
|---|---|---|
| AGENT.md ≤120 lines + Loop kit | PASS | 88 lines; `AGENT.md:69-78` |
| CLAUDE.md is exactly `@AGENT.md` | PASS | 1 line |
| README ≤30 lines | PASS | 26 lines |
| PLAN-00/01/02 | PASS | present; WAVE-06/07 rows updated `PLAN-02:15-16`; hours updated `PLAN-00:87-88` (code subtotal still 102) |
| WAVE-00 first; final wave = deploy + E2E + release review | PASS | `WAVE-07:1,24-25`; release phase `loop-build.js:172-178` |
| WAVE format | PASS | all 8 waves keep header / Depends on / Human prerequisites / `## Tasks` / `### TNN.n —` / Files-Do-Tests-Acceptance / `## Wave gate` Commands + Review focus; `- Files:` count equals `### T` count in every wave (2,2,5,5,3,6,1,2) |
| HUMAN docs | PASS | HUMAN-02 adds corepack `HUMAN-02:15` and `DEMO_URL` export before Claude Code starts `HUMAN-02:18` |
| STATUS.md table | PASS | unchanged |

## Checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | URL web app; zero-key replay demo; live mode documented | PASS | `PLAN-00:52-61`, `HUMAN-01`, `HUMAN-02:15-17` |
| 2a | Acceptance + gate commands in every wave | PASS | every task/wave |
| 2b | File-disjoint within each wave | PASS | WAVE-06 has 1 task; WAVE-07 T07.1 `playwright.config.ts`, `e2e/deployed.spec.ts` vs T07.2 `e2e.yml` (`WAVE-07:9,17`); `playwright.config.ts` (T00.1) and `web.yml` (T00.1, T01.1) are edited only in different waves |
| 2c | Acyclic; no same-wave created-file dependency | PASS | linear W0→W7; T07.1 edits a file from WAVE-00, not from a sibling |
| 2d | Acceptance runnable when reached | PASS | Playwright Chromium installed in WAVE-00 `WAVE-00:14` (local) and in CI `WAVE-00:21`, before WAVE-06 `pnpm e2e`; `webServer` builds and starts in replay mode `WAVE-00:17`; deployed spec is skipped without `BASE_URL` `WAVE-07:12,14` |
| 3 | TDD per task; 80% coverage; Playwright demo E2E in final wave | PASS | demo specs written first in T06.1; the final gate runs them locally and against `$DEMO_URL` `WAVE-07:24` |
| 4 | Human steps off the code critical path | PASS | only WAVE-07 lists HUMAN-02 (deploy wave) |
| 5 | Ponytail deps justified; security | PASS | `PLAN-01:179-218`; report op now rebuilds evidence server-side `WAVE-04:16`; deployed spec checks headers and that the GET response leaks nothing `WAVE-07:12` |
| 6 | Versions/links real | PASS | round-1 spot check (6 npm, 4 PyPI, Docker tag, 4 links) is still valid; no pins changed |
| — | Demo story fully delivered | PASS | geofence ✗ → repair diff → replay → evidence report, end to end in `e2e/demo.spec.ts` `WAVE-06:21` |
| — | Hours sane | PASS | 152 h at 48 h/week → 3.2 weeks of capacity, 4 calendar weeks planned |

## Blocking issues

None.

## Non-blocking

1. `WAVE-04:16`: the report op reads `public/replays/<id>/mission.json` on the server. Vercel functions don't bundle `public/` by default, so the read can fail in production (live mode only). The client already falls back to template captions (`WAVE-06:16`). Fix: add `outputFileTracingIncludes: { '/api/plan': ['./public/replays/**/*.json', './public/replays/**/*.jsonl'] }` to `next.config.ts` (T04.1 already owns it), or treat any read error as "use client evidence".
2. `HUMAN-03:15`: branch protection requires `e2e / local`, but that job was removed; local E2E now runs in `web.yml`. With protection on, merges would wait forever. Change it to require `web` and `sim`.
3. `WAVE-06:20`: `uniqueIp` hashes into `203.0.113.<n>` (254 slots), so collisions are possible. Use `1 + (testInfo.parallelIndex * 50 + testInfo.retry * 10 + hash % 10) % 254`, or build the last two octets from `10.<worker>.<hash>`; low risk.
4. `PLAN-01:149` and `AGENT.md:30`: the repo tree omits `e2e/helpers.ts`, `e2e/deployed.spec.ts` and `e2e/smoke.spec.ts`. Doc-only.
5. Round-1 item 7 (actionlint) was skipped as flaky. Accepted.

## Links / versions

No pins or links changed since round 1. The round-1 results stand (REVIEW-01, last table): next 16.4.1, pnpm 12.11.2, vitest 5.0.4, @anthropic-ai/sdk 0.134.0, zod 4.6.7, biome 2.5.15, mavsdk-grpc 4.0.5, uv 0.13.1, shapely 2.2.0, pytest-cov 7.1.0, `px4io/px4-sitl-gazebo:v1.18.0-rc1`, plus 4 links that returned 200.
