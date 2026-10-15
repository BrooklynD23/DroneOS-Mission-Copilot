import type { Position } from "../lib/replay/player";
import {
  formatAlt,
  formatBattery,
  formatLatLon,
} from "../lib/ui/telemetry-format";

export type TelemetryStripProps = {
  position: Position | undefined;
  mode: string | undefined;
};

export function TelemetryStrip({ position, mode }: TelemetryStripProps) {
  if (position === undefined) return <p>No telemetry.</p>;
  return (
    <dl aria-label="Telemetry">
      <dt>Alt</dt>
      <dd>{formatAlt(position.alt_m)}</dd>
      <dt>Battery</dt>
      <dd>{formatBattery(position.battery_pct)}</dd>
      <dt>Mode</dt>
      <dd>{mode ?? "—"}</dd>
      <dt>Lat/Lon</dt>
      <dd>{formatLatLon(position.lat, position.lon)}</dd>
    </dl>
  );
}
