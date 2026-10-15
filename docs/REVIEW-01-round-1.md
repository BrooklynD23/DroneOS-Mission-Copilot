Verdict: FAIL

# REVIEW-01 — Adversarial plan review, round 1

Reviewed 2026-10-14: AGENT.md, CLAUDE.md, README.md, docs/PLAN-00/01/02, WAVE-00…07, HUMAN-01…06, STATUS.md, RESEARCH-01…03 (skimmed), `.claude/workflows/loop-build.js`, `.claude/agents/*.md`.
4 blocking issues. All are small doc edits; no rearchitecture needed.

## Structure

| Item | Result | Evidence |
|---|---|---|
| AGENT.md ≤120 lines + Loop kit (haiku/opus/sonnet/opus, workflow path, run phrases) | PASS | 88 lines; `AGENT.md:69-78` |
| CLAUDE.md is exactly `@AGENT.md` | PASS | `CLAUDE.md:1`, 1 line |
| README ≤30 lines | PASS | 26 lines |
| PLAN-00/01/02 present | PASS | `docs/PLAN-0{0,1,2}-*.md` |
| WAVE-00 bootstrap first; final wave = deploy + E2E + release review | PASS | `WAVE-00-bootstrap.md:1`; `WAVE-07…:1,27-28`; release phase `loop-build.js:172-178` |
| WAVE format (header, Depends on, Human prerequisites, Tasks, Files/Do/Tests/Acceptance, Wave gate Commands/Review focus) | PASS (nit) | All 8 waves; extra prose paragraph between header and `## Tasks` (e.g. `WAVE-00:5`) — tolerated by the LLM parser |
| HUMAN docs (needed-before, numbered steps, URLs, env vars, verification, cost) | PASS | `HUMAN-01…06`, each has table + `## Steps` + `## Verification` |
| STATUS.md table | PASS | `STATUS.md:3-21` |

## Checklist

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Web app by URL; zero-key hosted demo (replay); live mode documented | PASS | `PLAN-00:52-61`, `PLAN-01:173`, `HUMAN-01`, `HUMAN-02:15-16` |
| 2a | Every wave has acceptance + gate commands | PASS | every task has `- Acceptance:`; every wave `## Wave gate` |
| 2b | Tasks file-disjoint within wave | PASS | checked all globs incl. `package.json`/lockfiles (only T00.1/T00.2), `web.yml` (T00.1 then T01.1 in a later wave), `src/lib/replay/*` split T04.2/T04.3 by file, `sim/tests/fixtures/**` only T02.5 |
| 2c | Dependencies acyclic; no same-wave created-file dependency | PASS | linear W0→W7 (`PLAN-02:21`); T02.3 explicitly avoids validator (`WAVE-02:42`), T03.2 avoids llm fixtures (`WAVE-03:27`) |
| 2d | Acceptance commands runnable and passable at that point | **FAIL** | Biome vs generated JSON (B1); per-task pytest subsets trip `--cov-fail-under=80` (B4); rate-limit E2E collides with demo E2E (B3) |
| 3 | TDD tests named per task; 80% enforced; Playwright demo E2E in final wave | **FAIL** (partial) | thresholds `WAVE-00:16,29`; demo E2E `WAVE-07:12-13` — but demo flow has no test before/with its implementation and WAVE-07 cannot fix app code (B2) |
| 4 | Human steps in HUMAN docs, off code critical path | PASS | `PLAN-02:30-39`; only WAVE-07 lists HUMAN-02 (by design: deploy wave) |
| 5 | Ponytail: deps justified one line each; no extra services | PASS | `PLAN-01:179-206` |
| 5 | Security: env secrets, boundary validation, rate limit | PASS | `PLAN-01:208-218`, `WAVE-02:48-55`, `WAVE-04:13-19` |
| 6 | Versions/links real | PASS | see spot-check table |
| — | Demo story fully delivered | PASS (with B2 risk) | geofence ✗ fixture `WAVE-03:16`, repair+diff `WAVE-03:21-26`, replay `WAVE-04:22-36`, evidence report `WAVE-03:30-35`, wiring `WAVE-06:8-18`, E2E `WAVE-07:12` |
| — | Hours sane (4 × 12 h = 48 h/week) | PASS | 152 h total → 3.2 weeks capacity, 4 calendar weeks planned (`PLAN-00:75-105`) |

