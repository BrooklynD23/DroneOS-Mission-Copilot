import type { Ring } from "./schema/geo";
import type { Mission } from "./schema/mission";
import type { RepairDiff, ValidationResult } from "./schema/validation";

export type Phase =
  | "idle"
  | "planning"
  | "review"
  | "repairing"
  | "approved"
  | "flying"
  | "report";
export type FlowError = { code: string; message: string };

export type FlowState = {
  phase: Phase;
  scenarioId: string;
  request: string;
  area?: Ring;
  mission?: Mission;
  validation?: ValidationResult;
  diffs: RepairDiff[];
  round: 0 | 1 | 2;
  error?: FlowError;
};

type Fix = { mission: Mission; validation: ValidationResult; diff: RepairDiff };

export type FlowEvent =
  | { type: "SELECT_SCENARIO"; scenarioId: string }
  | { type: "SET_REQUEST"; request: string }
  | { type: "SET_AREA"; area: Ring | undefined }
  | { type: "PLAN_START" }
  | { type: "PLAN_OK"; mission: Mission; validation: ValidationResult }
  | { type: "FAIL"; error: FlowError }
  | { type: "REPAIR_START" }
  | ({ type: "REPAIR_OK" } & Fix)
  | ({ type: "AUTOFIX_OK" } & Fix)
  | { type: "APPROVE" }
  | { type: "FLY_START" }
  | { type: "FLY_END" }
  | { type: "RESET" };

export const initialFlow = (scenarioId: string): FlowState => ({
  phase: "idle",
  scenarioId,
  request: "",
  diffs: [],
  round: 0,
});

export function canAutoFix(s: FlowState): boolean {
  if (s.phase !== "review" || !s.validation || s.validation.ok) return false;
  return s.round === 2 || s.error?.code === "replay_miss";
}

export function reduce(s: FlowState, e: FlowEvent): FlowState {
  switch (e.type) {
    case "SELECT_SCENARIO":
      return initialFlow(e.scenarioId);
    case "RESET":
      return initialFlow(s.scenarioId);
    case "SET_REQUEST":
      return { ...s, request: e.request };
    case "SET_AREA":
      return { ...s, area: e.area };
    case "PLAN_START":
      if (s.phase !== "idle") return s;
      return { ...s, phase: "planning", error: undefined };
    case "PLAN_OK":
      if (s.phase !== "planning") return s;
      return {
        ...s,
        phase: "review",
        mission: e.mission,
        validation: e.validation,
        error: undefined,
      };
    case "FAIL":
      if (s.phase !== "planning" && s.phase !== "repairing") return s;
      return { ...s, phase: s.mission ? "review" : "idle", error: e.error };
    case "REPAIR_START":
      if (
        s.phase !== "review" ||
        !s.validation ||
        s.validation.ok ||
        s.round >= 2
      )
        return s;
      return {
        ...s,
        phase: "repairing",
        round: (s.round + 1) as 1 | 2,
        error: undefined,
      };
    case "REPAIR_OK":
      if (s.phase !== "repairing") return s;
      return applyFix(s, e);
    case "AUTOFIX_OK":
      if (!canAutoFix(s)) return s;
      return applyFix(s, e);
    case "APPROVE":
      if (s.phase !== "review" || !s.validation?.ok) return s;
      return { ...s, phase: "approved" };
    case "FLY_START":
      return s.phase === "approved" ? { ...s, phase: "flying" } : s;
    case "FLY_END":
      return s.phase === "flying" ? { ...s, phase: "report" } : s;
  }
}

function applyFix(s: FlowState, e: Fix): FlowState {
  return {
    ...s,
    phase: "review",
    mission: e.mission,
    validation: e.validation,
    diffs: [...s.diffs, e.diff],
    error: undefined,
  };
}
