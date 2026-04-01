"""
01_parse_rsg.py — Parse rsg.db Obsidian vault + Real Players Active.csv
and upsert to Supabase using the canonical schema.

Usage:
    python pipeline/01_parse_rsg.py [--dry-run]
"""

from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
import yaml
from pathlib import Path

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, VAULT_DIR, IMPORTS_DIR

DRY_RUN = "--dry-run" in sys.argv

RSG_MEN = VAULT_DIR / "men"
RSG_WOMEN = VAULT_DIR / "women"
CSV_REAL = IMPORTS_DIR / "Real Players Active.csv"
CLUBS_CSV = IMPORTS_DIR / "clubs.csv"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_slug(name: str) -> str:
    """Slugify a player name: lowercase, strip accents, hyphens for separators."""
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s


def _dedupe_slugs(players: list[dict]) -> None:
    """Append -2, -3 etc. for duplicate slugs. Mutates in place."""
    seen: dict[str, int] = {}
    for p in players:
        slug = p["slug"]
        if slug in seen:
            seen[slug] += 1
            p["slug"] = f"{slug}-{seen[slug]}"
        else:
            seen[slug] = 1


def _parse_base_value(val) -> int | None:
    """Parse '£140000000.0' → 14000000000 (pence). Empty/invalid → None."""
    if not val:
        return None
    s = str(val).replace("£", "").replace("€", "").replace(",", "").strip()
    if not s:
        return None
    try:
        return int(float(s) * 100)
    except (ValueError, TypeError):
        return None


def _parse_dob(val: str | None) -> str | None:
    """Return ISO date string from various formats."""
    if not val:
        return None
    val = str(val).strip()
    # DD/MM/YYYY
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", val)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    # D Month YYYY
    m = re.match(r"(\d{1,2})\s+(\w+)\s+(\d{4})", val)
    if m:
        months = {"January":"01","February":"02","March":"03","April":"04",
                  "May":"05","June":"06","July":"07","August":"08",
                  "September":"09","October":"10","November":"11","December":"12"}
        mon = months.get(m.group(2))
        if mon:
            return f"{m.group(3)}-{mon}-{int(m.group(1)):02d}"
    return None


def _parse_joined(val) -> int | None:
    """Parse joined year from various formats (int, 'YYYY', 'DD/MM/YYYY')."""
    if not val:
        return None
    s = str(val).strip()
    # If it's a date like DD/MM/YYYY, extract the year
    m = re.match(r"\d{1,2}/\d{1,2}/(\d{4})", s)
    if m:
        return int(m.group(1))
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def _parse_fee(val) -> int | None:
    if not val:
        return None
    try:
        return int(str(val).replace(",", "").replace("£", "").replace("€", "").strip())
    except ValueError:
        return None


def _attr_val(row: dict, col: str) -> str | None:
    """Get attribute value from CSV row. 'Average' → None."""
    val = (row.get(col) or "").strip()
    if not val or val == "Average":
        return None
    return val


# ── Attribute domain mappings ─────────────────────────────────────────────────

# CSV column → JSONB key, grouped by domain
MENTAL_COLS = {
    "Decisions": "decisions", "Composure": "composure",
    "Leadership": "leadership", "Communication": "communication",
    "Drive": "drive", "Discipline": "discipline",
    "Guile": "threat", "Vision": "vision",
    "Flair": "flair", "Anticipation": "anticipation",
    "Bravery": "bravery", "Concentraion": "concentration",
    "Awareness": "awareness", "Reactions": "reactions",
}

PHYSICAL_COLS = {
    "Stamina": "stamina", "Recovery": "recovery",
    "Pace": "pace", "Acceleration": "acceleration",
    "Agility": "agility", "Physicality": "physicality",
    "Jumping": "jumping", "Coordination": "coordination",
    "Balance": "balance",
}

TACTICAL_COLS = {
    "Tempo": "tempo", "Movement": "movement",
    "Pressing": "pressing", "Intensity": "intensity",
    "Marking": "marking", "Blocking": "blocking",
    "Positioning": "positioning", "Hold Up": "hold_up",
    "Duels": "duels", "Aggression": "aggression",
}

