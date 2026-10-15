"""Oracle tests: independent replay checker (shares no code with the TS validator)."""

import json
import math
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

from droneos_sim import oracle

FIXTURES = Path(__file__).parent / "fixtures"
SCENARIO_PATH = FIXTURES / "scenario.json"
REPLAY_OK = FIXTURES / "replay_ok"
REPLAY_BAD = FIXTURES / "replay_bad"


def _scenario() -> dict[str, Any]:
    return json.loads(SCENARIO_PATH.read_text())


def _samples(replay_dir: Path) -> list[dict[str, Any]]:
    return [
        json.loads(line)
        for line in (replay_dir / "telemetry.jsonl").read_text().splitlines()
        if line.strip()
    ]


def _sample(overrides: dict[str, Any]) -> dict[str, Any]:
    base = {
        "t_s": 1.0,
        "ts": "2026-10-14T12:00:01Z",
        "lat": 47.397742,
        "lon": 8.545594,
        "alt_m": 30.0,
        "battery_pct": 90.0,
        "mode": "MISSION",
    }
    return base | overrides


def test_good_replay_has_no_violations() -> None:
    assert oracle.check(_scenario(), _samples(REPLAY_OK)) == []


def test_bad_replay_flags_exactly_ceiling_and_no_fly() -> None:
    violations = oracle.check(_scenario(), _samples(REPLAY_BAD))
    assert {v["code"] for v in violations} == {"ceiling", "no_fly"}
    zone_ids = {v["zone_id"] for v in violations if v["code"] == "no_fly"}
    assert zone_ids == {"parking-lot"}


def test_ceiling_tolerance_edges() -> None:
    scenario = _scenario()
    ceiling = scenario["constraints"]["ceiling_m"]
    just_under = [_sample({"alt_m": ceiling + 1.9})]
    just_over = [_sample({"alt_m": ceiling + 2.1})]
    assert oracle.check(scenario, just_under) == []
    violations = oracle.check(scenario, just_over)
    assert [v["code"] for v in violations] == ["ceiling"]
    assert violations[0]["limit"] == ceiling


def test_geofence_tolerance_edges() -> None:
    # 150 m north of home sits on the fence edge; step beyond it in metres.
    home = _scenario()["home"]
    just_inside = home["lat"] + 150.9 / 111_320  # 0.9 m outside, inside FENCE_TOL_M
    well_out = home["lat"] + 151.9 / 111_320  # 1.9 m outside
    assert oracle.check(_scenario(), [_sample({"lat": just_inside})]) == []
    violations = oracle.check(_scenario(), [_sample({"lat": well_out})])
    assert [v["code"] for v in violations] == ["geofence"]


def test_battery_below_reserve_during_flight() -> None:
    violations = oracle.check(_scenario(), [_sample({"battery_pct": 10.0})])
    assert [v["code"] for v in violations] == ["battery"]


def test_checks_skip_non_flight_modes() -> None:
    wild = _sample({"alt_m": 999.0, "battery_pct": 1.0, "mode": "LAND"})
    assert oracle.check(_scenario(), [wild]) == []


def test_no_fly_boundary_graze_is_tolerated() -> None:
    # Parking lot north edge is 20 m south of home latitude-wise; graze 0.5 m inside.
    home = _scenario()["home"]
    graze_lat = home["lat"] - 20.5 / 111_320
    graze_lon = home["lon"] + 100 / (111_320 * math.cos(math.radians(home["lat"])))
    violations = oracle.check(_scenario(), [_sample({"lat": graze_lat, "lon": graze_lon})])
    assert violations == []


def _run_cli(replay_dir: Path, scenario_path: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "droneos_sim.oracle", str(replay_dir), str(scenario_path)],
        capture_output=True,
        text=True,
        check=False,
    )


def test_cli_ok_exit_0() -> None:
    proc = _run_cli(REPLAY_OK, SCENARIO_PATH)
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)
    assert payload == {"ok": True, "violations": []}


def test_cli_bad_exit_1() -> None:
    proc = _run_cli(REPLAY_BAD, SCENARIO_PATH)
    assert proc.returncode == 1
    payload = json.loads(proc.stdout)
    assert payload["ok"] is False
    assert {v["code"] for v in payload["violations"]} == {"ceiling", "no_fly"}


def test_cli_schema_error_exit_1(tmp_path: Path) -> None:
    bad_scenario = tmp_path / "scenario.json"
    bad_scenario.write_text(json.dumps({"id": "broken"}))
    proc = _run_cli(REPLAY_OK, bad_scenario)
    assert proc.returncode == 1
    payload = json.loads(proc.stdout)
    assert payload["ok"] is False
    assert "error" in payload


def test_cli_bad_telemetry_line_exit_1(tmp_path: Path) -> None:
    replay = tmp_path / "replay"
    shutil.copytree(REPLAY_OK, replay)
    lines = (replay / "telemetry.jsonl").read_text().splitlines()
    lines[3] = json.dumps({"t_s": 6, "mode": "MISSION"})  # missing required fields
    (replay / "telemetry.jsonl").write_text("\n".join(lines) + "\n")
    proc = _run_cli(replay, SCENARIO_PATH)
    assert proc.returncode == 1
    payload = json.loads(proc.stdout)
    assert payload["ok"] is False
    assert "line 4" in payload["error"]


def test_main_returns_0_and_prints(capsys: pytest.CaptureFixture[str]) -> None:
    rc = oracle.main([str(REPLAY_OK), str(SCENARIO_PATH)])
    assert rc == 0
    assert json.loads(capsys.readouterr().out)["ok"] is True


def test_main_returns_1_on_violations(capsys: pytest.CaptureFixture[str]) -> None:
    rc = oracle.main([str(REPLAY_BAD), str(SCENARIO_PATH)])
    assert rc == 1
    assert json.loads(capsys.readouterr().out)["ok"] is False


def test_main_returns_1_on_missing_dir(capsys: pytest.CaptureFixture[str]) -> None:
    rc = oracle.main([str(FIXTURES / "nope"), str(SCENARIO_PATH)])
    assert rc == 1
    assert json.loads(capsys.readouterr().out)["ok"] is False
