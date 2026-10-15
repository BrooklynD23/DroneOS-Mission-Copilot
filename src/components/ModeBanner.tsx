"use client";

import styles from "./ModeBanner.module.css";

export type ModeBannerProps = { mode: "live" | "replay"; model?: string };

export function ModeBanner({
  mode,
  model = "claude-sonnet-5-5",
}: ModeBannerProps) {
  const live = mode === "live";
  return (
    <p
      className={`${styles.banner} ${live ? styles.live : styles.replay}`}
      role="status"
    >
      <span aria-hidden="true">{live ? "●" : "▶"}</span>{" "}
      {live ? `LIVE · ${model}` : "REPLAY · recorded fixtures (no API calls)"}
    </p>
  );
}
