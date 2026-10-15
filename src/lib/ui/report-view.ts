import type { Evidence, Finding, Report } from "../schema/report";

export function orderFindings(report: Report): Finding[] {
  const by = (s: Finding["status"]) =>
    report.findings.filter((f) => f.status === s);
  return [...by("observed"), ...by("abstained")];
}

export function chipLabel(e: Evidence): string {
  return `${e.frame_id} · ${Math.round(e.t_s)} s · ${e.lat.toFixed(5)}, ${e.lon.toFixed(5)} · ${Math.round(e.alt_m)} m`;
}

export function counts(report: Report): {
  observed: number;
  abstained: number;
} {
  const observed = report.findings.filter(
    (f) => f.status === "observed",
  ).length;
  return { observed, abstained: report.findings.length - observed };
}
