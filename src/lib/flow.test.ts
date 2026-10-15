import { describe, expect, it } from "vitest";
import { canAutoFix, type FlowState, initialFlow, reduce } from "./flow";
import type { Mission } from "./schema/mission";
import type { RepairDiff, ValidationResult } from "./schema/validation";

const mission = { waypoints: [] } as unknown as Mission;
const good = { ok: true, violations: [] } as unknown as ValidationResult;
const bad = {
  ok: false,
  violations: [{ code: "x" }],
} as unknown as ValidationResult;
const diff = { source: "llm", round: 1, changes: [] } as unknown as RepairDiff;

const s0 = initialFlow("north-roof");
const planning = reduce(s0, { type: "PLAN_START" });
const reviewBad = reduce(planning, {
  type: "PLAN_OK",
  mission,
  validation: bad,
});
const reviewGood = reduce(planning, {
  type: "PLAN_OK",
  mission,
  validation: good,
});
const repairing = reduce(reviewBad, { type: "REPAIR_START" });

describe("flow legal transitions", () => {
  it("edits inputs", () => {
    expect(reduce(s0, { type: "SET_REQUEST", request: "hi" }).request).toBe(
      "hi",
    );
    const area = [[0, 0]] as never;
    expect(reduce(s0, { type: "SET_AREA", area }).area).toBe(area);
  });
  it("plans", () => {
    expect(planning.phase).toBe("planning");
    expect(reviewBad.phase).toBe("review");
    expect(reviewBad.mission).toBe(mission);
  });
  it("repairs", () => {
    expect(repairing.phase).toBe("repairing");
    expect(repairing.round).toBe(1);
    const ok = reduce(repairing, {
      type: "REPAIR_OK",
      mission,
      validation: good,
      diff,
    });
    expect(ok.phase).toBe("review");
    expect(ok.diffs).toEqual([diff]);
  });
  it("autofix", () => {
    const ev = { type: "AUTOFIX_OK", mission, validation: good, diff } as const;
    expect(reduce(reviewBad, ev)).toBe(reviewBad);
    const miss = reduce(repairing, {
      type: "FAIL",
      error: { code: "replay_miss", message: "m" },
    });
    const ok = reduce(miss, {
      type: "AUTOFIX_OK",
      mission,
      validation: good,
      diff,
    });
    expect(ok.phase).toBe("review");
    expect(ok.diffs).toEqual([diff]);
  });
  it("approve, fly, report, reset", () => {
    const a = reduce(reviewGood, { type: "APPROVE" });
    expect(a.phase).toBe("approved");
    const f = reduce(a, { type: "FLY_START" });
    expect(f.phase).toBe("flying");
    expect(reduce(f, { type: "FLY_END" }).phase).toBe("report");
    expect(reduce(f, { type: "RESET" })).toEqual(s0);
  });
  it("FAIL records error and returns to review or idle", () => {
    const e = { code: "upstream" as const, message: "m" };
    expect(reduce(planning, { type: "FAIL", error: e })).toMatchObject({
      phase: "idle",
      error: e,
    });
    expect(reduce(repairing, { type: "FAIL", error: e })).toMatchObject({
      phase: "review",
      error: e,
    });
  });
  it("SELECT_SCENARIO resets all but scenario", () => {
    expect(
      reduce(reviewBad, { type: "SELECT_SCENARIO", scenarioId: "solar-east" }),
    ).toEqual(initialFlow("solar-east"));
  });
});

describe("flow guards", () => {
  it("illegal events keep same reference", () => {
    for (const ev of [
      { type: "FLY_START" },
      { type: "FLY_END" },
      { type: "APPROVE" },
      { type: "REPAIR_START" },
      { type: "PLAN_OK", mission, validation: good },
    ] as const) {
      expect(reduce(s0, ev)).toBe(s0);
    }
    expect(reduce(planning, { type: "PLAN_START" })).toBe(planning);
  });
  it("approve blocked while violations", () => {
    expect(reduce(reviewBad, { type: "APPROVE" })).toBe(reviewBad);
  });
  it("repair start blocked when valid", () => {
    expect(reduce(reviewGood, { type: "REPAIR_START" })).toBe(reviewGood);
  });
  it("round cap at 2", () => {
    let s: FlowState = reviewBad;
    for (let i = 0; i < 2; i++) {
      s = reduce(s, { type: "REPAIR_START" });
      s = reduce(s, { type: "REPAIR_OK", mission, validation: bad, diff });
    }
    expect(s.round).toBe(2);
    expect(reduce(s, { type: "REPAIR_START" })).toBe(s);
    expect(canAutoFix(s)).toBe(true);
  });
  it("canAutoFix", () => {
    expect(canAutoFix(reviewBad)).toBe(false);
    expect(canAutoFix(reviewGood)).toBe(false);
    const miss = reduce(repairing, {
      type: "FAIL",
      error: { code: "replay_miss", message: "m" },
    });
    expect(canAutoFix(miss)).toBe(true);
  });
});
