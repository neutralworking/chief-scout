"""Shared helpers for XP detectors."""

import json
from decimal import Decimal
from datetime import date

TODAY = date.today()

TOP5_LEAGUES = {
    "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1",
}


class _DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def dumps(obj):
    """JSON-serialize with Decimal support."""
    return json.dumps(obj, cls=_DecimalEncoder)


def age_at(dob, ref_date):
    """Age in years (float) at a reference date."""
    if not dob or not ref_date:
        return None
    return (ref_date - dob).days / 365.25


def club_root(name):
    """Extract club root for matching youth → senior."""
    if not name:
        return ""
    lower = name.lower().strip()
    for suffix in (" b", " ii", " u21", " u20", " u19", " u18", " u17", " u16", " reserves"):
        if lower.endswith(suffix):
            lower = lower[:-len(suffix)].strip()
    return lower


def infer_team_type(club_name):
    """Infer team type from club name."""
    if not club_name:
        return "senior_club"
    lower = club_name.lower()
    if "national" in lower:
        return "national_team"
    if lower.endswith((" u21", " u20", " u19", " u18", " u17", " u16", " b", " ii", " reserves")):
        return "youth"
    return "senior_club"


def milestone(key, label, xp, rarity, category, source, date=None, details=None, season=None):
    """Build a milestone dict."""
    m = {
        "milestone_key": f"{key}__{season}" if season else key,
        "milestone_label": label,
        "xp_value": xp,
        "rarity": rarity,
        "category": category,
        "source": source,
        "milestone_date": date,
        "details": dumps(details) if details else None,
    }
    if season:
        m["season"] = season
    return m
