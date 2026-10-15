# HANDOFF-05 — UI components (gate ok @051191b)

## What now exists
- src/components (props-only): MapView, PlanPanel, ReviewPanel (+ ConstraintBadges, DiffView), ReportPanel, ReplayPlayer, FrameViewer, TelemetryStrip, ModeBanner; CSS modules per panel.
- src/lib/ui helpers (tested): toBadges, summary (badges.ts); orderFindings, chipLabel, counts (report-view.ts); toLatLngs, fromLeafletRing, boundsOf (geo.ts); checkRequest, isPreset (request.ts); formatTime/Alt/Battery/LatLon, frameAlt, sourceLabel (telemetry-format.ts).
- src/lib/api-client.ts: getHealth() (GET /api/plan, returns {live_available:false} on any failure), postPlan() (never throws).
- Commands: node_modules/.bin/vitest, biome, tsc (pnpm broken in some waves; worked in T05.6). Gate: pnpm lint, test, build, uv run --project sim pytest -q sim/tests.
- Gate result: 356 tests, 98.38% stmts coverage, 35 sim tests pass.

## Deviations
- No-fly zones: dashed red outline + light fill (no hatch) with permanent tooltip.
- fromLeafletRing validates via zod Ring (rejects NaN/out of range); accepts [lat,lng] and {lat,lng}.
- MapView not browser-run; only edit implemented, draw not (spec item 3 asks for both). WAVE-07 e2e covers it.
- Map effect has biome-ignore exhaustive-deps (map created once).
- Preset buttons in fieldset+legend (biome useSemanticElements).
- PlanPanel: scenarios {id,title}[], error string|null. ModeBanner model defaults claude-sonnet-5-5.
- ConstraintBadges/DiffView import ReviewPanel.module.css. Repair/auto-fix buttons render only when canRepair/canAutoFix.
- `.ok` colour uses var(--ok, inherit) (--ok unchecked in globals.css).
- FrameViewer `frames` prop is Frame[]; chips disabled if frame_id missing.
- T05.2 red phase weak; T05.5 red run not observed.

## Known warnings
- MapView.tsx:83,92 bindTooltip(string) writes innerHTML; safe for bundled data only. Use a text node before user/LLM scenario data.
- MapView.tsx:144 effect on [ready, props] rebuilds all layers each render.
- FrameViewer.tsx, TelemetryStrip.tsx lack 'use client' (work under ReplayPlayer). Mixed ../lib vs @/lib imports.
- toFixed(5) lat/lon duplicated in DiffView:8, ReviewPanel:42-43, report-view.ts:10; reuse formatLatLon.
- ReportPanel:16-17 re-filters findings; ReplayPlayer:24 findLastIndex untested.
- api-client.ts:26,43 catches do not log.
- biome.json linter.recommended deprecated (1 info).

## Next wave must know
- WAVE-06: split drone marker into its own effect keyed on props.drone before animating at frame rate.
- Add 'use client' to FrameViewer and TelemetryStrip if rendered outside ReplayPlayer.
- WAVE-07 e2e must cover MapView in a browser.
