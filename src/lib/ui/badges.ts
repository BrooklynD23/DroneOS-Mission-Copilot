import type { ValidationResult, ViolationCode } from "../schema/validation";

export type Badge = {
  code: ViolationCode;
  label: string;
  ok: boolean;
  text: string;
};

const CHECKS: readonly (readonly [ViolationCode, string])[] = [
  ["geofence", "GEOFENCE"],
  ["ceiling", "CEILING"],
  ["min_alt", "MIN ALT"],
  ["no_fly", "NO-FLY"],
  ["battery", "BATTERY"],
  ["max_waypoints", "WAYPOINTS"],
  ["max_leg", "LEG LENGTH"],
];

export function toBadges(v: ValidationResult): Badge[] {
  return CHECKS.map(([code, label]) => {
    const hits = v.violations.filter((x) => x.code === code);
    const first = hits[0];
    if (first) {
      const n = hits.length > 1 ? ` ×${hits.length}` : "";
      return {
        code,
        label,
        ok: false,
        text: `✗ ${label}${n} — ${first.detail}`,
      };
    }
    const why =
      code === "battery"
        ? `${Math.round(v.stats.reserve_left_pct)}% reserve left`
        : "ok";
    return { code, label, ok: true, text: `✓ ${label} — ${why}` };
  });
}

export function summary(v: ValidationResult): string {
  if (v.ok && v.violations.length === 0)
    return `✓ All ${CHECKS.length} checks pass`;
  const failing = new Set(v.violations.map((x) => x.code)).size;
  return `✗ ${v.violations.length} violations in ${failing} of ${CHECKS.length} checks`;
}
