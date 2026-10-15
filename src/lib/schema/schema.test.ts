import { describe, expect, it } from "vitest";
import { Health, PlanRequest, PlanResponse } from "./api";
import { LatLon, Ring } from "./geo";
import { Mission, Waypoint } from "./mission";
import { Frame, ReplayManifest, TelemetrySample } from "./replay";
import { Evidence, Finding, Report } from "./report";
import { Constraints, NoFlyZone, Poi, Scenario } from "./scenario";
import {
  RepairDiff,
  ValidationResult,
  Violation,
  ViolationCode,
} from "./validation";

const LAT_LON = { lat: 45.5231, lon: -122.6765 };

const RING = [
  { lat: 45.5, lon: -122.7 },
  { lat: 45.55, lon: -122.7 },
  { lat: 45.55, lon: -122.65 },
];

const WAYPOINT = {
  id: "wp1",
  lat: 45.5231,
  lon: -122.6765,
  alt_m: 30,
  action: "photo",
  hold_s: 5,
};

const MISSION = {
  mission_id: "m-001",
  speed_mps: 8,
  waypoints: [WAYPOINT],
  notes: ["inspect north roof edge"],
};

const NO_FLY_ZONE = { id: "nfz-1", name: "School", ring: RING };

const CONSTRAINTS = {
  geofence: RING,
  no_fly: [NO_FLY_ZONE],
  ceiling_m: 120,
  min_alt_m: 10,
  max_waypoints: 50,
  max_leg_m: 500,
  battery_wh: 120,
  cruise_power_w: 180,
  reserve_pct: 20,
};

const POI = {
  id: "poi-1",
  label: "Roof unit",
  lat: 45.524,
  lon: -122.677,
  radius_m: 15,
};

const SCENARIO = {
  id: "north-roof",
  title: "North roof",
  home: LAT_LON,
  area: RING,
  constraints: CONSTRAINTS,
  pois: [POI],
  preset_requests: ["Inspect the north roof"],
};

const VIOLATION = {
  code: "ceiling",
  waypoint_id: "wp1",
  measured: 130,
  limit: 120,
  detail: "alt above ceiling",
};

const STATS = {
  route_m: 800,
  flight_s: 120,
  energy_wh: 40,
  reserve_left_pct: 25,
};

const VALIDATION_OK = { ok: true, violations: [], stats: STATS };
const VALIDATION_BAD = { ok: false, violations: [VIOLATION], stats: STATS };

const REPAIR_DIFF = {
  source: "deterministic",
  round: 1,
  changes: [
    {
      kind: "altitude",
      waypoint_id: "wp1",
      before: WAYPOINT,
      after: { ...WAYPOINT, alt_m: 110 },
    },
  ],
  before: VALIDATION_BAD,
  after: VALIDATION_OK,
};

const TELEMETRY_SAMPLE = {
  t_s: 0.5,
  ts: "2026-10-14T12:00:00Z",
  lat: 45.5231,
  lon: -122.6765,
  alt_m: 30,
  battery_pct: 98,
  mode: "POSHOLD",
  frame_id: "000123",
};

const REPLAY_MANIFEST = {
  scenario_id: "north-roof",
  source: "synthetic",
  created: "2026-10-14T12:00:00Z",
  frame_ext: "svg",
  frame_count: 240,
  duration_s: 120,
};

const FRAME = {
  id: "000123",
  t_s: 60,
  lat: 45.5231,
  lon: -122.6765,
  alt_m: 30,
  url: "/replays/north-roof/frames/000123.svg",
};

const EVIDENCE = {
  frame_id: "000123",
  t_s: 60,
  lat: 45.5231,
  lon: -122.6765,
  alt_m: 30,
};

const FINDING_OBSERVED = {
  poi_id: "poi-1",
  label: "Roof unit",
  status: "observed",
  evidence: [EVIDENCE],
  caption: "Roof unit visible in frame 000123",
};

const FINDING_ABSTAINED = {
  poi_id: "poi-2",
  label: "Gutter",
  status: "abstained",
  evidence: [],
  caption: "No usable frame",
  abstain_reason: "POI never in frame",
};

const REPORT = {
  scenario_id: "north-roof",
  mission_id: "m-001",
  generated_by: "template",
  findings: [FINDING_OBSERVED],
};

const PLAN_REQUEST = {
  op: "plan",
  scenario_id: "north-roof",
  request: "Inspect the north roof, stay below 40 m",
};

const REPAIR_REQUEST = {
  op: "repair",
  scenario_id: "north-roof",
  request: "Inspect the north roof",
  mission: MISSION,
  round: 2,
};

const REPORT_REQUEST = {
  op: "report",
  scenario_id: "north-roof",
  mission: MISSION,
  evidence: [FINDING_OBSERVED],
};

