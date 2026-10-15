import { createHash } from "node:crypto";

export const normalizeRequest = (request: string): string =>
  request.trim().toLowerCase().replace(/\s+/g, " ");

export const replayKey = (scenarioId: string, request: string): string =>
  createHash("sha256")
    .update(`${scenarioId}\n${normalizeRequest(request)}`)
    .digest("hex");
