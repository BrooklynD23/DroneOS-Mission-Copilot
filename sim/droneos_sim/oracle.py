"""Independent replay oracle.

Re-checks observed telemetry against the scenario constraints. Built from
PLAN-01 §2–3 and ``schemas/*.schema.json`` only — it shares no code or logic
with the TS validator, so a disagreement between them surfaces a real bug
instead of a shared mistake.

Checks run per telemetry sample while the aircraft is in MISSION or RTL:
geofence, ceiling, no_fly, battery.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from . import contract, geo

ALT_TOL_M = 2.0  # calibration knob: real autopilots overshoot altitude setpoints
FENCE_TOL_M = 1.0  # calibration knob: real autopilots graze fences before reacting
FLIGHT_MODES = frozenset({"MISSION", "RTL"})


def check(scenario: dict[str, Any], samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return violation dicts for telemetry taken during MISSION/RTL."""
    home = scenario["home"]
    constraints = scenario["constraints"]
    ceiling_m = constraints["ceiling_m"]
    reserve_pct = constraints["reserve_pct"]
    fence = geo.ring_polygon(constraints["geofence"], home)
    zones = [(z["id"], geo.ring_polygon(z["ring"], home)) for z in constraints["no_fly"]]

    violations: list[dict[str, Any]] = []
    for sample in samples:
        if sample["mode"] not in FLIGHT_MODES:
            continue
        t_s = sample["t_s"]
        point = geo.point_xy(sample["lat"], sample["lon"], home)

        outside_m = fence.distance(point)
        if outside_m > FENCE_TOL_M:
            violations.append(
                {
                    "code": "geofence",
                    "t_s": t_s,
                    "measured": round(outside_m, 3),
                    "detail": f"t={t_s}s: {outside_m:.1f} m outside the geofence",
                }
            )

        alt_m = sample["alt_m"]
        if alt_m > ceiling_m + ALT_TOL_M:
            violations.append(
                {
                    "code": "ceiling",
                    "t_s": t_s,
                    "measured": alt_m,
                    "limit": ceiling_m,
                    "detail": (
                        f"t={t_s}s: alt {alt_m} m exceeds ceiling {ceiling_m} m "
                        f"by {alt_m - ceiling_m:.1f} m"
                    ),
                }
            )

        for zone_id, zone in zones:
            # Boundary grazes up to FENCE_TOL_M deep are tolerance, not violations.
            if zone.covers(point):
                depth_m = zone.exterior.distance(point)
                if depth_m > FENCE_TOL_M:
                    violations.append(
                        {
                            "code": "no_fly",
                            "zone_id": zone_id,
                            "t_s": t_s,
                            "measured": round(depth_m, 3),
                            "detail": f"t={t_s}s: {depth_m:.1f} m inside no-fly zone '{zone_id}'",
                        }
                    )

        battery_pct = sample["battery_pct"]
        if battery_pct < reserve_pct:
            violations.append(
                {
                    "code": "battery",
                    "t_s": t_s,
                    "measured": battery_pct,
                    "limit": reserve_pct,
                    "detail": (
                        f"t={t_s}s: battery {battery_pct}% below "
                        f"reserve {reserve_pct}% while airborne"
                    ),
                }
            )

    return violations


def _read_replay(
    replay_dir: Path,
) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    """Read and schema-validate manifest.json, mission.json and telemetry.jsonl."""
    manifest = json.loads((replay_dir / "manifest.json").read_text(encoding="utf-8"))
    contract.validate("replay-manifest", manifest)
    mission = json.loads((replay_dir / "mission.json").read_text(encoding="utf-8"))
    contract.validate("mission", mission)

    samples: list[dict[str, Any]] = []
    telemetry_path = replay_dir / "telemetry.jsonl"
    for line_no, line in enumerate(telemetry_path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            sample = json.loads(line)
            contract.validate("telemetry-sample", sample)
        except ValueError as e:
            raise ValueError(f"{telemetry_path.name} line {line_no}: {e}") from e
        samples.append(sample)
    return manifest, mission, samples


def main(argv: list[str] | None = None) -> int:
    """CLI entry point: validate a replay folder against a scenario and the schemas."""
    parser = argparse.ArgumentParser(
        prog="droneos_sim.oracle",
        description="Validate a replay folder (manifest, mission, telemetry) and "
        "re-check every MISSION/RTL sample against the scenario constraints.",
    )
    parser.add_argument(
        "replay_dir", type=Path, help="folder with manifest/mission/telemetry.jsonl"
    )
    parser.add_argument("scenario", type=Path, help="path to the scenario JSON file")
    args = parser.parse_args(argv)

    try:
        scenario = json.loads(args.scenario.read_text(encoding="utf-8"))
        contract.validate("scenario", scenario)
        _, _, samples = _read_replay(args.replay_dir)
    except (OSError, ValueError) as e:
        # Fail closed: unreadable files, bad JSON and schema errors are all exit 1.
        print(json.dumps({"ok": False, "violations": [], "error": str(e)}))
        return 1

    violations = check(scenario, samples)
    print(json.dumps({"ok": not violations, "violations": violations}))
    return 0 if not violations else 1


if __name__ == "__main__":
    sys.exit(main())
