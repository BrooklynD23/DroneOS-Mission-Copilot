"""Smoke test: package imports and version pin."""

import droneos_sim


def test_version() -> None:
    assert droneos_sim.__version__ == "0.1.0"


def test_deps_import() -> None:
    import jsonschema  # noqa: F401
    import mavsdk_grpc  # noqa: F401
    import shapely  # noqa: F401
