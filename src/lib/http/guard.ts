import type { PlanResponse } from "../schema/api";

export const MAX_BODY_BYTES = 16_384;
export const RATE_LIMIT = 10;
export const RATE_WINDOW_MS = 60_000;

export type ErrorCode = Extract<PlanResponse, { ok: false }>["error"]["code"];

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.code = code;
    this.status = status;
  }
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (!forwarded) {
    return "unknown";
  }
  const first = forwarded.split(",")[0]?.trim();
  return first ? first : "unknown";
}

// Rejects (throws HttpError) when content-length is over maxBytes, when the
// stream grows past maxBytes, or when the body is not valid JSON. Messages
// never echo raw input.
export async function readJsonBody(
  req: Request,
  maxBytes: number,
): Promise<unknown> {
  const declared = req.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBytes) {
    throw new HttpError(
      "too_large",
      `body exceeds ${maxBytes}-byte limit`,
      413,
    );
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (req.body !== null) {
    const reader = req.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done || value === undefined) {
          break;
        }
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new HttpError(
            "too_large",
            `body exceeds ${maxBytes}-byte limit`,
            413,
          );
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new HttpError("bad_request", "body is not valid JSON", 400);
  }
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  headers?: HeadersInit,
): Response {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers },
  );
}
