# STATUS

| Wave | Status | Last gate result |
|---|---|---|
| WAVE-00 bootstrap | passed | gate ok 2026-10-14 @0a3b615 (r2, .gitignore .coverage fix) |
| WAVE-01 contracts-and-shell | passed | gate ok 2026-10-14 @2ca33d5 |
| WAVE-02 core-logic | passed | gate ok 2026-10-15 @da0c9e8 (r2) |
| WAVE-03 llm-repair-report-sim | passed | gate ok 2026-10-15 @7ca8b21 (r3) |
| WAVE-04 api-and-replays | passed | gate ok 2026-10-15 @6d9c53b (r2) |
| WAVE-05 ui-components | passed | gate ok 2026-10-15 @051191b (r2) |
| WAVE-06 integration | passed | gate ok 2026-10-15 @447a4c0 |
| WAVE-07 e2e-deploy-release | todo | — |

| Human doc | Status |
|---|---|
| HUMAN-01 anthropic-key-spend-cap | pending |
| HUMAN-02 vercel-deploy | pending |
| HUMAN-03 github-repo-actions | pending |
| HUMAN-04 docker-wsl2-sitl | pending |
| HUMAN-05 record-sitl-replays | pending |
| HUMAN-06 demo-video-dns | pending |

## Log

## Cross-review 2026-10-14
- WAVE-01 T01.2: dropped `pnpm build` + `pnpm e2e` from task acceptance (collide with T01.1 edits); `playwright test --list` instead; both stay in the wave gate.
- WAVE-04 T04.1: dropped `pnpm build` from task acceptance (gate runs it); `outputFileTracingIncludes` now also traces `telemetry.jsonl` (`buildFindings` needs samples) and read errors fall back to client evidence.
- WAVE-07 T07.1: acceptance `pnpm e2e` -> `playwright test --list`; full E2E stays in the wave gate.
- HUMAN-03: step 4 no longer expects `e2e` to run on push (it triggers on `deployment_status`); step 5 clarifies required checks are job names from `web`/`sim`.
- WAVE-01 T01.1 + gate: schema drift check now stages output, regenerates, then diffs (was trivially passing on untracked files).

## Replans
| 2026-10-14 | T00.1 | added pnpm-workspace.yaml to Files + ignoredBuiltDependencies step | pnpm 12 ignores package.json pnpm field; ERR_PNPM_IGNORED_BUILDS blocked install |
