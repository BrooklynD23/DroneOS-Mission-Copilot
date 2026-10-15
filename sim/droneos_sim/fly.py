"""Pure helpers for the SITL flight script: no network, no clock, no MAVSDK import."""

import json
import shutil
from pathlib import Path
from typing import Any

from . import contract, geo

Ring = list[tuple[float, float]]


def check_home(home: dict[str, float], scenario: dict[str, Any]) -> None:
    """Raise if home is outside the geofence (PX4 rejects fences that exclude home)."""
    fence = geo.ring_polygon(scenario["constraints"]["geofence"], scenario["home"])
    if not fence.covers(geo.point_xy(home["lat"], home["lon"], scenario["home"])):
        raise ValueError(f"home ({home['lat']}, {home['lon']}) is outside the geofence")


def mission_items(mission: dict[str, Any]) -> list[dict[str, Any]]:
    """Map waypoints to kwargs for ``mavsdk_grpc.mission.MissionItem`` (camera_action by name)."""
    return [
        {
            "latitude_deg": wp["lat"],
            "longitude_deg": wp["lon"],
            "relative_altitude_m": wp["alt_m"],
            "speed_m_s": mission["speed_mps"],
            "is_fly_through": wp["action"] != "hover",
            "loiter_time_s": wp["hold_s"],
            "camera_action": "TAKE_PHOTO" if wp["action"] == "photo" else "NONE",
        }
        for wp in mission["waypoints"]
    ]


def _ring(points: list[dict[str, float]]) -> Ring:
    ring = [(p["lat"], p["lon"]) for p in points]
    return ring[:-1] if len(ring) > 1 and ring[0] == ring[-1] else ring


def fence_polygons(scenario: dict[str, Any]) -> tuple[Ring, list[Ring]]:
    """Return (inclusion ring, exclusion rings) as open (lat, lon) lists."""
    c = scenario["constraints"]
    return _ring(c["geofence"]), [_ring(z["ring"]) for z in c["no_fly"]]


def telemetry_row(
    t_s: float,
    ts: str,
    lat: float,
    lon: float,
    alt_m: float,
    battery_pct: float,
    mode: str,
    frame_id: str | None = None,
) -> dict[str, Any]:
    """Build a telemetry-sample dict and validate it."""
    row: dict[str, Any] = {
        "t_s": t_s, "ts": ts, "lat": lat, "lon": lon,
        "alt_m": alt_m, "battery_pct": battery_pct, "mode": mode,
    }  # fmt: skip
    if frame_id is not None:
        row["frame_id"] = frame_id
    contract.validate("telemetry-sample", row)
    return row


def assign_frames(frame_times: list[float], samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return samples copy with ``frame_id`` on the sample nearest each frame time.

    Frame i (1-based) gets id ``%06d``. If two frames pick one sample, the first keeps it.
    """
    out = [dict(s) for s in samples]
    for i, ft in enumerate(frame_times, 1):
        j = min(range(len(out)), key=lambda k: abs(out[k]["t_s"] - ft))
        out[j].setdefault("frame_id", f"{i:06d}")
    return out


def write_replay(
    out_dir: Path,
    manifest: dict[str, Any],
    mission: dict[str, Any],
    samples: list[dict[str, Any]],
    frame_files: list[Path],
) -> None:
    """Write manifest/mission/telemetry and copy frames to ``frames/000001.<ext>``..."""
    manifest = {**manifest, "frame_count": len(frame_files)}
    contract.validate("replay-manifest", manifest)
    contract.validate("mission", mission)
    for s in samples:
        contract.validate("telemetry-sample", s)
    frames_dir = out_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    for i, src in enumerate(frame_files, 1):
        shutil.copyfile(src, frames_dir / f"{i:06d}.{manifest['frame_ext']}")
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (out_dir / "mission.json").write_text(json.dumps(mission, indent=2), encoding="utf-8")
    (out_dir / "telemetry.jsonl").write_text(
        "".join(json.dumps(s) + "\n" for s in samples), encoding="utf-8"
    )
