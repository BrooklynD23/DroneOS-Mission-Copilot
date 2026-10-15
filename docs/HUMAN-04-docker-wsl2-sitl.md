# HUMAN-04 — Docker Desktop + WSL2 (+ optional GPU) for local PX4 SITL

| Field | Value |
|---|---|
| Needed before | HUMAN-05 only. No code wave needs SITL (tests use fixtures; replays are synthetic until HUMAN-05). |
| Owner | Robotics owner, on one designated demo/recording machine |
| Env vars | none |
| Cost | Free software; Docker Desktop licence terms apply to larger orgs (check [Docker Desktop install](https://docs.docker.com/desktop/setup/install/windows-install/)). Hardware: 16 GB RAM / 8 cores is a starting guess (UNVERIFIED, RESEARCH-02). |

## Steps
1. WSL2: admin PowerShell `wsl --install`, reboot ([WSL install](https://learn.microsoft.com/en-us/windows/wsl/install)). Check `wsl -l -v` shows VERSION 2.
2. Install Docker Desktop ([link](https://docs.docker.com/desktop/setup/install/windows-install/)); Settings → Resources → WSL Integration → enable for your distro.
3. Clone the repo **inside the WSL filesystem** (`~/src/...`), not `/mnt/c` — `/mnt/c` is slow for builds ([A20](../../../AI/loop-research/scratchpads/A20-feasibility.md)).
4. Pull the pinned image (≈680 MB compressed, checked on [Docker Hub](https://hub.docker.com/r/px4io/px4-sitl-gazebo/tags) 2026-10-14): `docker pull px4io/px4-sitl-gazebo:v1.18.0-rc1`.
5. Start SITL headless: `docker compose -f sim/compose.yaml up` (or `docker run --rm -it --network host -e HEADLESS=1 -e PX4_SIM_MODEL=gz_x500_mono_cam px4io/px4-sitl-gazebo:v1.18.0-rc1`; env names from the [image page](https://hub.docker.com/r/px4io/px4-sitl-gazebo)). Expect PX4 boot log and MAVLink on UDP 14540 ([PX4 simulation](https://docs.px4.io/main/en/simulation/), [container builds](https://docs.px4.io/main/en/dev_setup/sitl_container_builds.html)).
6. Install GStreamer in WSL for frame capture: `sudo apt install gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav` ([PX4 video streaming](https://docs.px4.io/main/en/sim_gazebo_gz/#video-streaming)).
7. Optional GPU: install the NVIDIA Windows driver only (not inside WSL) ([CUDA on WSL](https://docs.nvidia.com/cuda/wsl-user-guide/index.html)); check `nvidia-smi` in WSL. Software rendering also works (`LIBGL_ALWAYS_SOFTWARE=1`); if Gazebo crashes under WSLg use headless (A20 notes `--render-engine ogre` as a workaround).
8. Week-1 spike gate ([FINAL-REPORT](../../../AI/loop-research/FINAL-REPORT.md)): if SITL is not flying by end of week 2, stop. The demo ships with SYNTHETIC replays; no code changes needed.

## Verification
```bash
docker info >/dev/null && docker image inspect px4io/px4-sitl-gazebo:v1.18.0-rc1 >/dev/null && gst-launch-1.0 --version >/dev/null && uv run --project sim python -c "import mavsdk_grpc"
```
Exit 0 = Docker up, image present, GStreamer installed, MAVSDK importable.
