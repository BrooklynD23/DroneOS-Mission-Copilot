"use client";

import type { ValidationResult } from "@/lib/schema/validation";
import { summary, toBadges } from "@/lib/ui/badges";
import styles from "./ReviewPanel.module.css";

export function ConstraintBadges({
  validation,
}: {
  validation: ValidationResult;
}) {
  return (
    <div>
      <p role="status" className={styles.summary}>
        {summary(validation)}
      </p>
      <ul className={styles.badges}>
        {toBadges(validation).map((b) => (
          <li key={b.code} className={b.ok ? styles.ok : styles.bad}>
            {b.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
