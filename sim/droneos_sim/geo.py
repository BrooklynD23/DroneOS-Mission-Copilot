"""Local tangent-plane geometry helpers for the oracle.

Contract lat/lon values are converted to (east_m, north_m) offsets around the
site home point so shapely can do distance and containment maths in metres.
"""

import math
from collections.abc import Iterable

from shapely.geometry import Point, Polygon

M_PER_DEG_LAT = 111_320.0


# ponytail: flat-earth projection, fine for <2 km sites; use pyproj if sites grow.
def to_xy(lat: float, lon: float, home: dict[str, float]) -> tuple[float, float]:
    """Project ``(lat, lon)`` to ``(east_m, north_m)`` relative to ``home``."""
    east = (lon - home["lon"]) * M_PER_DEG_LAT * math.cos(math.radians(home["lat"]))
    north = (lat - home["lat"]) * M_PER_DEG_LAT
    return east, north


def point_xy(lat: float, lon: float, home: dict[str, float]) -> Point:
    """Project ``(lat, lon)`` to a shapely Point in local metre space."""
    return Point(*to_xy(lat, lon, home))


def ring_polygon(ring: Iterable[dict[str, float]], home: dict[str, float]) -> Polygon:
    """Build a shapely Polygon in local metre space from a contract Ring."""
    return Polygon([to_xy(p["lat"], p["lon"], home) for p in ring])
