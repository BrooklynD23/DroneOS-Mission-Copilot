"use client";

import type { Frame } from "@/lib/schema/replay";
import type { Report } from "@/lib/schema/report";
import { chipLabel, counts, orderFindings } from "@/lib/ui/report-view";
import styles from "./ReportPanel.module.css";

export type ReportPanelProps = {
  report: Report;
  frames: readonly Frame[];
  onSeekFrame: (id: string) => void;
};

export function ReportPanel({ report, frames, onSeekFrame }: ReportPanelProps) {
  const all = orderFindings(report);
  const observed = all.filter((f) => f.status === "observed");
  const abstained = all.filter((f) => f.status === "abstained");
  const c = counts(report);
  const ai = report.generated_by !== "template";
  return (
    <section className={styles.panel} aria-label="Mission report">
      <p>
        <strong>
          {c.observed} observed, {c.abstained} abstained
        </strong>{" "}
        <span className={styles.badge}>{ai ? "AI" : "TEMPLATE"}</span>
      </p>
      <ul className={styles.list}>
        {observed.map((f) => (
          <li key={f.poi_id}>
            <strong>✓ {f.label}</strong>
            <p>{f.caption}</p>
            <div className={styles.chips}>
              {f.evidence.map((e) => (
                <button
                  key={e.frame_id}
                  type="button"
                  className={styles.chip}
                  disabled={!frames.some((fr) => fr.id === e.frame_id)}
                  onClick={() => onSeekFrame(e.frame_id)}
                >
                  {chipLabel(e)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <h3>Abstentions</h3>
      {abstained.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul className={styles.list}>
          {abstained.map((f) => (
            <li key={f.poi_id}>
              ⚠ {f.label}: {f.abstain_reason}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
