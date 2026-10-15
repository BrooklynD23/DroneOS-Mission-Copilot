// ponytail: per-instance memory; limits reset on cold start and are not shared across instances. Upgrade: @upstash/ratelimit (RESEARCH-01 §4).

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
  maxKeys?: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterS: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  readonly size: number;
}

// Sliding-window log: each key stores the timestamps of its allowed hits.
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 10_000;
  const hits = new Map<string, number[]>();

  // Re-insert on every touch so Map order runs least → most recently seen,
  // then drop the oldest keys until within maxKeys.
  function remember(key: string, stamps: number[]): void {
    hits.delete(key);
    hits.set(key, stamps);
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      hits.delete(oldest);
    }
  }

  return {
    get size() {
      return hits.size;
    },
    check(key: string): RateLimitResult {
      const t = now();
      const cutoff = t - windowMs;
      const stamps = (hits.get(key) ?? []).filter((s) => s > cutoff);
      if (stamps.length >= limit) {
        // Denied hits are not logged, but the touch keeps a hot key tracked.
        remember(key, stamps);
        const oldest = stamps[0] ?? t;
        return {
          ok: false,
          retryAfterS: Math.max(1, Math.ceil((oldest + windowMs - t) / 1000)),
        };
      }
      stamps.push(t);
      remember(key, stamps);
      return { ok: true, retryAfterS: 0 };
    },
  };
}
