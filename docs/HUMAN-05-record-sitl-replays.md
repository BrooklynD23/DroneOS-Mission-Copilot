# HUMAN-05 — Record real SITL replays (swap SYNTHETIC → RECORDED SITL)

| Field | Value |
|---|---|
| Needed before | Final demo (optional). No wave depends on it: the app ships with SYNTHETIC replays and labels them. |
| Depends on | HUMAN-04 done; WAVE-04 passed (needs `sitl.py`, `oracle.py`, `scripts/synth-replays.ts --report`) |
| Owner | Robotics owner; oracle result reviewed by the validator owner (independence, MV1 §13) |
| Env vars | none |
| Cost | $0; ~2–3 h per scenario including retries |

## Steps
1. Start SITL with the camera model: `docker compose -f sim/compose.yaml up` (HUMAN-04 step 5). Wait for the PX4 ready log.
2. Check home matches the scenario site (UNVERIFIED default `47.397742, 8.545594`): the first lines of `sitl.py` print home and abort if it is outside the geofence. If it differs, set `PX4_HOME_LAT`/`PX4_HOME_LON` in `sim/compose.yaml` (documented for SITL in [PX4 simulation](https://docs.px4.io/main/en/simulation/); support in this image UNVERIFIED) or record the actual home here and ask the planner to shift the scenario.
3. Smoke the video first: `gst-launch-1.0 udpsrc port=5600 caps="application/x-rtp,media=video,encoding-name=H264,payload=96" ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! autovideosink` (pipeline from RESEARCH-02, UNVERIFIED by run).
4. Record each scenario into a temp dir:
   `uv run --project sim python -m droneos_sim.sitl --scenario src/data/scenarios/north-roof.json --mission public/replays/north-roof/mission.json --out /tmp/rec-north-roof`
   Repeat for `solar-east`. The script keeps `GF_ACTION=2` (Hold; values per [geofence_params.yaml](https://raw.githubusercontent.com/PX4/PX4-Autopilot/main/src/modules/navigator/geofence_params.yaml)) and prints the oracle verdict.
5. Oracle must pass: `uv run --project sim python -m droneos_sim.oracle /tmp/rec-north-roof src/data/scenarios/north-roof.json`. If it fails, do not ship that recording; note the violation in `docs/STATUS.md`.
6. Thin frames to ≤300 JPGs per scenario and keep each replay folder ≤10 MB (CDN + repo size).
7. Replace the synthetic folder: `rm -r public/replays/north-roof && cp -r /tmp/rec-north-roof public/replays/north-roof`, then rebuild the report: `pnpm replays:synth --report public/replays/north-roof north-roof`.
8. `pnpm test && pnpm e2e` (fixture test checks mission equality and frame files), commit, push. UI now shows `RECORDED SITL · PX4 geofence enforced (GF_ACTION=2)`.
9. Rehearse 3/3 flights before the demo week (P1 §13 go/no-go).

## Verification
```bash
for s in north-roof solar-east; do node -e "process.exit(require('./public/replays/$s/manifest.json').source==='recorded-sitl'?0:1)" && uv run --project sim python -m droneos_sim.oracle public/replays/$s src/data/scenarios/$s.json >/dev/null || exit 1; done
```
Exit 0 = both replays are real SITL recordings and pass the independent oracle.