## Blocking issues

1. **Biome formatting fails on generated JSON Schema files (WAVE-01 gate cannot pass).**
   - Location: `WAVE-00-bootstrap.md:15` (biome `files.includes` exclusions) vs `WAVE-01…:13` (export with `JSON.stringify(…, 2)`) and gate `WAVE-01…:30` (`pnpm lint` = `biome check .`).
   - Problem: verified with `@biomejs/biome@2.5.15`: it collapses `"required": [\n "a",\n "b"\n]` to `["a", "b"]`, so `biome check .` errors on every `schemas/*.schema.json`. Running `biome format --write` makes the drift check (`git diff --exit-code schemas/`) fail instead. `biome.json` is owned by T00.1, so neither T01.1 nor the WAVE-01 gate-fix agent may edit it. Loop stops at WAVE-01.
   - Fix: in `WAVE-00-bootstrap.md:15` add `schemas` to the biome exclusion list (alongside `public/replays`). Add to the WAVE-00 review focus: "biome ignores generated `schemas/`".

2. **Demo flow has no test until WAVE-07, and WAVE-07 cannot fix app code.**
   - Location: `WAVE-06-integration.md:19,24` ("adds no new pure logic", "full manual pass"), `WAVE-07…:9,15`.
   - Problem: (a) TDD broken: T07.1 says specs "must fail before WAVE-06 behaviour" but WAVE-06 is already merged, so they can never be seen failing. (b) The WAVE-06 reviewer (`loop-reviewer`: Read/Grep/Glob/Bash only) cannot do a "manual pass" in a browser. (c) If any demo spec fails because of `MissionApp.tsx`, the WAVE-07 implementer and gate-fixer may only edit `e2e/*` and `e2e.yml` → loop blocks at the last wave.
   - Fix: move `e2e/demo.spec.ts`, `e2e/injection.spec.ts`, `e2e/helpers.ts` into T06.1 Files and Tests ("write first"), make T06.1 Acceptance `pnpm e2e` (all specs), and replace "full manual pass" with "`pnpm e2e` green". WAVE-07 keeps: T07.1 = deployed-run config/assertions (e.g. `E2E_EXPECT_LIVE`, `E2E_SKIP_RATELIMIT` handling) + T07.2 `e2e.yml`; the final gate still runs the demo E2E locally and against `$DEMO_URL`, so checklist item 3 stays satisfied.

3. **Rate-limit E2E shares one limiter key with the demo E2E → 429s and flaky/failed gate.**
   - Location: `WAVE-07…:13`, `WAVE-02:52` (`clientIp` falls back to `'unknown'`), `WAVE-00:17` (Playwright default parallel workers).
   - Problem: locally `next start` gets no `x-forwarded-for`, so every request (demo UI, injection UI, the 11 rapid calls) uses key `unknown`, limit 10/min. Running in parallel, the 11-call test exhausts the bucket and the demo's Plan/Repair get 429; the rate-limit test's own "first 10 OK" also fails after the UI tests' calls.
   - Fix: in `e2e/helpers.ts` add `uniqueIp(testInfo)` and set `page.setExtraHTTPHeaders({ 'x-forwarded-for': '203.0.113.<n>' })` per test; the rate-limit test sends its own unique `x-forwarded-for` on all 11 `request.post` calls. (Vercel overwrites `x-forwarded-for`, so this has no prod effect; the test is already skipped there.)

