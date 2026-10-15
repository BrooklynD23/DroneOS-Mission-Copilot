"""Load the exported JSON Schemas and validate objects against them.

The files in ``<repo>/schemas/`` are exported from the zod contracts
(``pnpm schema:export``); this module is the only Python reader so the sim
side validates against the single source of truth, not a duplicate model.
"""

import json
import re
from functools import cache
from pathlib import Path
from typing import Any

import jsonschema

SCHEMA_DIR = Path(__file__).resolve().parents[2] / "schemas"
_NAME_RE = re.compile(r"[a-z0-9-]+")


@cache
def load_schema(name: str) -> dict[str, Any]:
    """Return the parsed ``<name>.schema.json`` from the repo's ``schemas/`` dir."""
    if not _NAME_RE.fullmatch(name):
        raise ValueError(f"unknown schema name: {name!r}")
    path = SCHEMA_DIR / f"{name}.schema.json"
    if not path.is_file():
        raise ValueError(f"unknown schema name: {name!r}")
    return json.loads(path.read_text(encoding="utf-8"))


def _error_path(error: jsonschema.ValidationError) -> str:
    """Render an error location like ``$.waypoints[2].alt_m``."""
    path = "$"
    for part in error.absolute_path:
        path += f"[{part}]" if isinstance(part, int) else f".{part}"
    return path


def validate(name: str, obj: Any) -> None:
    """Validate ``obj`` against schema ``name``.

    Raises ValueError listing every error path on failure; returns None on success.
    """
    validator = jsonschema.Draft202012Validator(
        load_schema(name),
        format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER,
    )
    errors = sorted(validator.iter_errors(obj), key=_error_path)
    if errors:
        details = "\n".join(f"{_error_path(e)}: {e.message}" for e in errors)
        raise ValueError(f"{name} schema validation failed ({len(errors)} error(s)):\n{details}")
