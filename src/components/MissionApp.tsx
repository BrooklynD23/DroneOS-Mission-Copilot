"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { getHealth, postPlan } from "@/lib/api-client";
import {
  canAutoFix,
  type FlowEvent,
  type FlowState,
  initialFlow,
  reduce,
} from "@/lib/flow";
import { autoFix, buildRepairDiff } from "@/lib/repair";
import { loadReplay, type Replay, replayFromSynth } from "@/lib/replay/load";
import {
  advance,
  pickSource,
  type Speed,
  sampleAt,
  timeOfFrame,
} from "@/lib/replay/player";
import { synthReplay } from "@/lib/replay/synth";
import { buildReport } from "@/lib/report/report";
import type { Scenario } from "@/lib/schema/scenario";
import { validate } from "@/lib/validator/validate";
import styles from "./MissionApp.module.css";
import { ModeBanner } from "./ModeBanner";
import { PlanPanel } from "./PlanPanel";
import { ReplayPlayer } from "./ReplayPlayer";
import { ReportPanel } from "./ReportPanel";
import { ReviewPanel } from "./ReviewPanel";

const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <p className={styles.mapLoading}>Loading map…</p>,
});

// ponytail: MapView rebuilds every layer per render, so playback state updates
// at 10 Hz; split the drone marker into its own effect to animate at frame rate.
const UI_TICK_MS = 100;

export type MissionAppProps = {
  scenarios: readonly Scenario[];
  tileUrl: string;
};

const PLACEHOLDER = {
  review:
    "Validator findings and the approval diff appear here before anything flies.",
  fly: "Replayed telemetry and map playback appear here once a mission is approved.",
  report: "The evidence-linked mission report appears here after playback.",
} as const;

function errorText(s: FlowState, notice: string | null): string | null {
  if (s.error?.code === "replay_miss")
    return `${s.error.message} Replay mode only knows the preset requests: use one of the preset buttons.`;
  return s.error?.message ?? notice;
}

