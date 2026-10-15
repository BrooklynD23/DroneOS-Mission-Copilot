"use client";

import type { Replay } from "../lib/replay/load";
import { frameAt, type Speed, sampleAt } from "../lib/replay/player";
import { formatTime, sourceLabel } from "../lib/ui/telemetry-format";
import { FrameViewer } from "./FrameViewer";
import styles from "./ReplayPlayer.module.css";
import { TelemetryStrip } from "./TelemetryStrip";

export type ReplayPlayerProps = {
  replay: Replay;
  t: number;
  playing: boolean;
  speed: Speed;
  onSeek: (t: number) => void;
  onPlayPause: () => void;
  onSpeed: (s: Speed) => void;
};

const SPEEDS: readonly Speed[] = [1, 2, 4];

export function ReplayPlayer(p: ReplayPlayerProps) {
  const { manifest, samples, frames } = p.replay;
  const i = samples.findLastIndex((s) => s.t_s <= p.t);
  return (
    <section
      className={styles.player}
      aria-label="Replay player"
      onKeyDown={(e) => {
        if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          p.onPlayPause();
        }
      }}
    >
      <p className={styles.source} role="status">
        {sourceLabel(manifest)} · {p.speed}×
      </p>
      <FrameViewer frame={frameAt(frames, p.t)} />
      <TelemetryStrip
        position={sampleAt(samples, p.t)}
        mode={samples[Math.max(i, 0)]?.mode}
      />
      <div className={styles.controls}>
        <button type="button" onClick={p.onPlayPause} aria-pressed={p.playing}>
          {p.playing ? "Pause" : "Play"}
        </button>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === p.speed}
            onClick={() => p.onSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
      <label>
        Time
        <input
          className={styles.scrub}
          type="range"
          min={0}
          max={manifest.duration_s}
          step={1}
          value={p.t}
          aria-valuetext={`t = ${formatTime(p.t)}`}
          onChange={(e) => p.onSeek(Number(e.target.value))}
        />
      </label>
    </section>
  );
}
