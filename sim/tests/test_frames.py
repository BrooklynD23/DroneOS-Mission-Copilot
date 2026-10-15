from droneos_sim.frames import gst_argv


def test_gst_argv_port_and_elements(tmp_path):
    argv = gst_argv(tmp_path)
    assert argv[0] == "gst-launch-1.0"
    assert any(a == "port=5600" for a in argv)
    assert "video/x-raw,framerate=2/1" in argv
    assert "quality=85" in argv
    assert f"location={tmp_path}/frame_%06d.jpg" in argv


def test_gst_argv_fps(tmp_path):
    assert "video/x-raw,framerate=5/1" in gst_argv(tmp_path, fps=5)
