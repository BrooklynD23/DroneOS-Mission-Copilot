# RESEARCH-03 — Repo answers (DeepWiki / Devin)

Checked 2026-10-14 via `mcp__devin__ask_wiki_question`. Answers are DeepWiki summaries of the repo source; confirm against linked repos before relying on exact flags.

| Repo | Question | Answer | Link |
|---|---|---|---|
| mavlink/MAVSDK-Python | Package, Python min | `pip install mavsdk`; Python ≥ 3.7 | https://github.com/mavlink/MAVSDK-Python |
| mavlink/MAVSDK-Python | Mission upload | `Mission` plugin: build `MissionItem`s → `MissionPlan` → `drone.mission.upload_mission_with_progress(plan)` | https://github.com/mavlink/MAVSDK-Python/blob/main/examples/mission.py |
| mavlink/MAVSDK-Python | Telemetry | async generators `telemetry.position()`, `battery()`, `flight_mode()` | https://github.com/mavlink/MAVSDK-Python/blob/main/examples/telemetry.py |
| mavlink/MAVSDK-Python | Client-side logging | None built in. Write JSONL from the `async for` loops. `LogFiles` plugin only downloads on-vehicle ULogs | https://app.devin.ai/search/api_f4dfc773-a70c-40f1-a09f-ad0a2d9218eb |
| PX4/PX4-Autopilot | Headless SITL | `HEADLESS=1 make px4_sitl gz_x500` | https://docs.px4.io/main/en/sim_gazebo_gz/ |
| PX4/PX4-Autopilot | Docker SITL | `docker run --rm -it --network host px4io/px4-sitl-gazebo:v1.17.0` (tag to verify in RESEARCH-02) | https://app.devin.ai/search/api_e762758e-dd8c-4ea4-8121-e8f6913afd27 |
| PX4/PX4-Autopilot | MAVSDK port | UDP 14540 (14540–14549 multi-vehicle) | https://docs.px4.io/main/en/simulation/ |
| PX4/PX4-Autopilot | Camera | `gz_x500_mono_cam`, `gz_x500_gimbal` stream RTP H.264 on UDP 5600; GStreamer 1.0 needed | https://docs.px4.io/main/en/sim_gazebo_gz/ |
| Turfjs/turf | Geometry modules | `@turf/boolean-point-in-polygon`, `@turf/line-intersect`, `@turf/length`, `@turf/buffer`; all v7; per-module packages, ESM, tree-shakable | https://github.com/Turfjs/turf |

## Takeaways
1. Telemetry recorder = ~40 lines of Python writing JSONL; no extra lib.
2. Camera frames need a `*_mono_cam` model plus GStreamer/ffmpeg on the host or in the container.
3. Validator can be pure TypeScript with 3–4 turf modules; runs in browser and in Node tests unchanged.

## Planner notes (2026-10-14)

- Examples on MAVSDK-Python `main` and tag `4.0.5` import `mavsdk_grpc` (e.g. `from mavsdk_grpc import System`) and connect with `udpin://0.0.0.0:14540`, not `udp://:14540`. Package for that API: `mavsdk-grpc` 4.0.5. Evidence: [examples/geofence.py](https://github.com/mavlink/MAVSDK-Python/blob/main/examples/geofence.py), [examples/mission.py @4.0.5](https://github.com/mavlink/MAVSDK-Python/blob/4.0.5/examples/mission.py).
- Row "Package, Python min: `pip install mavsdk`" is outdated for ≥4.0 (see RESEARCH-02 Planner notes).
