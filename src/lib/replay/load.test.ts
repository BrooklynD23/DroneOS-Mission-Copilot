import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadReplay, replayFromSynth } from "./load";

const sample = (t: number, frame?: string) =>
  JSON.stringify({
    t_s: t,
    ts: "2026-10-14T00:00:00.000Z",
    lat: 1,
    lon: 2,
    alt_m: 3,
    battery_pct: 90,
    mode: "MISSION",
    ...(frame ? { frame_id: frame } : {}),
  });
const manifest = {
  scenario_id: "x",
  source: "synthetic",
  created: "2026-10-14T00:00:00.000Z",
  frame_ext: "svg",
  frame_count: 1,
  duration_s: 1,
};
const real = (n: string): string =>
  readFileSync(`public/replays/north-roof/${n}`, "utf8");
const mission = JSON.parse(real("mission.json"));
const report = JSON.parse(real("report.json"));

const files = (jsonl: string): Record<string, string> => ({
  "/replays/x/manifest.json": JSON.stringify(manifest),
  "/replays/x/mission.json": JSON.stringify(mission),
  "/replays/x/telemetry.jsonl": jsonl,
  "/replays/x/report.json": JSON.stringify(report),
});
const fake = (f: Record<string, string>) => async (u: RequestInfo | URL) => {
  const body = f[String(u)];
  return body === undefined
    ? new Response("", { status: 404 })
    : new Response(body);
};

describe("loadReplay", () => {
  it("loads and derives frames", async () => {
    const r = await loadReplay(
      "x",
      fake(files(`${sample(0)}\n${sample(1, "000001")}\n`)),
    );
    expect(r?.samples).toHaveLength(2);
    expect(r?.frames).toEqual([
      {
        id: "000001",
        t_s: 1,
        lat: 1,
        lon: 2,
        alt_m: 3,
        url: "/replays/x/frames/000001.svg",
      },
    ]);
  });
  it("404 manifest -> null", async () => {
    expect(await loadReplay("x", fake({}))).toBeNull();
  });
  it("corrupt line names line number", async () => {
    await expect(
      loadReplay("x", fake(files(`${sample(0)}\n{bad\n`))),
    ).rejects.toThrow(/line 2/);
  });
  it("schema-invalid line names line number", async () => {
    await expect(
      loadReplay("x", fake(files(`${sample(0)}\n{"t_s":-1}\n`))),
    ).rejects.toThrow(/line 2/);
  });
  it("missing other file throws", async () => {
    const f = files(sample(0));
    delete f["/replays/x/report.json"];
    await expect(loadReplay("x", fake(f))).rejects.toThrow(/report/);
  });
  it("rejects bad scenario id", async () => {
    await expect(loadReplay("../x", fake({}))).rejects.toThrow();
  });
});

describe("replayFromSynth", () => {
  it("uses data urls", () => {
    const r = replayFromSynth(
      {
        manifest: manifest as never,
        mission: mission as never,
        telemetry: [JSON.parse(sample(1, "000001"))],
        frames: [{ id: "000001", svg: "<svg/>" }],
      },
      report as never,
    );
    expect(r.frames[0]?.url).toBe(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent("<svg/>")}`,
    );
  });
});
