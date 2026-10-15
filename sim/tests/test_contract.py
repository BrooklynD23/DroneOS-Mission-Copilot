"""Contract loader tests: schemas/ are the single source of truth for both sides."""

import json
from pathlib import Path

import pytest

from droneos_sim import contract

FIXTURES = Path(__file__).parent / "fixtures"
SCHEMA_NAMES = ["mission", "scenario", "telemetry-sample", "replay-manifest", "report"]


def test_load_schema_reads_every_exported_schema() -> None:
    for name in SCHEMA_NAMES:
        schema = contract.load_schema(name)
        assert schema["$schema"].endswith("2020-12/schema")
        assert schema["type"] == "object"


def test_load_schema_unknown_name_raises() -> None:
    with pytest.raises(ValueError, match="unknown schema"):
        contract.load_schema("nope")


def test_load_schema_rejects_path_traversal() -> None:
    with pytest.raises(ValueError):
        contract.load_schema("../pyproject")


def test_validate_accepts_fixture_scenario() -> None:
    scenario = json.loads((FIXTURES / "scenario.json").read_text())
    contract.validate("scenario", scenario)


def test_validate_accepts_fixture_replay_files() -> None:
    replay = FIXTURES / "replay_ok"
    contract.validate("replay-manifest", json.loads((replay / "manifest.json").read_text()))
    contract.validate("mission", json.loads((replay / "mission.json").read_text()))
    for line in (replay / "telemetry.jsonl").read_text().splitlines():
        contract.validate("telemetry-sample", json.loads(line))


def test_validate_lists_every_error_path() -> None:
    bad_mission = {"mission_id": 7, "speed_mps": 99, "waypoints": [], "notes": "x"}
    with pytest.raises(ValueError) as exc:
        contract.validate("mission", bad_mission)
    msg = str(exc.value)
    for path in ("$.mission_id", "$.speed_mps", "$.waypoints", "$.notes"):
        assert path in msg


def test_validate_rejects_wrong_top_level_type() -> None:
    with pytest.raises(ValueError):
        contract.validate("scenario", [1, 2, 3])


def test_validate_rejects_extra_property() -> None:
    sample = {
        "t_s": 0,
        "ts": "2026-10-14T12:00:00Z",
        "lat": 47.397742,
        "lon": 8.545594,
        "alt_m": 0,
        "battery_pct": 100,
        "mode": "MISSION",
        "surprise": True,
    }
    with pytest.raises(ValueError, match="surprise"):
        contract.validate("telemetry-sample", sample)
