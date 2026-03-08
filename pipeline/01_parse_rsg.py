"""
01_parse_rsg.py — Parse rsg.db Obsidian vault + Real Players Active.csv
and upsert to Supabase.

Usage:
    python pipeline/01_parse_rsg.py [--dry-run]
"""

from __future__ import annotations

import csv
import json
import re
import sys
import yaml
from pathlib import Path

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, VAULT_DIR, IMPORTS_DIR

DRY_RUN = "--dry-run" in sys.argv

RSG_MEN = VAULT_DIR / "men"
RSG_WOMEN = VAULT_DIR / "women"
CSV_REAL = IMPORTS_DIR / "Real Players Active.csv"
CLUBS_CSV = IMPORTS_DIR / "clubs.csv"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_fee(val) -> int | None:
    if not val:
        return None
    try:
        return int(str(val).replace(",", "").replace("£", "").replace("€", "").strip())
    except ValueError:
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


def _slug(name: str) -> str:
    return name.lower().strip()


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
        "nation": str(front.get("nation", "") or "").upper() or None,
        "club": str(front.get("club", "") or "") or None,
        "position": str(front.get("position", "") or "") or None,
        "class": str(front.get("class", "") or "") or None,
        "foot": str(front.get("foot", "") or "") or None,
        "dob": _parse_dob(front.get("dob")),
        "age": int(front["age"]) if front.get("age") else None,
        "height": str(front.get("height", "") or "") or None,
        "hg": bool(front.get("hg")),
        "joined": int(front["joined"]) if front.get("joined") else None,
        "prev_club": str(front.get("prevclub", "") or "") or None,
        "transfer_fee": _parse_fee(front.get("fee")),
        "scouting_notes": body[:4000] if body else None,  # cap at 4k chars
        "source": "rsg_db",
    }


# ── Parse Real Players Active.csv ─────────────────────────────────────────────

ATTR_COLS = [
    "Decisions", "Composure", "Tempo", "First Touch", "Leadership",
    "Communication", "Drive", "Discipline", "Guile", "Vision", "Movement",
    "Flair", "Balance", "Set Piece", "Carries", "Penalty", "Long", "Close",
    "Through", "Range", "Accuracy", "Cross", "Takeons", "Skills",
    "Anticipation", "Stamina", "Recovery", "Pressing", "Intensity",
    "Tackling", "Marking", "Blocking", "Bravery", "Positioning",
    "Concentraion", "Awareness", "Aerial Duels", "Reactions", "Pace",
    "Acceleration", "Agility", "Physicality", "Hold Up", "Duels",
    "Aggression", "Coordination", "Jumping", "Heading",
]

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

            attrs = {}
            for col in ATTR_COLS:
                val = (row.get(col) or "").strip()
                if val and val != "Average":
                    attrs[col.lower().replace(" ", "_")] = val

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
                "club": (row.get("Club") or "").strip() or None,
                "division": (row.get("Division") or "").strip() or None,
                "mentality": (row.get("Mentality") or "").strip() or None,
                "position": (row.get("Position") or "").strip() or None,
                "foot": (row.get("Foot") or "").strip() or None,
                "nation": (row.get("Nation") or "").strip() or None,
                "class": (row.get("Primary Class") or "").strip() or None,
                "secondary_class": (row.get("Secondary Class") or "").strip() or None,
                "model": (row.get("Model") or "").strip() or None,
                "physique": (row.get("Physique") or "").strip() or None,
                "character": (row.get("Character") or "").strip() or None,
                "base_value": (row.get("Base Value") or "").strip() or None,
                "level": level,
                "peak": peak,
                "attributes": attrs if attrs else None,
                "active": (row.get("Active") or "").strip() == "checked",
                "source": "real_players_active",
            })
    return players


# ── Merge by name ─────────────────────────────────────────────────────────────

def merge_players(rsg: list[dict], csv_players: list[dict]) -> list[dict]:
    """Merge CSV data into RSG records by name, CSV wins for game fields."""
    csv_by_name = {_slug(p["name"]): p for p in csv_players}
    merged = {}

    for p in rsg:
        merged[_slug(p["name"])] = p.copy()

    for p in csv_players:
        key = _slug(p["name"])
        if key in merged:
            # Enrich existing RSG record with CSV game data
            existing = merged[key]
            for field in ["club", "division", "mentality", "position", "nation",
                          "class", "secondary_class", "model", "physique",
                          "character", "base_value", "level", "peak", "attributes",
                          "active", "foot"]:
                if p.get(field) and not existing.get(field):
                    existing[field] = p[field]
            existing["source"] = "merged"
        else:
            merged[key] = p

    return list(merged.values())


# ── Upsert to Supabase ────────────────────────────────────────────────────────

BATCH_SIZE = 200


def upsert_players(players: list[dict]) -> None:
    from supabase import create_client, Client

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
        sys.exit(1)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Prepare rows — strip None values for cleaner upsert
    rows = []
    for p in players:
        row = {k: v for k, v in p.items() if v is not None and v != ""}
        # Serialize attributes dict to JSON
        if "attributes" in row and isinstance(row["attributes"], dict):
            row["attributes"] = json.dumps(row["attributes"])
        rows.append(row)

    print(f"Upserting {len(rows)} players to Supabase...")
    errors = []
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        result = supabase.table("players").upsert(
            batch, on_conflict="name"
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

    # Breakdowns
    with_level = sum(1 for p in all_players if p.get("level"))
    with_notes = sum(1 for p in all_players if p.get("scouting_notes"))
    with_dob = sum(1 for p in all_players if p.get("dob"))
    print(f"  {with_level} with level rating, {with_notes} with scouting notes, {with_dob} with DOB")

    if DRY_RUN:
        print("\n--dry-run: writing to players_export.json instead of Supabase")
        out = Path("players_export.json")
        out.write_text(json.dumps(all_players, indent=2, ensure_ascii=False))
        print(f"Wrote {len(all_players)} players → {out}")
        return

    upsert_players(all_players)


if __name__ == "__main__":
    main()
