import { describe, expect, it } from "vitest";
import {
  clientIp,
  errorResponse,
  HttpError,
  MAX_BODY_BYTES,
  RATE_LIMIT,
  RATE_WINDOW_MS,
  readJsonBody,
} from "./guard";

const ENDPOINT = "http://localhost/api/plan";

function jsonRequest(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(ENDPOINT, { method: "POST", body, headers });
}

function streamingRequest(chunks: Uint8Array[]): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  return new Request(ENDPOINT, {
    method: "POST",
    body: stream,
    // undici requires duplex:'half' for stream bodies; absent from TS dom types.
    duplex: "half",
  } as RequestInit);
}

describe("clientIp", () => {
  it("returns the first x-forwarded-for hop", () => {
    const req = new Request(ENDPOINT, {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("trims whitespace around the first hop", () => {
    const req = new Request(ENDPOINT, {
      headers: { "x-forwarded-for": "1.2.3.4 , 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("returns a single hop as-is", () => {
    const req = new Request(ENDPOINT, {
      headers: { "x-forwarded-for": "9.9.9.9" },
    });
    expect(clientIp(req)).toBe("9.9.9.9");
  });

  it("returns 'unknown' when the header is missing", () => {
    expect(clientIp(new Request(ENDPOINT))).toBe("unknown");
  });

  it("returns 'unknown' when the first hop is empty", () => {
    const req = new Request(ENDPOINT, {
      headers: { "x-forwarded-for": ", 5.6.7.8" },
    });
    expect(clientIp(req)).toBe("unknown");
  });
});

describe("readJsonBody", () => {
  it("parses a JSON body under the cap", async () => {
    const req = jsonRequest(JSON.stringify({ op: "plan", n: 1 }));
    await expect(readJsonBody(req, 1024)).resolves.toEqual({
      op: "plan",
      n: 1,
    });
  });

  it("rejects when content-length is over the cap", async () => {
    const req = jsonRequest("x", { "content-length": "5000" });
    const err = await readJsonBody(req, 1024).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).code).toBe("too_large");
    expect((err as HttpError).status).toBe(413);
  });

  it("rejects while streaming past the cap with no content-length", async () => {
    const chunk = new TextEncoder().encode("a".repeat(100));
    const req = streamingRequest([chunk, chunk]); // 200 bytes over the wire
    const err = await readJsonBody(req, 150).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).code).toBe("too_large");
    expect((err as HttpError).status).toBe(413);
  });

  it("accepts a streamed JSON body within the cap", async () => {
    const bytes = new TextEncoder().encode('{"op":"plan","n":7}');
    const req = streamingRequest([bytes.subarray(0, 5), bytes.subarray(5)]);
    await expect(readJsonBody(req, 1024)).resolves.toEqual({
      op: "plan",
      n: 7,
    });
  });

  it("rejects invalid JSON with bad_request", async () => {
    const req = jsonRequest("{not json");
    const err = await readJsonBody(req, 1024).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).code).toBe("bad_request");
    expect((err as HttpError).status).toBe(400);
  });

  it("rejects an empty body as bad_request", async () => {
    const req = new Request(ENDPOINT, { method: "POST" });
    const err = await readJsonBody(req, 1024).catch((e: unknown) => e);
    expect((err as HttpError).code).toBe("bad_request");
  });

  it("does not echo raw input in error messages", async () => {
    const req = jsonRequest('{"secret-token": "abc123"');
    const err = await readJsonBody(req, 1024).catch((e: unknown) => e);
    expect((err as HttpError).message).not.toContain("abc123");
    expect((err as HttpError).message).not.toContain("secret-token");
  });
});

describe("errorResponse", () => {
  it("returns the typed error envelope with the given status", async () => {
    const res = errorResponse("rate_limited", "slow down", 429);
    expect(res.status).toBe(429);
    expect(res.headers.get("content-type")).toContain("application/json");
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: { code: "rate_limited", message: "slow down" },
    });
  });

  it("merges extra headers", () => {
    const res = errorResponse("rate_limited", "slow down", 429, {
      "retry-after": "30",
    });
    expect(res.headers.get("retry-after")).toBe("30");
  });
});

describe("guard constants", () => {
  it("exports MAX_BODY_BYTES, RATE_LIMIT and RATE_WINDOW_MS", () => {
    expect(MAX_BODY_BYTES).toBe(16_384);
    expect(RATE_LIMIT).toBe(10);
    expect(RATE_WINDOW_MS).toBe(60_000);
  });
});
