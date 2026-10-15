import type { Ring } from "../schema/geo";
import type { Mission } from "../schema/mission";
import type { Finding } from "../schema/report";
import type { Scenario } from "../schema/scenario";
import type { Violation } from "../schema/validation";

export interface Provider {
  name: "anthropic" | "replay";
  plan(i: {
    scenario: Scenario;
    request: string;
    area?: Ring;
  }): Promise<Mission>;
  repair(i: {
    scenario: Scenario;
    request: string;
    mission: Mission;
    violations: Violation[];
    round: 1 | 2;
  }): Promise<Mission>;
  /** must cite only given frame IDs */
  caption(i: { scenario: Scenario; findings: Finding[] }): Promise<Finding[]>;
}

export class UpstreamError extends Error {
  constructor(
    message = "The planning service failed",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "UpstreamError";
  }
}

export class ReplayMissError extends Error {
  constructor(message = "Live mode is off; pick a preset request") {
    super(message);
    this.name = "ReplayMissError";
  }
}
