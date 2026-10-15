import injectionJson from "../data/scenarios/injection.json";
import northRoofJson from "../data/scenarios/north-roof.json";
import solarEastJson from "../data/scenarios/solar-east.json";
import { Scenario } from "./schema/scenario";

// Zod-parse at module load: a malformed scenario file fails fast on import.
const SCENARIOS: Scenario[] = [northRoofJson, solarEastJson, injectionJson].map(
  (raw) => Scenario.parse(raw),
);

const BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));

export function listScenarios(): Scenario[] {
  return [...SCENARIOS];
}

export function getScenario(id: string): Scenario | undefined {
  return BY_ID.get(id);
}
