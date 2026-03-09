"""
02_insert_missing.py — Insert rsg.db players not yet in Supabase DB.

Finds players in the rsg.db Obsidian vault whose names don't match any
existing DB record, then inserts them as new rows.

Also patches the 12 CSV players that were missed due to name spelling diffs.

Usage:
    python pipeline/02_insert_missing.py [--dry-run]
"""
from __future__ import annotations

import re
import sys
import unicodedata
import yaml
from pathlib import Path

from config import POSTGRES_DSN, VAULT_DIR

DRY_RUN = "--dry-run" in sys.argv

RSG_MEN = VAULT_DIR / "men"

POSITION_MAP = {
    "Wide Forward": "WF",
    "Keeper": "GK",
    "Central Forward": "CF",
    "Wide Defender": "WD",
    "Central Defender": "CD",
    "Defensive Midfielder": "DM",
    "Central Midfielder": "CM",
    "Attacking Midfielder": "AM",
    "Wide Midfielder": "WM",
    "GK": "GK", "AM": "AM", "CD": "CD", "CF": "CF",
    "CM": "CM", "DM": "DM", "WD": "WD", "WF": "WF", "WM": "WM",
}

# Known manual name fixes for CSV players missed by exact match
CSV_NAME_FIXES = {
    "Ismael Bennacer": "Ismaël Bennacer",
    "Marc-Andre ter Stegen": "Marc-André ter Stegen",
    "Rene Adler": "René Adler",
    "Roque Mesa": "Roque Mesa",
    "Bernardo": "Bernardo Silva",
    "Nani": "Luís Nani",
    "Lucas": "Lucas Moura",
    "Fred": "Fred",
}


def normalise(name: str) -> str:
    """Lowercase + strip accents for fuzzy matching."""
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


def _parse_fee(val) -> int | None:
    if not val:
        return None
    try:
        return int(str(val).replace(",", "").replace("£", "").replace("€", "").strip())
    except ValueError:
        return None


def _parse_dob(val) -> str | None:
    if not val:
        return None
    val = str(val).strip()
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", val)
    if m:
        return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    m = re.match(r"(\d{1,2})\s+(\w+)\s+(\d{4})", val)
    if m:
        months = {
            "January": "01", "February": "02", "March": "03", "April": "04",
            "May": "05", "June": "06", "July": "07", "August": "08",
            "September": "09", "October": "10", "November": "11", "December": "12",
        }
        mon = months.get(m.group(2))
        if mon:
            return f"{m.group(3)}-{mon}-{int(m.group(1)):02d}"
    return None


def safe_int(val) -> int | None:
    if not val:
        return None
    try:
        return int(str(val).strip())
    except (ValueError, TypeError):
        return None


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

    name = path.stem

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

    raw_pos = str(front.get("position", "") or "").strip()
    position = POSITION_MAP.get(raw_pos) or (raw_pos if raw_pos in POSITION_MAP.values() else None)

    return {
        "name": name,
        "nation": str(front.get("nation", "") or "").upper() or None,
        "club": str(front.get("club", "") or "") or None,
        "position": position,
        "foot": str(front.get("foot", "") or "") or None,
        "dob": _parse_dob(front.get("dob")),
        "hg": bool(front.get("hg")),
        "joined_year": safe_int(front.get("joined")),
        "prev_club": str(front.get("prevclub", "") or "") or None,
        "transfer_fee_eur": _parse_fee(front.get("fee")),
        "scouting_notes": body[:4000] if body and body.strip() else None,
    }


