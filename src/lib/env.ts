import { timingSafeEqual } from "node:crypto";

export const DEFAULT_TILE_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export interface ServerConfig {
  liveConfigured: boolean;
  apiKey?: string;
  accessCode?: string;
  tileUrl: string;
}

export function getServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const apiKey = env.ANTHROPIC_API_KEY || undefined;
  const accessCode = env.DEMO_ACCESS_CODE || undefined;
  return {
    liveConfigured: Boolean(apiKey && accessCode),
    apiKey,
    accessCode,
    tileUrl: env.NEXT_PUBLIC_TILE_URL || DEFAULT_TILE_URL,
  };
}

export function isLive(config: ServerConfig, accessCode?: string): boolean {
  if (!config.liveConfigured || !config.accessCode || !accessCode) {
    return false;
  }
  const expected = Buffer.from(config.accessCode, "utf8");
  const given = Buffer.from(accessCode, "utf8");
  if (expected.length !== given.length) {
    return false;
  }
  return timingSafeEqual(expected, given);
}
