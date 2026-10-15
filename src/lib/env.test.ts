import { describe, expect, it } from "vitest";
import { getServerConfig, isLive } from "./env";

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

describe("getServerConfig", () => {
  it("is not live when no env vars are set", () => {
    const config = getServerConfig({});
    expect(config.liveConfigured).toBe(false);
    expect(config.apiKey).toBeUndefined();
    expect(config.accessCode).toBeUndefined();
  });

  it("is not live when only the api key is set", () => {
    const config = getServerConfig({ ANTHROPIC_API_KEY: "sk-test" });
    expect(config.liveConfigured).toBe(false);
  });

  it("is not live when only the access code is set", () => {
    const config = getServerConfig({ DEMO_ACCESS_CODE: "code123" });
    expect(config.liveConfigured).toBe(false);
  });

  it("is live when both vars are set", () => {
    const config = getServerConfig({
      ANTHROPIC_API_KEY: "sk-test",
      DEMO_ACCESS_CODE: "code123",
    });
    expect(config.liveConfigured).toBe(true);
    expect(config.apiKey).toBe("sk-test");
    expect(config.accessCode).toBe("code123");
  });

  it("treats empty strings as unset", () => {
    const config = getServerConfig({
      ANTHROPIC_API_KEY: "",
      DEMO_ACCESS_CODE: "",
    });
    expect(config.liveConfigured).toBe(false);
  });

  it("defaults the tile URL to OSM", () => {
    expect(getServerConfig({}).tileUrl).toBe(DEFAULT_TILE_URL);
  });

  it("uses the tile URL override when set", () => {
    const config = getServerConfig({
      NEXT_PUBLIC_TILE_URL: "https://tiles.example.com/{z}/{x}/{y}.png",
    });
    expect(config.tileUrl).toBe("https://tiles.example.com/{z}/{x}/{y}.png");
  });
});

describe("isLive", () => {
  const liveConfig = getServerConfig({
    ANTHROPIC_API_KEY: "sk-test",
    DEMO_ACCESS_CODE: "code123",
  });
  const replayConfig = getServerConfig({});

  it("is true when configured and the access code matches", () => {
    expect(isLive(liveConfig, "code123")).toBe(true);
  });

  it("is false for a wrong code", () => {
    expect(isLive(liveConfig, "nope123")).toBe(false);
  });

  it("is false for a short code", () => {
    expect(isLive(liveConfig, "cod")).toBe(false);
  });

  it("is false for an empty code", () => {
    expect(isLive(liveConfig, "")).toBe(false);
  });

  it("is false when no code is given", () => {
    expect(isLive(liveConfig)).toBe(false);
  });

  it("is false in replay mode even with a code", () => {
    expect(isLive(replayConfig, "code123")).toBe(false);
  });
});
