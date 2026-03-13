"""
pipeline/lib/validate.py — Validation helpers for pipeline upsert calls.

Usage:
    from lib.validate import validate_row, validate_batch

    is_valid, errors = validate_row("people", {"name": "Kai Havertz", "height_cm": 189})
    valid_rows, report = validate_batch("attribute_grades", rows)
"""
from __future__ import annotations

from typing import Any

# ---------------------------------------------------------------------------
# Schema definitions
# ---------------------------------------------------------------------------
# Each field entry is a dict with:
#   required  (bool)          — row is invalid if field is missing/None
#   type      (type | tuple)  — Python type(s) accepted; None skips type check
#   choices   (list | None)   — allowed values (case-sensitive); None = any
#   min / max (int | None)    — inclusive numeric bounds; None = no bound
# ---------------------------------------------------------------------------

SCHEMAS: dict[str, dict[str, dict]] = {
    "people": {
        "name":           {"required": True,  "type": str,   "choices": None, "min": None, "max": None},
        "dob":            {"required": False, "type": str,   "choices": None, "min": None, "max": None},
        "height_cm":      {"required": False, "type": int,   "choices": None, "min": 140,  "max": 220},
        "preferred_foot": {"required": False, "type": str,   "choices": ["Left", "Right", "Both"], "min": None, "max": None},
        "nation_id":      {"required": False, "type": int,   "choices": None, "min": 1,    "max": None},
        "club_id":        {"required": False, "type": int,   "choices": None, "min": 1,    "max": None},
    },
    "player_profiles": {
        "person_id":  {"required": True,  "type": str,  "choices": None, "min": None, "max": None},
        "position":   {"required": False, "type": str,  "choices": ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"], "min": None, "max": None},
        "level":      {"required": False, "type": int,  "choices": None, "min": 1,    "max": 99},
        "archetype":  {"required": False, "type": str,  "choices": None, "min": None, "max": None},
        "blueprint":  {"required": False, "type": str,  "choices": None, "min": None, "max": None},
    },
    "player_status": {
        "person_id":      {"required": True,  "type": str, "choices": None, "min": None, "max": None},
        "pursuit_status": {
            "required": False,
            "type": str,
            "choices": ["Pass", "Watch", "Interested", "Scout Further", "Monitor", "Priority"],
            "min": None,
            "max": None,
        },
    },
    "player_market": {
        "person_id":         {"required": True,  "type": str, "choices": None, "min": None,  "max": None},
        "market_value_tier": {"required": False, "type": int, "choices": None, "min": 1,     "max": 5},
        "true_mvt":          {"required": False, "type": int, "choices": None, "min": 1,     "max": 5},
        "scarcity_score":    {"required": False, "type": int, "choices": None, "min": 0,     "max": 100},
    },
    "attribute_grades": {
        "player_id":   {"required": True,  "type": str, "choices": None, "min": None, "max": None},
        "attribute":   {"required": True,  "type": str, "choices": None, "min": None, "max": None},
        "scout_grade": {"required": False, "type": int, "choices": None, "min": 0,    "max": 20},
    },
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _check_field(field: str, value: Any, spec: dict) -> list[str]:
    """Return a list of error strings for a single field value."""
    errors: list[str] = []

    if value is None or value == "":
        if spec["required"]:
            errors.append(f"'{field}' is required but missing or None")
        # Optional field is absent — no further checks needed
        return errors

    expected_type = spec.get("type")
    if expected_type is not None and not isinstance(value, expected_type):
        errors.append(
            f"'{field}' must be {expected_type.__name__}, got {type(value).__name__} ({value!r})"
        )
        # Type mismatch — skip bounds/choices checks to avoid confusing follow-on errors
        return errors

    choices = spec.get("choices")
    if choices is not None and value not in choices:
        errors.append(f"'{field}' value {value!r} not in allowed choices: {choices}")

    lo = spec.get("min")
    if lo is not None and value < lo:
        errors.append(f"'{field}' value {value!r} is below minimum {lo}")

    hi = spec.get("max")
    if hi is not None and value > hi:
        errors.append(f"'{field}' value {value!r} exceeds maximum {hi}")

    return errors


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def validate_row(table_name: str, row: dict) -> tuple[bool, list[str]]:
    """
    Validate a single row dict against the schema for *table_name*.

    Returns:
        (is_valid, errors)  — is_valid is True when errors is empty.

    Raises:
        KeyError if *table_name* is not defined in SCHEMAS.
    """
    if table_name not in SCHEMAS:
        raise KeyError(
            f"No schema defined for table '{table_name}'. "
            f"Known tables: {list(SCHEMAS.keys())}"
        )

    schema = SCHEMAS[table_name]
    errors: list[str] = []

    for field, spec in schema.items():
        value = row.get(field)
        errors.extend(_check_field(field, value, spec))

    return (len(errors) == 0, errors)


def validate_batch(
    table_name: str, rows: list[dict]
) -> tuple[list[dict], dict]:
    """
    Validate a list of row dicts against the schema for *table_name*.

    Returns:
        (valid_rows, error_report)

        valid_rows   — list of rows that passed all checks
        error_report — dict with keys:
            "total"        int   — total rows supplied
            "valid"        int   — rows that passed
            "invalid"      int   — rows that failed
            "failures"     list  — [{"index": i, "row": row, "errors": [...]}]

    Raises:
        KeyError if *table_name* is not defined in SCHEMAS.
    """
    valid_rows: list[dict] = []
    failures: list[dict] = []

    for i, row in enumerate(rows):
        is_valid, errors = validate_row(table_name, row)
        if is_valid:
            valid_rows.append(row)
        else:
            failures.append({"index": i, "row": row, "errors": errors})

    report = {
        "total":    len(rows),
        "valid":    len(valid_rows),
        "invalid":  len(failures),
        "failures": failures,
    }
    return valid_rows, report


def print_report(table_name: str, report: dict, *, show_rows: bool = False) -> None:
    """
    Pretty-print the error_report produced by validate_batch.

    Args:
        table_name  — used in the header line only
        report      — the dict returned as the second element of validate_batch()
        show_rows   — if True, also print the offending row dict
    """
    print(
        f"[validate] {table_name}: "
        f"{report['valid']}/{report['total']} valid, "
        f"{report['invalid']} invalid"
    )
    for failure in report["failures"]:
        print(f"  row[{failure['index']}]:")
        if show_rows:
            print(f"    data   : {failure['row']}")
        for err in failure["errors"]:
            print(f"    error  : {err}")