4. **Per-task pytest subsets fail the global 80% coverage gate.**
   - Location: `WAVE-00:29` (`addopts … --cov-fail-under=80`) with subset Acceptance in `WAVE-03:56` (`pytest -q sim/tests/test_fly.py sim/tests/test_frames.py`) and `WAVE-02:66`.
   - Problem: a subset run still measures all of `droneos_sim`; in T03.5 `oracle.py` is only exercised via the subprocess CLI (not measured; pytest-cov 7 dropped automatic subprocess coverage), so total drops below 80 and the task review fails for code the task does not own.
   - Fix: append `--no-cov` to every per-task pytest Acceptance command (`WAVE-02:66`, `WAVE-03:56`); keep coverage enforced by the full-suite wave gates.

## Non-blocking

1. `WAVE-03:53` `sitl.py` never sets `RTL_RETURN_ALT`; PX4 default (60 m) exceeds the 40 m `north-roof` ceiling, so a real recording will fail the oracle in `RTL`. Set it to `ceiling_m − 5` and read back, like `GF_ACTION`. Also call `mission.set_return_to_launch_after_mission(True)`.
2. `WAVE-06:11` "server component … `next/dynamic` with `ssr: false`" — not allowed in Server Components in Next 15+. Say: load `MapView` via `next/dynamic({ ssr: false })` inside `MissionApp.tsx` (or drop it; MapView already imports Leaflet in `useEffect`).
3. `HUMAN-02:13` pnpm 12 on Vercel: add step "set `ENABLE_EXPERIMENTAL_COREPACK=1` in Vercel env" so the `packageManager` pin is honoured instead of the lockfile-detected pnpm.
4. `PLAN-00:103` says HUMAN-05 starts after WAVE-03; `HUMAN-05:6` and `PLAN-02:23` say WAVE-04. Align on WAVE-04.
5. `PLAN-00:35` demo text "@ 38 m" vs fixture waypoints at 35 m (`WAVE-03:16`); change to "35 m" so E2E/text assertions match.
6. `WAVE-04:15-16` report op trusts client-sent `evidence`; captions are checked only against it. Rebuild findings server-side from the scenario's committed replay when available, or note `ponytail:` (captions only, no safety impact).
7. `WAVE-07:23` T07.2 acceptance is greps only; add `pnpm dlx @action-validator/cli` or `actionlint` if cheap, else fine.
8. `WAVE-07:3` / `loop-build.js:143` — the plan agent runs HUMAN-02 verification in its own shell; `$DEMO_URL` must be exported before Claude Code starts. Add that line to HUMAN-02 step 4.
9. `WAVE-07:21` `actions/upload-artifact@v4` while checkout/setup-node use v6; fine, but pin consistently.

## Links / versions spot-checked (2026-10-14)

| Check | Result |
|---|---|
| npm `next` latest | 16.4.1 ✓ |
| npm `pnpm` latest | 12.11.2 ✓ |
| npm `vitest` latest | 5.0.4 ✓ |
| npm `@anthropic-ai/sdk` latest | 0.134.0 ✓ |
| npm `zod` / `@biomejs/biome` latest | 4.6.7 / 2.5.15 ✓ |
| PyPI `mavsdk-grpc` 4.0.5 / `uv` 0.13.1 / `shapely` 2.2.0 / `pytest-cov` 7.1.0 | all exist ✓ |
| Docker Hub `px4io/px4-sitl-gazebo:v1.18.0-rc1` | tag present ✓ (no `v1.17.0` release tag, as PLAN-01 says) |
| https://vercel.com/docs/plans/hobby | 200 ✓ |
| https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 200 ✓ |
| PX4 `geofence_params.yaml` raw link | 200 ✓ |
| MAVSDK-Python `examples/geofence.py` | 200 ✓ |
| Biome 2.5.15 on `JSON.stringify(…,2)` output | reformats arrays → basis of B1 |
