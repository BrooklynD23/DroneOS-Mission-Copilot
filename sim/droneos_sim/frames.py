"""GStreamer argv for capturing PX4 SITL camera video (UDP 5600 RTP H.264) to JPEGs."""

from pathlib import Path

RTP_CAPS = "application/x-rtp,media=video,encoding-name=H264,payload=96"


# ponytail: pipeline from RESEARCH-02, not verified by a run; test per HUMAN-05.
def gst_argv(out_dir: Path, fps: int = 2) -> list[str]:
    """Return the gst-launch-1.0 argv writing ``frame_%06d.jpg`` into ``out_dir``."""
    return [
        "gst-launch-1.0", "-q",
        "udpsrc", "port=5600", f"caps={RTP_CAPS}", "!",
        "rtph264depay", "!", "h264parse", "!", "avdec_h264", "!", "videoconvert", "!",
        "videorate", "!", f"video/x-raw,framerate={fps}/1", "!",
        "jpegenc", "quality=85", "!",
        "multifilesink", f"location={out_dir}/frame_%06d.jpg",
    ]  # fmt: skip
