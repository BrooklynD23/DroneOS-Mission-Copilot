import type { Frame } from "../lib/schema/replay";
import { frameAlt } from "../lib/ui/telemetry-format";

export type FrameViewerProps = { frame: Frame | undefined };

export function FrameViewer({ frame }: FrameViewerProps) {
  if (frame === undefined) return <p>No frame yet at this time.</p>;
  return (
    <figure>
      {/* biome-ignore lint/performance/noImgElement: static replay frames, no optimizer needed */}
      <img src={frame.url} alt={frameAlt(frame)} width={320} height={240} />
      <figcaption>Frame {frame.id}</figcaption>
    </figure>
  );
}