describe("LatLon", () => {
  it("accepts a valid point", () => {
    expect(LatLon.safeParse(LAT_LON).success).toBe(true);
  });
  it("rejects an out-of-range latitude", () => {
    expect(LatLon.safeParse({ ...LAT_LON, lat: 91 }).success).toBe(false);
  });
});

describe("Ring", () => {
  it("accepts a ring of >= 3 points", () => {
    expect(Ring.safeParse(RING).success).toBe(true);
  });
  it("rejects fewer than 3 points", () => {
    expect(Ring.safeParse(RING.slice(0, 2)).success).toBe(false);
  });
});

describe("Waypoint", () => {
  it("accepts a valid waypoint", () => {
    expect(Waypoint.safeParse(WAYPOINT).success).toBe(true);
  });
  it("rejects a bad action", () => {
    expect(Waypoint.safeParse({ ...WAYPOINT, action: "land" }).success).toBe(
      false,
    );
  });
});

describe("Mission", () => {
  it("accepts a valid mission", () => {
    expect(Mission.safeParse(MISSION).success).toBe(true);
  });
  it("rejects extra keys (strict)", () => {
    expect(Mission.safeParse({ ...MISSION, home: LAT_LON }).success).toBe(
      false,
    );
  });
  it("rejects more than 50 waypoints", () => {
    const waypoints = Array.from({ length: 51 }, (_, i) => ({
      ...WAYPOINT,
      id: `wp${i + 1}`,
    }));
    expect(Mission.safeParse({ ...MISSION, waypoints }).success).toBe(false);
  });
  it("rejects a bad waypoint id pattern", () => {
    expect(
      Mission.safeParse({
        ...MISSION,
        waypoints: [{ ...WAYPOINT, id: "wp1234" }],
      }).success,
    ).toBe(false);
    expect(
      Mission.safeParse({
        ...MISSION,
        waypoints: [{ ...WAYPOINT, id: "wpt1" }],
      }).success,
    ).toBe(false);
  });
});

describe("NoFlyZone", () => {
  it("accepts a valid zone", () => {
    expect(NoFlyZone.safeParse(NO_FLY_ZONE).success).toBe(true);
  });
  it("rejects a zone with extra keys", () => {
    expect(NoFlyZone.safeParse({ ...NO_FLY_ZONE, alt_m: 50 }).success).toBe(
      false,
    );
  });
});

describe("Constraints", () => {
  it("accepts valid constraints", () => {
    expect(Constraints.safeParse(CONSTRAINTS).success).toBe(true);
  });
  it("rejects a non-positive ceiling", () => {
    expect(
      Constraints.safeParse({ ...CONSTRAINTS, ceiling_m: 0 }).success,
    ).toBe(false);
  });
});

describe("Poi", () => {
  it("accepts a valid poi", () => {
    expect(Poi.safeParse(POI).success).toBe(true);
  });
  it("rejects a non-positive radius", () => {
    expect(Poi.safeParse({ ...POI, radius_m: -1 }).success).toBe(false);
  });
});

describe("Scenario", () => {
  it("accepts a valid scenario", () => {
    expect(Scenario.safeParse(SCENARIO).success).toBe(true);
  });
  it("rejects a preset request over 500 chars", () => {
    expect(
      Scenario.safeParse({
        ...SCENARIO,
        preset_requests: ["x".repeat(501)],
      }).success,
    ).toBe(false);
  });
});

describe("ViolationCode", () => {
  it("accepts a known code", () => {
    expect(ViolationCode.safeParse("no_fly").success).toBe(true);
  });
  it("rejects an unknown code", () => {
    expect(ViolationCode.safeParse("altitude").success).toBe(false);
  });
});

describe("Violation", () => {
  it("accepts a valid violation", () => {
    expect(Violation.safeParse(VIOLATION).success).toBe(true);
  });
  it("rejects a violation without detail", () => {
    const { detail: _detail, ...rest } = VIOLATION;
    expect(Violation.safeParse(rest).success).toBe(false);
  });
});

describe("ValidationResult", () => {
  it("accepts a valid result", () => {
    expect(ValidationResult.safeParse(VALIDATION_OK).success).toBe(true);
  });
  it("rejects missing stats", () => {
    const { stats: _stats, ...rest } = VALIDATION_OK;
    expect(ValidationResult.safeParse(rest).success).toBe(false);
  });
});

describe("RepairDiff", () => {
  it("accepts a valid diff", () => {
    expect(RepairDiff.safeParse(REPAIR_DIFF).success).toBe(true);
  });
  it("rejects round > 2", () => {
    expect(RepairDiff.safeParse({ ...REPAIR_DIFF, round: 3 }).success).toBe(
      false,
    );
  });
});

