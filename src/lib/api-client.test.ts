import { describe, expect, it } from "vitest";
import { getHealth, postPlan } from "./api-client";
import type { PlanRequest } from "./schema/api";

const body: PlanRequest = {
  op: "plan",
  scenario_id: "north-roof",
  request: "Inspect roof",
};
const UNAVAILABLE = {
  ok: false,
  error: {
    code: "upstream",
    message: "Service unavailable, try again or use a preset",
  },
};
const reply = (status: number, data: string) => async () =>
  new Response(data, { status });

describe("postPlan", () => {
  it("returns parsed 200", async () => {
    const r = await postPlan(
      body,
      reply(200, JSON.stringify({ ok: true, mode: "replay" })),
    );
    expect(r).toEqual({ ok: true, mode: "replay" });
  });
  it("returns 422 replay_miss body", async () => {
    const e = { ok: false, error: { code: "replay_miss", message: "no" } };
    expect(await postPlan(body, reply(422, JSON.stringify(e)))).toEqual(e);
  });
  it("returns 429 body", async () => {
    const e = { ok: false, error: { code: "rate_limited", message: "slow" } };
    expect(await postPlan(body, reply(429, JSON.stringify(e)))).toEqual(e);
  });
  it("non-JSON 500 -> upstream", async () => {
    expect(await postPlan(body, reply(500, "<html>"))).toEqual(UNAVAILABLE);
  });
  it("schema-invalid body -> upstream", async () => {
    expect(await postPlan(body, reply(200, '{"ok":true,"mode":"x"}'))).toEqual(
      UNAVAILABLE,
    );
  });
  it("rejected fetch -> upstream", async () => {
    expect(
      await postPlan(body, async () => Promise.reject(new Error("net"))),
    ).toEqual(UNAVAILABLE);
  });
  it("abort -> upstream", async () => {
    const f = async () => {
      throw new DOMException("timeout", "TimeoutError");
    };
    expect(await postPlan(body, f)).toEqual(UNAVAILABLE);
  });
  it("posts JSON with a signal", async () => {
    let init: RequestInit | undefined;
    await postPlan(body, async (_u, i) => {
      init = i;
      return new Response("{}", { status: 500 });
    });
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify(body));
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("getHealth", () => {
  it("parses health", async () => {
    expect(await getHealth(reply(200, '{"live_available":true}'))).toEqual({
      live_available: true,
    });
  });
  it("falls back to not live on failure", async () => {
    expect(await getHealth(async () => Promise.reject(new Error("x")))).toEqual(
      { live_available: false },
    );
    expect(await getHealth(reply(500, "no"))).toEqual({
      live_available: false,
    });
  });
});
