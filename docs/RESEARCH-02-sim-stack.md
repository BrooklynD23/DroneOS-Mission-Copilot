# RESEARCH-02: Local sim stack (PX4 SITL + Gazebo + MAVSDK)

Checked 2026-10-14

## Verdicts

1. `px4io/px4-sitl-gazebo:v1.17.0` does NOT exist on Docker Hub. Use `px4io/px4-sitl-gazebo:v1.18.0-rc1` (pinned) or `:latest`.
2. PX4 v1.17.0 is the latest stable release (13 May 2026).
3. Frame capture: GStreamer, UDP 5600 RTP H.264 → JPG (pipeline below, UNVERIFIED by run).
4. Geofence `GF_*` parameter values: UNVERIFIED (could not retrieve from the parameter reference).

## Versions

| Piece | Version | Link | Note |
|---|---|---|---|
| PX4-Autopilot stable | v1.17.0 (13 May 2026) | https://github.com/PX4/PX4-Autopilot/releases | Latest stable; v1.16.2 (22 Apr) is prior. |
| px4-sitl-gazebo image, pinned | `v1.18.0-rc1` (10 Sep 2026) | https://hub.docker.com/r/px4io/px4-sitl-gazebo/tags | Pin this. No v1.17.0 tag exists; only `v1.17.0-alpha1-*` builds. |
| px4-sitl-gazebo image, default | `latest` (11 Sep 2026, = v1.18.0-beta1 build) | https://docs.px4.io/main/en/dev_setup/sitl_container_builds.html | Docs name `latest` as default. Moving target. |
| Gazebo for PX4 | Harmonic (Ubuntu 22.04 default); Harmonic/Ionic/Jetty on Ubuntu 24.04 | https://docs.px4.io/main/en/sim_gazebo_gz/ | Docs page is `main`, not v1.17-specific: v1.17 Gazebo version UNVERIFIED. |
| mavsdk (PyPI) | 4.0.6 (8 Oct 2026), Python >=3.8 | https://pypi.org/project/mavsdk/ | Latest. |
| pyulog | 1.2.4 (6 Aug 2026) | https://pypi.org/project/pyulog/ | ULog parser, PX4 repo. |
| shapely | 2.2.0 (7 Oct 2026), Python >=3.11 | https://pypi.org/project/shapely/ | Geofence/polygon math. |
| pytest | 9.1.1 (19 Jun 2026), Python >=3.10 | https://pypi.org/project/pytest/ | |
| uv | 0.13.1 (14 Oct 2026) | https://pypi.org/project/uv/ | Env + lock. |
| ruff | 0.17.0 (9 Oct 2026) | https://pypi.org/project/ruff/ | Lint + format. |
| Python | 3.12 (recommended) | https://pypi.org/project/shapely/ | 3.12 satisfies every pin above; 3.13 also OK (judgment, not tested). |
| GStreamer | 1.0 | https://docs.px4.io/main/en/simulation/video_streaming.html | Needed for video capture (UDP 5600). |

## Sim choice

| Option | Camera | Install | Note |
|---|---|---|---|
| Gazebo via Docker (`gz_x500_mono_cam` / `gz_x500_gimbal`) | Yes (RTP H.264 UDP 5600) | https://docs.px4.io/main/en/sim_gazebo_gz/ | Use this. Software rendering on WSL2 works (`LIBGL_ALWAYS_SOFTWARE=1`). |
| SIH (simulation-in-hardware) | No (inferred: no Gazebo render) | https://docs.px4.io/main/en/simulation/ | Headless, no external deps. Telemetry only. Good for fast mission logic tests. |
| jMAVSim | Not checked | UNVERIFIED | Not in the current simulator list; skip. |
| Gazebo Classic | Yes | https://github.com/PX4/PX4-SITL_gazebo-classic | Community-supported only. Avoid. |

## Frame capture command

