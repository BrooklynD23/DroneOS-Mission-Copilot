import { describe, expect, it } from "vitest";
import { checkRequest, isPreset } from "./request";

describe("checkRequest", () => {
  it("accepts 3 and 500 chars after trim", () => {
    expect(checkRequest("  abc  ").ok).toBe(true);
    expect(checkRequest("a".repeat(500)).ok).toBe(true);
  });
  it("rejects too short (after trim) and too long", () => {
    const short = checkRequest("  ab  ");
    expect(short.ok).toBe(false);
    expect(short.message).toBeTruthy();
    expect(checkRequest("").ok).toBe(false);
    expect(checkRequest("a".repeat(501)).ok).toBe(false);
  });
});

describe("isPreset", () => {
  const presets = ["Inspect the north roof, stay below 40 m"];
  it("matches ignoring case and whitespace", () => {
    expect(
      isPreset("  inspect the NORTH roof,   stay below 40 m ", presets),
    ).toBe(true);
  });
  it("rejects edited text", () => {
    expect(isPreset("Inspect the south roof", presets)).toBe(false);
  });
});
