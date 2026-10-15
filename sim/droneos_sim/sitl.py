"""Fly a mission in PX4 SITL and record a replay folder (local only, see HUMAN-05).

Fails closed: any step error or timeout kills the GStreamer subprocess and exits non-zero
naming the step. Keeps GF_ACTION=2 and sets RTL_RETURN_ALT below the scenario ceiling.
"""

import argparse
import asyncio
import json
import subprocess
import sys
import tempfile
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from . import contract, fly, frames, oracle

PX4_IMAGE = "px4io/px4-sitl-gazebo:v1.18.0-rc1"
GF_ACTION = 2  # PX4 geofence_params.yaml: 2 = Return
RTL_MARGIN_M = 5
STEP_TIMEOUT_S = 30
WATCHDOG_S = 600
SAMPLE_PERIOD_S = 0.5


class StepError(RuntimeError):
    def __init__(self, step: str, cause: object):
        super().__init__(f"step '{step}' failed: {cause!r}")
        self.step = step


async def _step(step: str, aw: Any, timeout: float = STEP_TIMEOUT_S) -> Any:
    try:
        return await asyncio.wait_for(aw, timeout)
    except Exception as e:  # noqa: BLE001 - every failure is reported with its step name
        raise StepError(step, e) from e


async def _first(agen: Any) -> Any:
    async for item in agen:
        return item


async def _record(system: Any, t0: float, start: datetime) -> list[dict[str, Any]]:
    """Sample position, battery and flight mode at 2 Hz until landed or watchdog."""
    samples: list[dict[str, Any]] = []
    flown = False
    while (t := time.monotonic() - t0) < WATCHDOG_S:
        pos = await _step("read position", _first(system.telemetry.position()), 5)
        bat = await _step("read battery", _first(system.telemetry.battery()), 5)
        mode = await _step("read flight mode", _first(system.telemetry.flight_mode()), 5)
        samples.append(
            fly.telemetry_row(
                round(t, 2),
                (start + timedelta(seconds=t)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                pos.latitude_deg,
                pos.longitude_deg,
                pos.relative_altitude_m,
                max(0.0, min(100.0, bat.remaining_percent * 100)),
                mode.name,
            )
        )
        flown = flown or pos.relative_altitude_m > 2
        if flown and pos.relative_altitude_m < 0.5 and mode.name in ("LAND", "HOLD"):
            return samples
        await asyncio.sleep(SAMPLE_PERIOD_S)
    raise StepError("record", f"watchdog {WATCHDOG_S}s")


async def _fly(scenario: dict[str, Any], mission: dict[str, Any], frames_dir: Path, gst: list):
    from mavsdk_grpc import System  # noqa: PLC0415 - heavy, SITL-only
    from mavsdk_grpc.geofence import FenceType, GeofenceData, Point, Polygon  # noqa: PLC0415
    from mavsdk_grpc.mission import MissionItem, MissionPlan  # noqa: PLC0415

    ceiling = scenario["constraints"]["ceiling_m"]
    system = System()
    await _step("connect", system.connect(system_address="udpin://0.0.0.0:14540"))
    home = await _step("home", _first(system.telemetry.home()))
    fly.check_home({"lat": home.latitude_deg, "lon": home.longitude_deg}, scenario)

    await _step("set GF_ACTION", system.param.set_param_int("GF_ACTION", GF_ACTION))
    got = await _step("read GF_ACTION", system.param.get_param_int("GF_ACTION"))
    if got != GF_ACTION:
        raise StepError("verify GF_ACTION", f"read {got}, want {GF_ACTION}")
    rtl = float(ceiling - RTL_MARGIN_M)
    await _step("set RTL_RETURN_ALT", system.param.set_param_float("RTL_RETURN_ALT", rtl))
    got_f = await _step("read RTL_RETURN_ALT", system.param.get_param_float("RTL_RETURN_ALT"))
    if abs(got_f - rtl) > 0.01:
        raise StepError("verify RTL_RETURN_ALT", f"read {got_f}, want {rtl}")

    inc, exc = fly.fence_polygons(scenario)

    def poly(ring: fly.Ring, inclusion: bool) -> Polygon:
        pts = [Point(latitude_deg=la, longitude_deg=lo) for la, lo in ring]
        return Polygon(
            points=pts, fence_type=FenceType.INCLUSION if inclusion else FenceType.EXCLUSION
        )

    fence = GeofenceData(polygons=[poly(inc, True), *(poly(r, False) for r in exc)], circles=[])
    await _step("upload geofence", system.geofence.upload_geofence(fence))

    items = [MissionItem(**_camera(i)) for i in fly.mission_items(mission)]
    await _step("set RTL after mission", system.mission.set_return_to_launch_after_mission(True))
    await _step("upload mission", system.mission.upload_mission(MissionPlan(items)))

    gst.append(subprocess.Popen(frames.gst_argv(frames_dir), stderr=subprocess.DEVNULL))
    await _step("arm", system.action.arm())
    start = datetime.now(UTC)
    t0 = time.monotonic()
    await _step("start mission", system.mission.start_mission())
    samples = await _record(system, t0, start)
    return samples, time.monotonic() - t0, start


def _camera(item: dict[str, Any]) -> dict[str, Any]:
    from mavsdk_grpc.mission import MissionItem  # noqa: PLC0415

    return {**item, "camera_action": getattr(MissionItem.CameraAction, item["camera_action"])}


def run(scenario_path: Path, mission_path: Path, out_dir: Path) -> int:
    scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
    mission = json.loads(mission_path.read_text(encoding="utf-8"))
    contract.validate("scenario", scenario)
    contract.validate("mission", mission)
    gst: list[subprocess.Popen] = []
    try:
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            samples, dur, start = asyncio.run(_fly(scenario, mission, raw, gst))
            for p in gst:
                p.terminate()
                p.wait(timeout=10)
            gst.clear()
            files = sorted(raw.glob("frame_*.jpg"))
            # frame i is written at ~i/2 s after the stream started
            times = [i / 2 for i in range(len(files))]
            manifest = {
                "scenario_id": scenario["id"],
                "source": "recorded-sitl",
                "created": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "frame_ext": "jpg",
                "frame_count": len(files),
                "duration_s": round(dur, 1),
                "px4_image": PX4_IMAGE,
                "gf_action": GF_ACTION,
            }
            fly.write_replay(out_dir, manifest, mission, fly.assign_frames(times, samples), files)
    except StepError as e:
        print(f"FAIL {e.step}: {e}", file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001 - fail closed with a step name
        print(f"FAIL setup: {e!r}", file=sys.stderr)
        return 1
    finally:
        for p in gst:
            p.kill()
    return oracle.main([str(out_dir), str(scenario_path)])


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="droneos_sim.sitl")
    ap.add_argument("--scenario", type=Path, required=True)
    ap.add_argument("--mission", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args(argv)
    return run(a.scenario, a.mission, a.out)


if __name__ == "__main__":
    sys.exit(main())