export function MissionApp({ scenarios, tileUrl }: MissionAppProps) {
  const first = scenarios[0];
  if (!first) throw new Error("MissionApp requires at least one scenario");
  const [flow, dispatch] = useReducer(
    (s: FlowState, e: FlowEvent) => reduce(s, e),
    first.id,
    initialFlow,
  );
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [mode, setMode] = useState<"live" | "replay">("replay");
  const [model, setModel] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [report, setReport] = useState<Replay["report"] | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const tRef = useRef(0);

  const scenario = scenarios.find((s) => s.id === flow.scenarioId) ?? first;
  const code = accessCode || undefined;
  const busy = flow.phase === "planning" || flow.phase === "repairing";

  useEffect(() => {
    getHealth().then((h) => setLiveAvailable(h.live_available));
  }, []);

  const seek = useCallback((next: number) => {
    tRef.current = next;
    setT(next);
  }, []);

  const clearFlight = useCallback(() => {
    setReplay(null);
    setReport(null);
    setPlaying(false);
    seek(0);
  }, [seek]);

  // Playback loop: rAF + advance(); React state updates throttled to UI_TICK_MS.
  const duration = replay?.manifest.duration_s ?? 0;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let shown = last;
    const frame = (now: number) => {
      const next = advance(tRef.current, now - last, speed, duration);
      last = now;
      tRef.current = next;
      if (next >= duration) {
        setT(next);
        setPlaying(false);
        dispatch({ type: "FLY_END" });
        return;
      }
      if (now - shown >= UI_TICK_MS) {
        shown = now;
        setT(next);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, duration]);

  const accept = (res: { mode: "live" | "replay"; model?: string }) => {
    setMode(res.mode);
    setModel(res.model);
  };

  const onPlan = async () => {
    if (flow.phase !== "idle") return;
    setNotice(null);
    dispatch({ type: "PLAN_START" });
    const res = await postPlan({
      op: "plan",
      scenario_id: scenario.id,
      request: flow.request.trim(),
      area: flow.area,
      access_code: code,
    });
    if (res.ok && res.mission && res.validation) {
      accept(res);
      dispatch({
        type: "PLAN_OK",
        mission: res.mission,
        validation: res.validation,
      });
    } else {
      dispatch({
        type: "FAIL",
        error: res.ok
          ? { code: "upstream", message: "Incomplete plan response" }
          : res.error,
      });
    }
  };

  const onRepair = async () => {
    const before = flow.mission;
    if (!before || flow.round >= 2) return;
    const round = (flow.round + 1) as 1 | 2;
    dispatch({ type: "REPAIR_START" });
    const res = await postPlan({
      op: "repair",
      scenario_id: scenario.id,
      request: flow.request.trim(),
      mission: before,
      round,
      access_code: code,
    });
    if (res.ok && res.mission && res.validation) {
      accept(res);
      dispatch({
        type: "REPAIR_OK",
        mission: res.mission,
        validation: res.validation,
        diff: buildRepairDiff("llm", round, before, res.mission, scenario),
      });
    } else {
      dispatch({
        type: "FAIL",
        error: res.ok
          ? { code: "upstream", message: "Incomplete repair response" }
          : res.error,
      });
    }
  };

  const onAutoFix = () => {
    const before = flow.mission;
    if (!before) return;
    const { mission } = autoFix(before, scenario);
    dispatch({
      type: "AUTOFIX_OK",
      mission,
      validation: validate(mission, scenario),
      diff: buildRepairDiff("deterministic", 0, before, mission, scenario),
    });
  };

  const onApprove = async () => {
    const mission = flow.mission;
    if (!mission || !flow.validation?.ok) return;
    dispatch({ type: "APPROVE" });
    setNotice(null);
    try {
      const recorded = await loadReplay(scenario.id);
      let next: Replay;
      if (recorded && pickSource(mission, recorded.mission) === "recorded") {
        next = recorded;
      } else {
        const out = synthReplay({
          scenario,
          mission,
          created: new Date().toISOString(),
        });
        next = replayFromSynth(
          out,
          buildReport(scenario, mission.mission_id, out.telemetry),
        );
      }
      setReplay(next);
      setReport(next.report);
      seek(0);
      setSpeed(1);
      setPlaying(
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
      dispatch({ type: "FLY_START" });
      if (mode === "live") {
        const res = await postPlan({
          op: "report",
          scenario_id: scenario.id,
          mission,
          evidence: next.report.findings,
          access_code: code,
        });
        if (res.ok && res.report) setReport(res.report); // failure keeps template
      }
    } catch {
      setNotice("Could not load the replay. Reload the page and try again.");
    }
  };

  const onSeekFrame = (id: string) => {
    const at = replay && timeOfFrame(replay.frames, id);
    if (at === undefined || at === null) return;
    setPlaying(false);
    seek(at);
  };

  const mission = replay?.mission ?? flow.mission;
  const badIds = (flow.validation?.violations ?? []).flatMap((v) =>
    v.waypoint_id ? [v.waypoint_id] : [],
  );
  const drone = replay ? sampleAt(replay.samples, t) : undefined;
  const idle = flow.phase === "idle";
  const reviewing = flow.phase === "review" && flow.mission && flow.validation;

  return (
    <div className={styles.layout}>
      <div className={styles.banner}>
        <ModeBanner mode={mode} model={model} />
      </div>
      <div className={styles.map}>
        <MapView
          tileUrl={tileUrl}
          home={scenario.home}
          geofence={scenario.constraints.geofence}
          noFly={scenario.constraints.no_fly}
          area={flow.area ?? scenario.area}
          editableArea={idle || flow.phase === "review"}
          onAreaChange={(area) => dispatch({ type: "SET_AREA", area })}
          path={mission?.waypoints ?? []}
          badWaypointIds={replay ? [] : badIds}
          drone={drone}
          pois={scenario.pois}
        />
      </div>
      <div className={styles.panels}>
        <section
          id="plan"
          className={styles.panel}
          aria-labelledby="plan-heading"
        >
          <h2 id="plan-heading" className={styles.title}>
            Plan
          </h2>
          <PlanPanel
            scenarios={scenarios}
            scenarioId={scenario.id}
            request={flow.request}
            presets={scenario.preset_requests}
            liveAvailable={liveAvailable}
            accessCode={accessCode}
            busy={busy || !idle}
            error={errorText(flow, notice)}
            onScenario={(id) => {
              clearFlight();
              setNotice(null);
              dispatch({ type: "SELECT_SCENARIO", scenarioId: id });
            }}
            onRequest={(request) => dispatch({ type: "SET_REQUEST", request })}
            onAccessCode={setAccessCode}
            onPlan={onPlan}
          />
          {!idle && !busy && (
            <button
              type="button"
              onClick={() => {
                clearFlight();
                setNotice(null);
                dispatch({ type: "RESET" });
              }}
            >
              Start over
            </button>
          )}
        </section>
        <section
          id="review"
          className={styles.panel}
          aria-labelledby="review-heading"
        >
          <h2 id="review-heading" className={styles.title}>
            Review
          </h2>
          {flow.mission && flow.validation ? (
            <ReviewPanel
              mission={flow.mission}
              validation={flow.validation}
              diffs={flow.diffs}
              round={flow.round}
              canRepair={
                !!reviewing &&
                !flow.validation.ok &&
                flow.round < 2 &&
                flow.error?.code !== "replay_miss"
              }
              canAutoFix={canAutoFix(flow)}
              busy={busy || flow.phase !== "review"}
              onRepair={onRepair}
              onAutoFix={onAutoFix}
              onApprove={onApprove}
            />
          ) : (
            <p className={styles.body}>{PLACEHOLDER.review}</p>
          )}
        </section>
        <section
          id="fly"
          className={styles.panel}
          aria-labelledby="fly-heading"
        >
          <h2 id="fly-heading" className={styles.title}>
            Fly
          </h2>
          {replay ? (
            <ReplayPlayer
              replay={replay}
              t={t}
              playing={playing}
              speed={speed}
              onSeek={(next) => {
                setPlaying(false);
                seek(next);
              }}
              onPlayPause={() => setPlaying((p) => !p)}
              onSpeed={setSpeed}
            />
          ) : (
            <p className={styles.body}>{PLACEHOLDER.fly}</p>
          )}
        </section>
        <section
          id="report"
          className={styles.panel}
          aria-labelledby="report-heading"
        >
          <h2 id="report-heading" className={styles.title}>
            Report
          </h2>
          {replay && report ? (
            <ReportPanel
              report={report}
              frames={replay.frames}
              onSeekFrame={onSeekFrame}
            />
          ) : (
            <p className={styles.body}>{PLACEHOLDER.report}</p>
          )}
        </section>
      </div>
    </div>
  );
}