describe("TelemetrySample", () => {
  it("accepts a valid sample", () => {
    expect(TelemetrySample.safeParse(TELEMETRY_SAMPLE).success).toBe(true);
  });
  it("rejects a negative t_s", () => {
    expect(
      TelemetrySample.safeParse({ ...TELEMETRY_SAMPLE, t_s: -1 }).success,
    ).toBe(false);
  });
  it("accepts frame_id matching 6 digits and rejects other patterns", () => {
    expect(
      TelemetrySample.safeParse({ ...TELEMETRY_SAMPLE, frame_id: "000001" })
        .success,
    ).toBe(true);
    expect(
      TelemetrySample.safeParse({ ...TELEMETRY_SAMPLE, frame_id: "12345" })
        .success,
    ).toBe(false);
    expect(
      TelemetrySample.safeParse({ ...TELEMETRY_SAMPLE, frame_id: "1234567" })
        .success,
    ).toBe(false);
    expect(
      TelemetrySample.safeParse({ ...TELEMETRY_SAMPLE, frame_id: "frame1" })
        .success,
    ).toBe(false);
  });
});

describe("ReplayManifest", () => {
  it("accepts a valid manifest", () => {
    expect(ReplayManifest.safeParse(REPLAY_MANIFEST).success).toBe(true);
  });
  it("rejects a bad source", () => {
    expect(
      ReplayManifest.safeParse({ ...REPLAY_MANIFEST, source: "live" }).success,
    ).toBe(false);
  });
});

describe("Frame", () => {
  it("accepts a valid frame", () => {
    expect(Frame.safeParse(FRAME).success).toBe(true);
  });
  it("rejects a frame with extra keys", () => {
    expect(Frame.safeParse({ ...FRAME, extra: 1 }).success).toBe(false);
  });
});

describe("Evidence", () => {
  it("accepts valid evidence", () => {
    expect(Evidence.safeParse(EVIDENCE).success).toBe(true);
  });
  it("rejects missing frame_id", () => {
    const { frame_id: _frameId, ...rest } = EVIDENCE;
    expect(Evidence.safeParse(rest).success).toBe(false);
  });
});

describe("Finding cross-field rules", () => {
  it("accepts observed with >= 1 evidence", () => {
    expect(Finding.safeParse(FINDING_OBSERVED).success).toBe(true);
  });
  it("rejects observed with no evidence", () => {
    expect(
      Finding.safeParse({ ...FINDING_OBSERVED, evidence: [] }).success,
    ).toBe(false);
  });
  it("accepts abstained with abstain_reason", () => {
    expect(Finding.safeParse(FINDING_ABSTAINED).success).toBe(true);
  });
  it("rejects abstained without abstain_reason", () => {
    const { abstain_reason: _reason, ...rest } = FINDING_ABSTAINED;
    expect(Finding.safeParse(rest).success).toBe(false);
  });
  it("rejects findings with extra keys", () => {
    expect(
      Finding.safeParse({ ...FINDING_OBSERVED, confidence: 0.9 }).success,
    ).toBe(false);
  });
});

describe("Report", () => {
  it("accepts a valid report", () => {
    expect(Report.safeParse(REPORT).success).toBe(true);
  });
  it("rejects an unknown generated_by", () => {
    expect(Report.safeParse({ ...REPORT, generated_by: "gpt" }).success).toBe(
      false,
    );
  });
});

describe("PlanRequest", () => {
  it("accepts plan, repair and report ops", () => {
    expect(PlanRequest.safeParse(PLAN_REQUEST).success).toBe(true);
    expect(PlanRequest.safeParse(REPAIR_REQUEST).success).toBe(true);
    expect(PlanRequest.safeParse(REPORT_REQUEST).success).toBe(true);
  });
  it("rejects an unknown op", () => {
    expect(
      PlanRequest.safeParse({ ...PLAN_REQUEST, op: "delete" }).success,
    ).toBe(false);
  });
  it("rejects a request over 500 chars", () => {
    expect(
      PlanRequest.safeParse({
        ...PLAN_REQUEST,
        request: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
  it("rejects round: 3", () => {
    expect(PlanRequest.safeParse({ ...REPAIR_REQUEST, round: 3 }).success).toBe(
      false,
    );
  });
  it("rejects extra keys (strict)", () => {
    expect(
      PlanRequest.safeParse({ ...PLAN_REQUEST, admin: true }).success,
    ).toBe(false);
  });
});

describe("PlanResponse", () => {
  it("accepts ok and error responses", () => {
    expect(
      PlanResponse.safeParse({ ok: true, mode: "replay", mission: MISSION })
        .success,
    ).toBe(true);
    expect(
      PlanResponse.safeParse({
        ok: false,
        error: { code: "rate_limited", message: "slow down" },
      }).success,
    ).toBe(true);
  });
  it("rejects an invalid error code", () => {
    expect(
      PlanResponse.safeParse({
        ok: false,
        error: { code: "mystery", message: "?" },
      }).success,
    ).toBe(false);
  });
});

describe("Health", () => {
  it("accepts a valid health payload", () => {
    expect(Health.safeParse({ live_available: false }).success).toBe(true);
  });
  it("rejects a non-boolean flag", () => {
    expect(Health.safeParse({ live_available: "yes" }).success).toBe(false);
  });
});
