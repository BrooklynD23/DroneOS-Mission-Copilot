import json
import subprocess
import sys
from pathlib import Path

import pytest

from droneos_sim import contract, fly

FIXTURES = Path(__file__).parent / "fixtures"
SCENARIO = json.loads((FIXTURES / "scenario.json").read_text())


def _wp(i, action="none", hold_s=0, lat=None, lon=None):
    h = SCENARIO["home"]
    return {
        "id": f"wp{i}",
        "lat": lat if lat is not None else h["lat"],
        "lon": lon if lon is not None else h["lon"],
        "alt_m": 20,
        "action": action,
        "hold_s": hold_s,
    }


def test_check_home_inside_ok():
    fly.check_home(SCENARIO["home"], SCENARIO)


def test_check_home_outside_raises():
    with pytest.raises(ValueError, match="home"):
        fly.check_home({"lat": 0.0, "lon": 0.0}, SCENARIO)


def test_mission_items_mapping():
    mission = {
        "mission_id": "m",
        "speed_mps": 6,
        "notes": [],
        "waypoints": [_wp(1), _wp(2, "hover", 5), _wp(3, "photo", 2)],
    }
    a, b, c = fly.mission_items(mission)
    assert a["relative_altitude_m"] == 20 and a["speed_m_s"] == 6
    assert a["is_fly_through"] is True and a["camera_action"] == "NONE"
    assert a["loiter_time_s"] == 0
    assert b["is_fly_through"] is False and b["loiter_time_s"] == 5
    assert c["camera_action"] == "TAKE_PHOTO" and c["loiter_time_s"] == 2
    assert a["latitude_deg"] == mission["waypoints"][0]["lat"]


def test_fence_polygons_unclosed_and_complete():
    inc, exc = fly.fence_polygons(SCENARIO)
    ring = SCENARIO["constraints"]["geofence"]
    assert len(inc) == len(ring) and inc[0] == (ring[0]["lat"], ring[0]["lon"])
    assert len(exc) == len(SCENARIO["constraints"]["no_fly"])
    assert all(r[0] != r[-1] for r in [inc, *exc])


def test_fence_polygons_drops_duplicate_closing_point():
    s = json.loads(json.dumps(SCENARIO))
    g = s["constraints"]["geofence"]
    s["constraints"]["geofence"] = [*g, g[0]]
    inc, _ = fly.fence_polygons(s)
    assert len(inc) == len(g)


def test_telemetry_row_valid_and_frame_optional():
    row = fly.telemetry_row(1.5, "2026-10-14T12:00:01Z", 47.4, 8.5, 10.0, 99.0, "MISSION")
    contract.validate("telemetry-sample", row)
    assert "frame_id" not in row
    row = fly.telemetry_row(1.5, "2026-10-14T12:00:01Z", 47.4, 8.5, 10.0, 99.0, "MISSION", "000001")
    contract.validate("telemetry-sample", row)


def _samples(n=5):
    h = SCENARIO["home"]
    return [
        fly.telemetry_row(
            i * 0.5, f"2026-10-14T12:00:0{i}Z", h["lat"], h["lon"], 10.0, 99.0, "MISSION"
        )
        for i in range(n)
    ]


def test_assign_frames_nearest_and_immutable():
    samples = _samples()
    out = fly.assign_frames([0.1, 1.4], samples)
    assert out[0]["frame_id"] == "000001"
    assert out[3]["frame_id"] == "000002"
    assert all("frame_id" not in s for s in samples)


def test_assign_frames_collision_keeps_first():
    out = fly.assign_frames([0.9, 1.0], _samples())
    assert [s.get("frame_id") for s in out].count(None) == 4
    assert out[2]["frame_id"] == "000001"


def test_write_replay_passes_oracle(tmp_path):
    src = tmp_path / "src"
    src.mkdir()
    frames = []
    for name in ("frame_000002.jpg", "frame_000001.jpg"):
        (src / name).write_bytes(b"x")
        frames.append(src / name)
    mission = {
        "mission_id": "m",
        "speed_mps": 5,
        "notes": [],
        "waypoints": [_wp(1)],
    }
    manifest = {
        "scenario_id": SCENARIO["id"],
        "source": "recorded-sitl",
        "created": "2026-10-14T12:00:00Z",
        "frame_ext": "jpg",
        "frame_count": 0,
        "duration_s": 2.0,
        "px4_image": "px4io/px4-sitl-gazebo:v1.18.0-rc1",
        "gf_action": 2,
    }
    out = tmp_path / "out"
    fly.write_replay(out, manifest, mission, fly.assign_frames([0.0, 1.0], _samples()), frames)
    assert (out / "frames" / "000001.jpg").exists() and (out / "frames" / "000002.jpg").exists()
    assert json.loads((out / "manifest.json").read_text())["frame_count"] == 2
    scen = tmp_path / "scenario.json"
    scen.write_text(json.dumps(SCENARIO))
    r = subprocess.run(
        [sys.executable, "-m", "droneos_sim.oracle", str(out), str(scen)],
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0, r.stdout + r.stderr
