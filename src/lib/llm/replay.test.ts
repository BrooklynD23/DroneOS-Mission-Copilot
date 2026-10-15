import { describe, expect, it } from "vitest";
import { getScenario } from "../scenarios";
import { normalizeRequest, replayKey } from "./key";
import { createReplayProvider } from "./replay";
import { selectProvider } from "./select";
import { ReplayMissError } from "./types";

const scenario = getScenario("north-roof");
if (!scenario) throw new Error("missing scenario");
const m = (id: string) => ({
  mission_id: id,
  speed_mps: 5,
  waypoints: [],
  notes: [],
});

describe("key", () => {
  it("normalizes", () => {
    expect(normalizeRequest("  Inspect   THE\troof ")).toBe("inspect the roof");
    expect(replayKey("a", " X  y ")).toBe(replayKey("a", "x y"));
    expect(replayKey("a", "x")).not.toBe(replayKey("b", "x"));
    expect(replayKey("a", "x")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("replay provider", () => {
  const request = "Inspect the roof";
  const p = createReplayProvider([
    {
      key: replayKey(scenario.id, request),
      request,
      plan: m("p"),
      repairs: [m("r1"), m("r2")],
    },
  ]);
  it("hit", async () => {
    expect(p.name).toBe("replay");
    expect(
      (await p.plan({ scenario, request: " inspect the  ROOF" })).mission_id,
    ).toBe("p");
  });
  it("repair rounds", async () => {
    const base = { scenario, request, mission: m("x"), violations: [] };
    expect((await p.repair({ ...base, round: 1 })).mission_id).toBe("r1");
    expect((await p.repair({ ...base, round: 2 })).mission_id).toBe("r2");
  });
  it("miss", async () => {
    await expect(p.plan({ scenario, request: "other" })).rejects.toBeInstanceOf(
      ReplayMissError,
    );
    const q = createReplayProvider([
      {
        key: replayKey(scenario.id, request),
        request,
        plan: m("p"),
        repairs: [m("r1")],
      },
    ]);
    await expect(
      q.repair({
        scenario,
        request,
        mission: m("x"),
        violations: [],
        round: 2,
      }),
    ).rejects.toBeInstanceOf(ReplayMissError);
  });
  it("caption passthrough", async () => {
    await expect(p.caption({ scenario, findings: [] })).resolves.toEqual([]);
  });
  it("selectProvider", () => {
    expect(selectProvider({ live: false }).name).toBe("replay");
    expect(selectProvider({ live: true, apiKey: "k" }).name).toBe("anthropic");
    expect(() => selectProvider({ live: true })).toThrow();
  });
});
