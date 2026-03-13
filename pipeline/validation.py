"""
validation.py — Reusable pre-insert validation framework for Chief Scout pipeline.

Usage:
    from validation import validate_person, validate_profile, validate_personality, \
        validate_market, validate_status, validate_attribute_grade, validate_row, \
        ValidationError, ValidationResult

    result = validate_person({"name": "Erling Haaland", "dob": "2000-07-21", ...})
    if not result.ok:
        for err in result.errors:
            print(f"  {err.field}: {err.message}")

Can also validate a full row destined for any table:
    result = validate_row("people", row_dict)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any

# ── SACROSANCT enums ──────────────────────────────────────────────────────────

VALID_POSITIONS = {"GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"}

VALID_MODELS = {
    "Controller", "Commander", "Creator",
    "Target", "Sprinter", "Powerhouse",
    "Cover", "Engine", "Destroyer",
    "Dribbler", "Passer", "Striker",
    "GK",
}

VALID_PERSONALITY_CODES = {
    "ANLC", "ANSC", "INSC", "AXLC", "IXSC", "IXLC",
    "INSP", "ANLP", "IXSP", "INLC", "INLP", "AXSC",
    "ANSP", "AXSP", "IXLP", "AXLP",
}

VALID_PURSUIT_STATUS = {"Pass", "Watch", "Interested", "Scout Further", "Monitor", "Priority"}

VALID_PROFILE_TIERS = {1, 2, 3}

VALID_FEET = {"Left", "Right", "Both"}

VALID_FITNESS_TAGS = {"Fully Fit", "Minor Knock", "Injured", "Long-Term"}
VALID_MENTAL_TAGS = {"Sharp", "Confident", "Low", "Fragile"}
VALID_DISCIPLINARY_TAGS = {"Clear", "Cautioned", "Suspended", "Volatile"}
VALID_TACTICAL_TAGS = {"Adaptable", "Specialist", "Limited", "Versatile"}
VALID_CONTRACT_TAGS = {"Long-Term", "One Year Left", "Six Months", "Expired", "Extension Talks"}

VALID_MVT = {1, 2, 3, 4, 5}

# ── Result types ──────────────────────────────────────────────────────────────


@dataclass
class ValidationError:
    field: str
    message: str
    severity: str = "error"  # error | warning


@dataclass
class ValidationResult:
    table: str
    errors: list[ValidationError] = field(default_factory=list)
    warnings: list[ValidationError] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return len(self.errors) == 0

    def add_error(self, field: str, message: str):
        self.errors.append(ValidationError(field, message, "error"))

    def add_warning(self, field: str, message: str):
        self.warnings.append(ValidationError(field, message, "warning"))


# ── Helper validators ─────────────────────────────────────────────────────────

def _check_range(result: ValidationResult, data: dict, field: str,
                 lo: float, hi: float, *, allow_none: bool = True):
    val = data.get(field)
    if val is None:
        if not allow_none:
            result.add_error(field, f"Required field '{field}' is missing")
        return
    try:
        num = float(val)
    except (TypeError, ValueError):
        result.add_error(field, f"'{field}' must be numeric, got {type(val).__name__}")
        return
    if num < lo or num > hi:
        result.add_error(field, f"'{field}' = {num} out of range [{lo}, {hi}]")


def _check_enum(result: ValidationResult, data: dict, field: str,
                valid: set, *, allow_none: bool = True):
    val = data.get(field)
    if val is None:
        if not allow_none:
            result.add_error(field, f"Required field '{field}' is missing")
        return
    if val not in valid:
        result.add_error(field, f"'{field}' = '{val}' not in {sorted(valid)}")


def _check_required_str(result: ValidationResult, data: dict, field: str):
    val = data.get(field)
    if not val or (isinstance(val, str) and not val.strip()):
        result.add_error(field, f"Required field '{field}' is missing or empty")


def _check_date(result: ValidationResult, data: dict, field: str,
                *, allow_none: bool = True):
    val = data.get(field)
    if val is None:
        if not allow_none:
            result.add_error(field, f"Required field '{field}' is missing")
        return
    if isinstance(val, (date, datetime)):
        return
    if isinstance(val, str):
        try:
            datetime.strptime(val, "%Y-%m-%d")
        except ValueError:
            result.add_error(field, f"'{field}' = '{val}' is not a valid date (YYYY-MM-DD)")
    else:
        result.add_error(field, f"'{field}' must be a date, got {type(val).__name__}")


def _check_archetype(result: ValidationResult, data: dict, field: str = "archetype"):
    val = data.get(field)
    if val is None:
        return
    parts = val.split("-")
    if len(parts) > 2:
        result.add_error(field, f"Archetype '{val}' has {len(parts)} parts (max 2)")
        return
    for part in parts:
        if part not in VALID_MODELS:
            result.add_error(field, f"Archetype component '{part}' in '{val}' is not a valid model")


# ── Table validators ──────────────────────────────────────────────────────────

def validate_person(data: dict) -> ValidationResult:
    """Validate a row for the `people` table."""
    r = ValidationResult("people")
    _check_required_str(r, data, "name")

    # Name sanity
    name = data.get("name", "")
    if name:
        if len(name) < 2:
            r.add_error("name", f"Name '{name}' too short")
        if re.search(r'[{}\[\]<>]', name):
            r.add_error("name", f"Name '{name}' contains invalid characters")
        if name.startswith("```") or "Tactical Attributes" in name:
            r.add_error("name", f"Name '{name}' looks like garbage data")

    _check_date(r, data, "date_of_birth")

    # DOB sanity (must be between 1960 and 2012 for active players)
    dob = data.get("date_of_birth")
    if dob:
        try:
            if isinstance(dob, str):
                dob_date = datetime.strptime(dob, "%Y-%m-%d").date()
            else:
                dob_date = dob
            if dob_date.year < 1960:
                r.add_warning("date_of_birth", f"DOB {dob} is before 1960 — likely retired")
            if dob_date.year > 2012:
                r.add_error("date_of_birth", f"DOB {dob} is after 2012 — too young")
        except (ValueError, AttributeError):
            pass

    _check_range(r, data, "height_cm", 150, 215)
    _check_enum(r, data, "preferred_foot", VALID_FEET)

    return r


def validate_profile(data: dict) -> ValidationResult:
    """Validate a row for the `player_profiles` table."""
    r = ValidationResult("player_profiles")
    _check_enum(r, data, "position", VALID_POSITIONS)
    _check_range(r, data, "level", 1, 99)
    _check_range(r, data, "peak", 1, 99)
    _check_range(r, data, "overall", 1, 99)
    _check_archetype(r, data)
    _check_enum(r, data, "profile_tier", VALID_PROFILE_TIERS)

    # GK archetype only for GK position
    archetype = data.get("archetype")
    position = data.get("position")
    if archetype == "GK" and position and position != "GK":
        r.add_error("archetype", f"GK archetype on non-GK position '{position}'")

    # Level vs peak sanity
    level = data.get("level")
    peak = data.get("peak")
    if level is not None and peak is not None:
        if level > peak + 5:
            r.add_warning("level", f"Level ({level}) exceeds peak ({peak}) by >5")

    return r


def validate_personality(data: dict) -> ValidationResult:
    """Validate a row for the `player_personality` table."""
    r = ValidationResult("player_personality")
    for dim in ("ei", "sn", "tf", "jp"):
        _check_range(r, data, dim, 0, 100)
    _check_range(r, data, "competitiveness", 0, 100)
    _check_range(r, data, "coachability", 0, 100)

    # Check computed personality code if all 4 dimensions present
    ei, sn, tf, jp = data.get("ei"), data.get("sn"), data.get("tf"), data.get("jp")
    if all(v is not None for v in (ei, sn, tf, jp)):
        code = (
            ("A" if ei >= 50 else "I") +
            ("X" if sn >= 50 else "N") +
            ("L" if tf >= 50 else "S") +
            ("C" if jp >= 50 else "P")
        )
        if code not in VALID_PERSONALITY_CODES:
            r.add_warning("personality_type", f"Computed code '{code}' is not in valid set")

    return r


def validate_market(data: dict) -> ValidationResult:
    """Validate a row for the `player_market` table."""
    r = ValidationResult("player_market")
    _check_enum(r, data, "market_value_tier", VALID_MVT)

    mv = data.get("market_value_eur")
    hmv = data.get("highest_market_value_eur")
    if mv is not None and mv < 0:
        r.add_error("market_value_eur", f"Negative market value: {mv}")
    if hmv is not None and hmv < 0:
        r.add_error("highest_market_value_eur", f"Negative highest market value: {hmv}")
    if mv is not None and hmv is not None and hmv < mv:
        r.add_error("highest_market_value_eur",
                     f"Highest ({hmv}) < current ({mv})")

    _check_range(r, data, "true_mvt", 1, 5)
    _check_range(r, data, "scarcity_score", 0, 100)

    return r


def validate_status(data: dict) -> ValidationResult:
    """Validate a row for the `player_status` table."""
    r = ValidationResult("player_status")
    _check_enum(r, data, "pursuit_status", VALID_PURSUIT_STATUS)
    _check_enum(r, data, "fitness_tag", VALID_FITNESS_TAGS)
    _check_enum(r, data, "mental_tag", VALID_MENTAL_TAGS)
    _check_enum(r, data, "disciplinary_tag", VALID_DISCIPLINARY_TAGS)
    _check_enum(r, data, "tactical_tag", VALID_TACTICAL_TAGS)
    _check_enum(r, data, "contract_tag", VALID_CONTRACT_TAGS)

    # Scouting notes garbage check
    notes = data.get("scouting_notes")
    if notes:
        if notes.startswith("```"):
            r.add_error("scouting_notes", "Scouting notes contain markdown code block artifacts")
        if "Tactical Attributes" in notes:
            r.add_error("scouting_notes", "Scouting notes contain attribute dump")
        if re.match(r'^---', notes):
            r.add_error("scouting_notes", "Scouting notes contain markdown separator artifacts")
        if len(notes) < 10:
            r.add_warning("scouting_notes", f"Very short scouting notes ({len(notes)} chars)")

    return r


def validate_attribute_grade(data: dict) -> ValidationResult:
    """Validate a row for the `attribute_grades` table."""
    r = ValidationResult("attribute_grades")

    sg = data.get("scout_grade")
    ss = data.get("stat_score")

    if sg is not None:
        if sg < 0:
            r.add_error("scout_grade", f"Negative scout grade: {sg}")
        if sg > 20:
            r.add_error("scout_grade", f"Scout grade {sg} exceeds 20")
    if ss is not None:
        if ss < 0:
            r.add_error("stat_score", f"Negative stat score: {ss}")
        if ss > 20:
            r.add_error("stat_score", f"Stat score {ss} exceeds 20")

    attr = data.get("attribute")
    if attr and not re.match(r'^[a-z_]+$', attr):
        r.add_warning("attribute", f"Attribute name '{attr}' should be lowercase snake_case")

    return r


# ── Dispatch ──────────────────────────────────────────────────────────────────

_VALIDATORS = {
    "people": validate_person,
    "player_profiles": validate_profile,
    "player_personality": validate_personality,
    "player_market": validate_market,
    "player_status": validate_status,
    "attribute_grades": validate_attribute_grade,
}


def validate_row(table: str, data: dict) -> ValidationResult:
    """Validate a row for the given table. Returns ValidationResult."""
    validator = _VALIDATORS.get(table)
    if not validator:
        r = ValidationResult(table)
        r.add_warning("_table", f"No validator defined for table '{table}'")
        return r
    return validator(data)


def validate_batch(table: str, rows: list[dict]) -> list[ValidationResult]:
    """Validate multiple rows. Returns list of results (only failures)."""
    failures = []
    for row in rows:
        result = validate_row(table, row)
        if not result.ok or result.warnings:
            failures.append(result)
    return failures
