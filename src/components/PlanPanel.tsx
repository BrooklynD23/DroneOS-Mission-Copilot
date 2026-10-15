"use client";

import { checkRequest, isPreset } from "@/lib/ui/request";
import styles from "./PlanPanel.module.css";

export type PlanPanelProps = {
  scenarios: readonly { id: string; title: string }[];
  scenarioId: string;
  request: string;
  presets: readonly string[];
  liveAvailable: boolean;
  accessCode: string;
  busy: boolean;
  error?: string | null;
  onScenario: (id: string) => void;
  onRequest: (text: string) => void;
  onAccessCode: (code: string) => void;
  onPlan: () => void;
};

export function PlanPanel(p: PlanPanelProps) {
  const check = checkRequest(p.request);
  return (
    <form
      className={styles.panel}
      onSubmit={(e) => {
        e.preventDefault();
        if (!p.busy && check.ok) p.onPlan();
      }}
    >
      <label className={styles.field}>
        Scenario
        <select
          value={p.scenarioId}
          onChange={(e) => p.onScenario(e.target.value)}
        >
          {p.scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </label>
      <fieldset className={styles.presets}>
        <legend>Preset requests</legend>
        {p.presets.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={isPreset(p.request, [t])}
            onClick={() => p.onRequest(t)}
          >
            {t}
          </button>
        ))}
      </fieldset>
      <label className={styles.field}>
        Inspection request
        <textarea
          maxLength={500}
          rows={4}
          value={p.request}
          onChange={(e) => p.onRequest(e.target.value)}
        />
      </label>
      <p className={styles.count}>{p.request.length}/500</p>
      {p.liveAvailable && (
        <label className={styles.field}>
          Access code
          <input
            type="password"
            autoComplete="off"
            value={p.accessCode}
            onChange={(e) => p.onAccessCode(e.target.value)}
          />
        </label>
      )}
      <button type="submit" disabled={p.busy || !check.ok}>
        {p.busy ? "Planning…" : "Plan"}
      </button>
      {!check.ok && p.request.length > 0 && (
        <p className={styles.hint}>{check.message}</p>
      )}
      {p.error && (
        <p role="alert" className={styles.error}>
          <span aria-hidden="true">✗</span> {p.error}
        </p>
      )}
    </form>
  );
}
