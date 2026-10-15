import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { getScenario } from "../scenarios";
import type { Finding } from "../schema/report";
import { createAnthropicProvider } from "./anthropic";
import { UpstreamError } from "./types";

const scenario = getScenario("north-roof");
if (!scenario) throw new Error("missing scenario");
const mission = {
  mission_id: "m1",
  speed_mps: 5,
  waypoints: [
    {
      id: "wp1",
      lat: 47.398,
      lon: 8.545,
      alt_m: 30,
      action: "none" as const,
      hold_s: 0,
    },
  ],
  notes: [],
};
const finding: Finding = {
  poi_id: "roof-hatch-n",
  label: "Roof hatch N",
  status: "observed",
  evidence: [{ frame_id: "f1", t_s: 1, lat: 47.3, lon: 8.5, alt_m: 30 }],
  caption: "template",
};

function fake(result: unknown) {
  const parse = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  const client = { messages: { parse } } as unknown as Anthropic;
  return { parse, provider: createAnthropicProvider(client) };
}

describe("anthropic provider", () => {
  it("plan uses sonnet and a schema format", async () => {
    const { parse, provider } = fake({
      stop_reason: "end_turn",
      parsed_output: mission,
    });
    expect(provider.name).toBe("anthropic");
    await expect(provider.plan({ scenario, request: "go" })).resolves.toEqual(
      mission,
    );
    const arg = parse.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(arg[0].model).toBe("claude-sonnet-5-5");
    expect(arg[0].max_tokens).toBe(4096);
    expect(arg[0].output_config).toHaveProperty("format");
  });
  it("repair uses sonnet", async () => {
    const { parse, provider } = fake({
      stop_reason: "end_turn",
      parsed_output: mission,
    });
    await provider.repair({
      scenario,
      request: "go",
      mission,
      violations: [],
      round: 1,
    });
    expect(
      (parse.mock.calls[0] as unknown as [{ model: string }])[0].model,
    ).toBe("claude-sonnet-5-5");
  });
  it("caption uses haiku and merges captions", async () => {
    const { parse, provider } = fake({
      stop_reason: "end_turn",
      parsed_output: {
        captions: [{ poi_id: "roof-hatch-n", caption: "Hatch seen" }],
      },
    });
    const out = await provider.caption({ scenario, findings: [finding] });
    expect(out[0]?.caption).toBe("Hatch seen");
    expect(out[0]?.evidence).toEqual(finding.evidence);
    expect(
      (parse.mock.calls[0] as unknown as [{ model: string }])[0].model,
    ).toBe("claude-haiku-5-5");
  });
  it("caption ignores unknown poi ids", async () => {
    const { provider } = fake({
      stop_reason: "end_turn",
      parsed_output: { captions: [{ poi_id: "nope", caption: "x" }] },
    });
    const out = await provider.caption({ scenario, findings: [finding] });
    expect(out[0]?.caption).toBe("template");
  });
  it("caption citing an unknown frame keeps the template caption", async () => {
    const { provider } = fake({
      stop_reason: "end_turn",
      parsed_output: {
        captions: [{ poi_id: "roof-hatch-n", caption: "Hatch at 999999" }],
      },
    });
    const out = await provider.caption({ scenario, findings: [finding] });
    expect(out[0]?.caption).toBe("template");
  });
  it("abstained finding stays uncaptioned", async () => {
    const abstained: Finding = { ...finding, status: "abstained" };
    const { provider } = fake({
      stop_reason: "end_turn",
      parsed_output: {
        captions: [{ poi_id: "roof-hatch-n", caption: "Hatch seen" }],
      },
    });
    const out = await provider.caption({ scenario, findings: [abstained] });
    expect(out[0]?.caption).toBe("template");
  });
  it("refusal -> UpstreamError", async () => {
    const { provider } = fake({ stop_reason: "refusal", parsed_output: null });
    await expect(
      provider.plan({ scenario, request: "go" }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
  it("sdk throw -> UpstreamError with cause", async () => {
    const boom = new Error("secret detail");
    const { provider } = fake(boom);
    const err = await provider
      .plan({ scenario, request: "go" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.message).not.toContain("secret");
    expect(err.cause).toBe(boom);
  });
  it("invalid output -> UpstreamError", async () => {
    const { provider } = fake({
      stop_reason: "end_turn",
      parsed_output: { bad: 1 },
    });
    await expect(
      provider.plan({ scenario, request: "go" }),
    ).rejects.toBeInstanceOf(UpstreamError);
    await expect(
      provider.caption({ scenario, findings: [finding] }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});
