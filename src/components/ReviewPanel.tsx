"use client";

import type { Mission } from "@/lib/schema/mission";
import type { RepairDiff, ValidationResult } from "@/lib/schema/validation";
import { ConstraintBadges } from "./ConstraintBadges";
import { DiffView } from "./DiffView";
import styles from "./ReviewPanel.module.css";

export type ReviewPanelProps = {
  mission: Mission;
  validation: ValidationResult;
  diffs: readonly RepairDiff[];
  round: number;
  canRepair: boolean;
  canAutoFix: boolean;
  busy: boolean;
  onRepair: () => void;
  onAutoFix: () => void;
  onApprove: () => void;
};

export function ReviewPanel(p: ReviewPanelProps) {
  const blocked = !p.validation.ok;
  return (
    <section className={styles.panel} aria-label="Mission review">
      <ConstraintBadges validation={p.validation} />
      <table className={styles.wps}>
        <caption>Waypoints ({p.mission.waypoints.length})</caption>
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Lat</th>
            <th scope="col">Lon</th>
            <th scope="col">Alt (m)</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {p.mission.waypoints.map((w) => (
            <tr key={w.id}>
              <th scope="row">{w.id}</th>
              <td>{w.lat.toFixed(5)}</td>
              <td>{w.lon.toFixed(5)}</td>
              <td>{w.alt_m}</td>
              <td>{w.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <DiffView diffs={p.diffs} />
      <div className={styles.actions}>
        {p.canRepair && (
          <button type="button" disabled={p.busy} onClick={p.onRepair}>
            Repair (round {p.round}/2)
          </button>
        )}
        {p.canAutoFix && (
          <button type="button" disabled={p.busy} onClick={p.onAutoFix}>
            Deterministic fix
          </button>
        )}
        <button
          type="button"
          disabled={p.busy || blocked}
          aria-describedby={blocked ? "approve-reason" : undefined}
          onClick={p.onApprove}
        >
          Approve
        </button>
      </div>
      {blocked && (
        <p id="approve-reason" className={styles.reason}>
          Approve disabled: {p.validation.violations.length} violation(s) must
          be fixed first.
        </p>
      )}
    </section>
  );
}