def main():
    import psycopg2
    import psycopg2.extras

    print("Connecting to Supabase via psycopg2...")
    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Load existing player names
    print("Loading existing player names from DB...")
    cur.execute("SELECT id, name FROM players")
    rows = cur.fetchall()
    name_to_id: dict[str, int] = {r["name"]: r["id"] for r in rows}
    normalised_to_id: dict[str, int] = {normalise(r["name"]): r["id"] for r in rows}
    print(f"  {len(name_to_id):,} players in DB")

    # Parse all rsg.db men's files
    print(f"\nParsing rsg.db men's files from {RSG_MEN}...")
    if not RSG_MEN.exists():
        print(f"ERROR: {RSG_MEN} not found")
        return

    all_rsg = []
    for path in sorted(RSG_MEN.glob("*.md")):
        p = parse_rsg_player(path)
        if p:
            all_rsg.append(p)
    print(f"  {len(all_rsg)} files parsed")

    # Categorise: matched (update scouting notes) vs unmatched (insert new)
    matched_with_notes = []
    to_insert = []

    for p in all_rsg:
        name = p["name"]
        norm = normalise(name)

        db_id = name_to_id.get(name) or normalised_to_id.get(norm)
        if db_id:
            if p.get("scouting_notes"):
                matched_with_notes.append((db_id, p))
        else:
            to_insert.append(p)

    print(f"  {len(matched_with_notes)} matched players with scouting notes to update")
    print(f"  {len(to_insert)} unmatched players to insert as new records")

    if DRY_RUN:
        print("\n--dry-run: no DB writes")
        print("\nSample of players to insert:")
        for p in to_insert[:20]:
            print(f"  {p['name']} | {p.get('nation')} | {p.get('club')} | {p.get('position')}")
        return

    # ── Update scouting notes for matched players ─────────────────────────────
    if matched_with_notes:
        print(f"\nUpdating scouting notes for {len(matched_with_notes)} matched players...")
        update_status_sql = """
            UPDATE player_status SET
                scouting_notes = COALESCE(NULLIF(scouting_notes, ''), %(scouting_notes)s)
            WHERE person_id = %(id)s
        """
        update_market_sql = """
            UPDATE player_market SET
                hg = COALESCE(hg, %(hg)s),
                prev_club = COALESCE(NULLIF(prev_club, ''), %(prev_club)s),
                joined_year = COALESCE(joined_year, %(joined_year)s),
                transfer_fee_eur = COALESCE(transfer_fee_eur, %(transfer_fee_eur)s)
            WHERE person_id = %(id)s
        """
        ok = 0
        for db_id, p in matched_with_notes:
            try:
                cur.execute(update_status_sql, {
                    "id": db_id,
                    "scouting_notes": p["scouting_notes"],
                })
                cur.execute(update_market_sql, {
                    "id": db_id,
                    "hg": p.get("hg", False),
                    "prev_club": p.get("prev_club"),
                    "joined_year": p.get("joined_year"),
                    "transfer_fee_eur": p.get("transfer_fee_eur"),
                })
                ok += 1
            except Exception as e:
                print(f"  ERR update {p['name']}: {e}")
        print(f"  {ok} scouting notes updated")

    # ── Insert new (unmatched) players ────────────────────────────────────────
    if to_insert:
        print(f"\nInserting {len(to_insert)} new player records...")

        insert_person_sql = """
            INSERT INTO people (name, preferred_foot, date_of_birth, active)
            SELECT %(name)s, %(preferred_foot)s, %(date_of_birth)s, true
            WHERE NOT EXISTS (SELECT 1 FROM people WHERE name = %(name)s)
            RETURNING id
        """
        insert_profile_sql = """
            INSERT INTO player_profiles (person_id, position)
            VALUES (%(id)s, %(position)s)
        """
        insert_status_sql = """
            INSERT INTO player_status (person_id, scouting_notes)
            VALUES (%(id)s, %(scouting_notes)s)
        """
        insert_market_sql = """
            INSERT INTO player_market (person_id, hg, joined_year, prev_club, transfer_fee_eur)
            VALUES (%(id)s, %(hg)s, %(joined_year)s, %(prev_club)s, %(transfer_fee_eur)s)
        """

        ok = errors = skipped = 0
        for p in to_insert:
            row = {
                "name": p["name"],
                "preferred_foot": p.get("foot"),
                "date_of_birth": p.get("dob"),
                "position": p.get("position"),
                "hg": p.get("hg", False),
                "joined_year": p.get("joined_year"),
                "prev_club": p.get("prev_club"),
                "transfer_fee_eur": p.get("transfer_fee_eur"),
                "scouting_notes": p.get("scouting_notes"),
            }
            try:
                cur.execute(insert_person_sql, row)
                if cur.rowcount > 0:
                    new_id = cur.fetchone()["id"]
                    row["id"] = new_id
                    try:
                        cur.execute(insert_profile_sql, row)
                    except psycopg2.errors.InvalidTextRepresentation:
                        conn.rollback()
                        row["position"] = None
                        cur.execute(insert_person_sql, row)
                        new_id = cur.fetchone()["id"]
                        row["id"] = new_id
                        cur.execute(insert_profile_sql, row)
                    cur.execute(insert_status_sql, row)
                    cur.execute(insert_market_sql, row)
                    ok += 1
                else:
                    skipped += 1
            except Exception as e:
                conn.rollback()
                errors += 1
                print(f"  ERR {p['name']}: {e}")

        print(f"  {ok} inserted, {skipped} skipped (already existed), {errors} errors")

    # ── Final stats ────────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) as total FROM players")
    total = cur.fetchone()["total"]
    cur.execute("SELECT COUNT(*) as n FROM players WHERE scouting_notes IS NOT NULL")
    with_notes = cur.fetchone()["n"]
    print(f"\nFinal DB state: {total:,} players total, {with_notes:,} with scouting notes")

    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
