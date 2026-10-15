import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicProvider } from "./anthropic";
import injection from "./fixtures/injection.json";
import northRoof from "./fixtures/north-roof.json";
import solarEast from "./fixtures/solar-east.json";
import { createReplayProvider, Fixture } from "./replay";
import type { Provider } from "./types";

const FIXTURES = [...northRoof, ...solarEast, ...injection].map((f) =>
  Fixture.parse(f),
);

export function selectProvider({
  live,
  apiKey,
}: {
  live: boolean;
  apiKey?: string;
}): Provider {
  if (!live) return createReplayProvider(FIXTURES);
  if (!apiKey) throw new Error("live mode needs an API key");
  return createAnthropicProvider(
    new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 }),
  );
}
