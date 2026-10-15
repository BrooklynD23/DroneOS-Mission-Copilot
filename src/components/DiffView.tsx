"use client";

import type { Waypoint } from "@/lib/schema/mission";
import type { RepairDiff } from "@/lib/schema/validation";
import styles from "./ReviewPanel.module.css";

const wp = (w?: Waypoint) =>
  w ? `${w.lat.toFixed(5)}, ${w.lon.toFixed(5)} @ ${w.alt_m} m` : "—";
const source = (d: RepairDiff) =>
  d.source === "llm" ? `LLM repair round ${d.round}` : "DETERMINISTIC FIX";

export function DiffView({ diffs }: { diffs: readonly RepairDiff[] }) {
  if (diffs.length === 0) return null;
  return (
    <section aria-label="Changes">
      {diffs.map((d) => (
        <table key={`${d.source}-${d.round}`} className={styles.diff}>
          <caption>{source(d)}</caption>
          <thead>
            <tr>
              <th scope="col">Change</th>
              <th scope="col">Waypoint</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
            </tr>
          </thead>
          <tbody>
            {d.changes.map((c) => (
              <tr key={`${c.kind}-${c.waypoint_id}`}>
                <td>{c.kind}</td>
                <td>{c.waypoint_id}</td>
                <td>{wp(c.before)}</td>
                <td>{wp(c.after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </section>
  );
}