Video stream facts: UDP port 5600, RTP, GStreamer 1.0 (https://docs.px4.io/main/en/simulation/video_streaming.html). Camera models named on that page: `gz_x500_mono_cam`, `gz_x500_gimbal`.

```bash
mkdir -p /path/to/replay/frames
gst-launch-1.0 -q udpsrc port=5600 \
  caps="application/x-rtp,media=video,encoding-name=H264,payload=96" \
  ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert \
  ! videorate ! video/x-raw,framerate=2/1 \
  ! jpegenc quality=85 \
  ! multifilesink location=/path/to/replay/frames/frame_%06d.jpg
```

UNVERIFIED: pipeline composed from standard GStreamer elements; not run here. Test first with `gst-launch-1.0 udpsrc port=5600 ! ... ! autovideosink`. Frame timestamps: write wall-clock time per frame to the telemetry JSONL, since `videorate` drops the source clock.

## Geofence (PX4)

| Item | Value | Link | Note |
|---|---|---|---|
| `GF_ACTION` values | UNVERIFIED | https://docs.px4.io/main/en/advanced_config/parameter_reference.html | Not retrieved (page is 393k chars; GF_ section not reached in 3 chunks). |
| `GF_MAX_HOR_DIST` / `GF_MAX_VER_DIST` | UNVERIFIED | same | Same. |
| Mission geofence upload | MAVLink mission microservice | https://docs.px4.io/main/en/flying/geofence.html | Fence must include the home position or PX4 rejects it. |
| MAVSDK geofence plugin | Example file `geofence.py` | https://github.com/mavlink/MAVSDK-Python/tree/main/examples | |

## Reuse repos

| Repo | Stars | License | Last push | Reuse for |
|---|---|---|---|---|
| https://github.com/PX4/PX4-gazebo-models | 108 | BSD-3-Clause | 4 Oct 2026 | Gazebo models/worlds (buildings/roofs: check contents, UNVERIFIED). |
| https://github.com/mavlink/MAVSDK-Python | 454 | BSD-3-Clause | 7 Oct 2026 | `examples/mission.py`, `telemetry.py`, `geofence.py`, `camera.py`, `example-mission.plan`. |
| https://github.com/PX4/PX4-SITL_gazebo-classic | 466 | (not reported) | 15 Jul 2026 | Do not use (Classic). |
| LLM→PX4 mission demos | none found | n/a | n/a | Search found no LLM+MAVSDK planner repo. `UAV-CodeAgents` not found (name guess). |

## Recommendation

1. Image: `px4io/px4-sitl-gazebo:v1.18.0-rc1` (pinned). Not `v1.17.0` (doesn't exist).
2. Sim: Gazebo `gz_x500_mono_cam` headless (`HEADLESS=1`) for video; SIH for fast logic tests.
3. Frames: GStreamer pipeline above, 2 fps JPG, to the replay folder.
4. Telemetry: MAVSDK-Python `telemetry` async generators → JSONL, your code.
5. Mission: MAVSDK `mission` plugin, mirror `examples/mission.py`.
6. Python: 3.12, `uv` + `pyproject.toml`; `shapely`, `pyulog`, `pytest`, `ruff`.
7. Mission export: `.plan` is plain JSON (`fileType: "Plan"`), so mission JSON → `.plan` is a small converter.
8. Geofence values: retrieve `GF_*` from PX4 source `src/modules/gf` or the parameter page before coding.

## Human setup steps

| # | Step | Exact command / URL | Verify | Cost |
|---|---|---|---|---|
| 1 | Install WSL2 (Windows 10 2004+ or 11) | Admin PowerShell: `wsl --install`. https://learn.microsoft.com/en-us/windows/wsl/install | `wsl -l -v` shows VERSION 2 | Free |
| 2 | Install Docker Desktop | https://docs.docker.com/desktop/setup/install/windows-install/ (UNVERIFIED link) | Settings > Resources > WSL Integration enabled. WSL min 2.1.5: https://docs.docker.com/desktop/features/wsl/ | Check Docker license terms (UNVERIFIED) |
| 3 | Pull pinned image | `docker pull px4io/px4-sitl-gazebo:v1.18.0-rc1` | `docker images` lists it | Free; size UNVERIFIED |
| 4 | Run SITL headless | `docker run --rm -it --network host -e HEADLESS=1 px4io/px4-sitl-gazebo:v1.18.0-rc1` | Log shows PX4 start; MAVLink on UDP 14540 | Free |
| 5 | (Optional) NVIDIA GPU | Windows driver R495+, install on Windows only (not in WSL). https://docs.nvidia.com/cuda/wsl-user-guide/index.html | `nvidia-smi` inside WSL. Software rendering works without it. | Free |
| 6 | Python tooling | https://pypi.org/project/uv/ | `uv --version` | Free |
| 7 | Hardware minimum | UNVERIFIED (Docker Desktop page did not list RAM/CPU) | Start with 16 GB RAM, 8 cores as a guess | Hardware |

Last line, next action: run step 3, then step 4, and confirm `udp://:14540` heartbeats before writing any code.

## Planner notes (2026-10-14)

| Item | Finding | Evidence |
|---|---|---|
| `GF_ACTION` values | Verified: 0 None, 1 Warning, 2 Hold (default), 3 Return, 4 Terminate, 5 Land. `GF_MAX_HOR_DIST`/`GF_MAX_VER_DIST` default 0 = disabled | [geofence_params.yaml (main)](https://raw.githubusercontent.com/PX4/PX4-Autopilot/main/src/modules/navigator/geofence_params.yaml) |
| Image tag | `v1.18.0-rc1` exists, updated 2026-09-10, ≈680 MB compressed (amd64+arm64). Still no plain `v1.17.0` tag; PX4 git tag `v1.17.0` exists | [Docker Hub API](https://hub.docker.com/v2/repositories/px4io/px4-sitl-gazebo/tags/v1.18.0-rc1), [PX4 tags](https://github.com/PX4/PX4-Autopilot/tags) |
| Model/world env | Image page documents `PX4_SIM_MODEL` and `PX4_GZ_WORLD` env vars and `HEADLESS=1` | [image page](https://hub.docker.com/r/px4io/px4-sitl-gazebo) |
| Video doc URL | `…/simulation/video_streaming.html` returns 404; current section is `sim_gazebo_gz/#video-streaming` (UDP 5600, RTP, GStreamer 1.0) | [PX4 Gazebo video streaming](https://docs.px4.io/main/en/sim_gazebo_gz/#video-streaming) |
| `mavsdk` 4.x | **API change**: `mavsdk` ≥4 is a native (ctypes) binding with a different API; the old gRPC wrapper is now `mavsdk-grpc` (4.0.5, imported as `mavsdk_grpc`), which the repo examples use. Plan pins `mavsdk-grpc==4.0.5` | wheel `mavsdk/_legacy.py` in 4.0.6; [migration](https://mavsdk.mavlink.io/main/en/python/migration.html); [PyPI mavsdk-grpc](https://pypi.org/project/mavsdk-grpc/) |
| PX4 default home | `47.397742, 8.545594` widely cited, not found in current docs → UNVERIFIED; `sitl.py` prints home and aborts if outside the fence (HUMAN-05) | — |
