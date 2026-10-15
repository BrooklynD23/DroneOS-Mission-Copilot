import { z } from "zod";
import { Mission } from "../schema/mission";
import { replayKey } from "./key";
import { type Provider, ReplayMissError } from "./types";

export const Fixture = z
  .object({
    key: z.string(),
    request: z.string(),
    plan: Mission,
    repairs: z.array(Mission).max(2),
  })
  .strict();
export type Fixture = z.infer<typeof Fixture>;

export function createReplayProvider(fixtures: Fixture[]): Provider {
  const find = (scenarioId: string, request: string) => {
    const hit = fixtures.find((f) => f.key === replayKey(scenarioId, request));
    if (!hit) throw new ReplayMissError();
    return hit;
  };
  return {
    name: "replay",
    plan: async ({ scenario, request }) => find(scenario.id, request).plan,
    repair: async ({ scenario, request, round }) => {
      const r = find(scenario.id, request).repairs[round - 1];
      if (!r) throw new ReplayMissError();
      return r;
    },
    caption: async ({ findings }) => findings,
  };
}