TECHNICAL_COLS = {
    "First Touch": "first_touch", "Set Piece": "set_piece",
    "Carries": "carries", "Penalty": "penalty",
    "Long": "long_pass", "Close": "close_control",
    "Through": "through_ball", "Range": "range",
    "Accuracy": "accuracy", "Cross": "crossing",
    "Takeons": "take_ons", "Skills": "skills",
    "Tackling": "tackling", "Aerial Duels": "aerial_duels",
    "Heading": "heading",
}


def _build_domain(row: dict, mapping: dict[str, str]) -> dict | None:
    """Build a JSONB domain dict from a CSV row. Returns None if all values are null."""
    domain = {}
    for csv_col, json_key in mapping.items():
        val = _attr_val(row, csv_col)
        if val is not None:
            domain[json_key] = val
    return domain if domain else None


# ── Parse rsg.db player markdown files ───────────────────────────────────────

def parse_rsg_player(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8", errors="replace")
    front, body = {}, text

    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            try:
                front = yaml.safe_load(parts[1]) or {}
            except yaml.YAMLError:
                front = {}
            body = parts[2].strip()

    # Name from filename (strip .md)
    name = path.stem

    # If body has "CountryXXX ClubYYY PositionZZZ" pattern (unstructured files)
    if not front:
        country_m = re.search(r"Country\s*([A-Za-z ]+?)(?:\n|Club|$)", body)
        club_m = re.search(r"Club\s*([A-Za-z0-9 ]+?)(?:\n|Position|$)", body)
        pos_m = re.search(r"Position\s*([A-Za-z ]+?)(?:\n|Born|$)", body)
        born_m = re.search(r"Born\s*([0-9A-Za-z ]+?)(?:\n|$)", body)
        if country_m:
            front["nation"] = country_m.group(1).strip()
        if club_m:
            front["club"] = club_m.group(1).strip()
        if pos_m:
            front["position"] = pos_m.group(1).strip()
        if born_m:
            front["dob"] = born_m.group(1).strip()

    return {
        "name": name,
        "slug": _make_slug(name),
        "nationality": str(front.get("nation", "") or "").upper() or None,
        "club": str(front.get("club", "") or "") or None,
        "position": str(front.get("position", "") or "") or None,
        "primary_class": str(front.get("class", "") or "") or None,
        "foot": str(front.get("foot", "") or "") or None,
        "dob": _parse_dob(front.get("dob")),
        "hg": bool(front.get("hg")),
        "joined": _parse_joined(front.get("joined")),
        "prev_club": str(front.get("prevclub", "") or "") or None,
        "transfer_fee": _parse_fee(front.get("fee")),
        "scouting_notes": body[:4000] if body else None,
        "source": "rsg_db",
    }


# ── Parse Real Players Active.csv ─────────────────────────────────────────────

def parse_real_players_csv() -> list[dict]:
    if not CSV_REAL.exists():
        return []

    players = []
    with CSV_REAL.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = (row.get("Name") or "").strip()
            if not name:
                continue

            # Build attribute domains
            mental = _build_domain(row, MENTAL_COLS)
            physical = _build_domain(row, PHYSICAL_COLS)
            tactical = _build_domain(row, TACTICAL_COLS)
            technical = _build_domain(row, TECHNICAL_COLS)

            try:
                level = int(float(row.get("Level") or 0)) or None
            except (ValueError, TypeError):
                level = None

            try:
                peak = int(float(row.get("Peak") or 0)) or None
            except (ValueError, TypeError):
                peak = None

            players.append({
                "name": name,
                "slug": _make_slug(name),
                "club": (row.get("Club") or "").strip() or None,
                "league": (row.get("Division") or "").strip() or None,
                "mentality": (row.get("Mentality") or "").strip() or None,
                "position": (row.get("Position") or "").strip() or None,
                "foot": (row.get("Foot") or "").strip() or None,
                "nationality": (row.get("Nation") or "").strip() or None,
                "primary_class": (row.get("Primary Class") or "").strip() or None,
                "secondary_class": (row.get("Secondary Class") or "").strip() or None,
                "model": (row.get("Model") or "").strip() or None,
                "physique": (row.get("Physique") or "").strip() or None,
                "character": (row.get("Character") or "").strip() or None,
                "base_value": _parse_base_value(row.get("Base Value")),
                "level": level,
                "peak": peak,
                "is_active": (row.get("Active") or "").strip() == "checked",
                "attributes": {
                    "mental": mental,
                    "physical": physical,
                    "tactical": tactical,
                    "technical": technical,
                },
                "source": "real_players_active",
            })
    return players


# ── Merge by slug ─────────────────────────────────────────────────────────────

def merge_players(rsg: list[dict], csv_players: list[dict]) -> list[dict]:
    """Merge CSV data into RSG records by slug, CSV wins for game fields."""
    merged = {}

    for p in rsg:
        merged[p["slug"]] = p.copy()

    for p in csv_players:
        key = p["slug"]
        if key in merged:
            existing = merged[key]
            for field in ["club", "league", "mentality", "position", "nationality",
                          "primary_class", "secondary_class", "model", "physique",
                          "character", "base_value", "level", "peak", "attributes",
                          "is_active", "foot"]:
                if p.get(field) and not existing.get(field):
                    existing[field] = p[field]
            existing["source"] = "merged"
        else:
            merged[key] = p

    result = list(merged.values())
    _dedupe_slugs(result)
    return result


# ── Upsert to Supabase ────────────────────────────────────────────────────────

BATCH_SIZE = 200


def upsert_players(players: list[dict]) -> None:
    from supabase import create_client, Client

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
        sys.exit(1)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    rows = []
    for p in players:
        row = {k: v for k, v in p.items() if v is not None and v != ""}
        if "attributes" in row and isinstance(row["attributes"], dict):
            row["attributes"] = json.dumps(row["attributes"])
        rows.append(row)

    print(f"Upserting {len(rows)} players to Supabase...")
    errors = []
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        result = supabase.table("players").upsert(
            batch, on_conflict="slug"
        ).execute()
        if hasattr(result, "error") and result.error:
            errors.append(result.error)
            print(f"  batch {i//BATCH_SIZE + 1}: ERROR {result.error}")
        else:
            print(f"  batch {i//BATCH_SIZE + 1}: {len(batch)} rows OK")

    if errors:
        print(f"\n{len(errors)} batch errors.")
    else:
        print("\nDone.")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("Parsing rsg.db player files...")
    rsg_players = []
    if RSG_MEN.exists():
        for path in sorted(RSG_MEN.glob("*.md")):
            p = parse_rsg_player(path)
            if p:
                rsg_players.append(p)
        print(f"  {len(rsg_players)} men's player files parsed")

    print("Parsing Real Players Active.csv...")
    csv_players = parse_real_players_csv()
    print(f"  {len(csv_players)} rows parsed")

    print("Merging...")
    all_players = merge_players(rsg_players, csv_players)
    print(f"  {len(all_players)} unique players total")

    # Summary stats
    successful = len(all_players)
    failed = 0
    with_level = sum(1 for p in all_players if p.get("level"))
    with_notes = sum(1 for p in all_players if p.get("scouting_notes"))
    with_dob = sum(1 for p in all_players if p.get("dob"))
    with_base_value = sum(1 for p in all_players if p.get("base_value"))

    # Count null attributes across domains
    null_mental = sum(1 for p in all_players
                      if not (p.get("attributes") or {}).get("mental"))
    null_physical = sum(1 for p in all_players
                        if not (p.get("attributes") or {}).get("physical"))
    null_tactical = sum(1 for p in all_players
                        if not (p.get("attributes") or {}).get("tactical"))
    null_technical = sum(1 for p in all_players
                         if not (p.get("attributes") or {}).get("technical"))

    print(f"\n── Summary ──")
    print(f"  Total rows:      {successful + failed}")
    print(f"  Successful:      {successful}")
    print(f"  Failed:          {failed}")
    print(f"  With level:      {with_level}")
    print(f"  With DOB:        {with_dob}")
    print(f"  With notes:      {with_notes}")
    print(f"  With base_value: {with_base_value}")
    print(f"  Null mental:     {null_mental}")
    print(f"  Null physical:   {null_physical}")
    print(f"  Null tactical:   {null_tactical}")
    print(f"  Null technical:  {null_technical}")

    if DRY_RUN:
        print(f"\n--dry-run: writing to players_export.json instead of Supabase")
        out = Path("players_export.json")
        out.write_text(json.dumps(all_players, indent=2, ensure_ascii=False))
        print(f"Wrote {successful} players → {out}")
        return

    upsert_players(all_players)


if __name__ == "__main__":
    main()
