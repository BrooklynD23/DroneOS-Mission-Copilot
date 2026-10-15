import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows `limit` requests then blocks the next with retryAfterS > 0", () => {
    const t = 0;
    const limiter = createRateLimiter({
      limit: 10,
      windowMs: 60_000,
      now: () => t,
    });
    for (let i = 0; i < 10; i++) {
      const result = limiter.check("ip-1");
      expect(result.ok).toBe(true);
      expect(result.retryAfterS).toBe(0);
    }
    const blocked = limiter.check("ip-1");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterS).toBeGreaterThan(0);
  });

  it("reports seconds until the oldest hit in the window expires", () => {
    let t = 0;
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => t,
    });
    limiter.check("ip-1");
    t = 30_000;
    expect(limiter.check("ip-1")).toEqual({ ok: false, retryAfterS: 30 });
  });

  it("slides the window with the injected clock", () => {
    let t = 0;
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 1_000,
      now: () => t,
    });
    expect(limiter.check("ip-1").ok).toBe(true); // t=0
    t = 500;
    expect(limiter.check("ip-1").ok).toBe(true); // stamps [0, 500]
    t = 900;
    expect(limiter.check("ip-1").ok).toBe(false); // both still in window
    t = 1_001;
    expect(limiter.check("ip-1").ok).toBe(true); // t=0 expired → [500, 1001]
    t = 1_501;
    expect(limiter.check("ip-1").ok).toBe(true); // t=500 expired → [1001, 1501]
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
    });
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("b").ok).toBe(true);
    expect(limiter.check("a").ok).toBe(false);
  });

  it("evicts the least recently checked key past maxKeys", () => {
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: () => 0,
      maxKeys: 3,
    });
    limiter.check("a");
    limiter.check("b");
    limiter.check("c");
    limiter.check("d"); // over maxKeys → evicts 'a'
    expect(limiter.size).toBe(3);
    expect(limiter.check("b").ok).toBe(false); // 'b' still tracked and at limit
    expect(limiter.check("a").ok).toBe(true); // 'a' was evicted → fresh budget
    expect(limiter.size).toBe(3);
  });

  it("a recent check protects a key from eviction", () => {
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 60_000,
      now: () => 0,
      maxKeys: 2,
    });
    limiter.check("a");
    limiter.check("b");
    limiter.check("a"); // refresh 'a' → eviction order: b, a; 'a' now at limit
    limiter.check("c"); // over maxKeys → evicts 'b'
    expect(limiter.check("a").ok).toBe(false); // 'a' still tracked → denied
    expect(limiter.check("b").ok).toBe(true); // 'b' evicted → fresh budget
  });
});
