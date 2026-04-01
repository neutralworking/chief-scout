"""
56d_eafc_enrichment.py — Enrich people + traits from EA FC 25 metadata.

Imports three things from the EAFC Kaggle CSV:
  1. Preferred foot → people.preferred_foot (backfills NULLs only)
  2. Weak foot (4-5★) → player_trait_scores "Two Footed" (severity 7/9)
  3. Skill moves (4-5★) → player_trait_scores "Skill Moves" (severity 6/9)

Reuses name-matching logic from 56_eafc_reimport.py.

Usage:
    python 56d_eafc_enrichment.py                  # all matched players
    python 56d_eafc_enrichment.py --player ID       # single player
    python 56d_eafc_enrichment.py --limit 50        # first 50
    python 56d_eafc_enrichment.py --dry-run         # preview
    python 56d_eafc_enrichment.py --force           # overwrite existing foot data
"""
import argparse
import ast
import csv
import sys
import unicodedata
from pathlib import Path

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

parser = argparse.ArgumentParser(description="Import EA FC 25 metadata enrichment")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
parser.add_argument("--limit", type=int, default=None, help="Max players to process")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing preferred_foot")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
CHUNK_SIZE = 200
SOURCE = "eafc_metadata"

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Load MANUAL_ALIASES from sibling script ──────────────────────────────────

_source = (Path(__file__).parent / "56_eafc_reimport.py").read_text()
_tree = ast.parse(_source)
MANUAL_ALIASES: dict[str, int] = {}
for node in ast.walk(_tree):
    if isinstance(node, ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == "MANUAL_ALIASES":
                MANUAL_ALIASES = ast.literal_eval(node.value)

TEAM_ALIASES: dict[str, str] = {
    "spurs": "tottenham hotspur",
    "lombardia fc": "inter",
    "milano fc": "ac milan",
    "paris sg": "paris saint-germain",
    "om": "olympique de marseille",
    "latium": "lazio",
    "old trafford fc": "manchester united",
    "east london fc": "west ham united",
}

# ── Name matching ────────────────────────────────────────────────────────────


def normalize_name(name: str) -> str:
    name = name.strip().lower()
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def build_name_index(sb_client):
    print("  Loading people for name matching...")
    all_people = []
    offset = 0
    batch = 1000
    while True:
        r = sb_client.table("people").select("id, name, club_id, preferred_foot").range(offset, offset + batch - 1).execute()
        if not r.data:
            break
        all_people.extend(r.data)
        offset += batch
        if len(r.data) < batch:
            break

    full_index: dict[str, list[dict]] = {}
    surname_index: dict[str, list[dict]] = {}
    for p in all_people:
        norm = normalize_name(p["name"])
        full_index.setdefault(norm, []).append(p)
        parts = norm.split()
        if parts:
            surname_index.setdefault(parts[-1], []).append(p)

    print(f"  People loaded: {len(all_people)}, full names: {len(full_index)}")
    return full_index, surname_index, all_people


KAGGLE_DIR = Path(__file__).parent.parent / "imports" / "kaggle" / "eafc25"


def parse_eafc_csv() -> list[dict]:
    players = []
    fpath = KAGGLE_DIR / "male_players.csv"
    if not fpath.exists():
        print(f"ERROR: {fpath} not found")
        sys.exit(1)
    with open(fpath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned = {k.strip(): v.strip() if v else "" for k, v in row.items()}
            players.append(cleaned)
    print(f"  Loaded: {len(players)} players")
    return players


def main():
    print("EA FC 25 Metadata Enrichment")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    eafc_players = parse_eafc_csv()
    full_index, surname_index, all_people = build_name_index(sb)
    people_by_id = {p["id"]: p for p in all_people}

    # Load clubs for disambiguation
    print("  Loading clubs...")
    club_name_to_id: dict[str, int] = {}
    offset = 0
    while True:
        r = sb.table("clubs").select("id, clubname").range(offset, offset + 999).execute()
        if not r.data:
            break
        for c in r.data:
            if c.get("clubname"):
                club_name_to_id[normalize_name(c["clubname"])] = c["id"]
        offset += 1000
        if len(r.data) < 1000:
            break
    print(f"  Clubs loaded: {len(club_name_to_id)}")

    def find_club_id(eafc_team: str) -> int | None:
        if not eafc_team:
            return None
        norm_team = normalize_name(eafc_team)
        if norm_team in club_name_to_id:
            return club_name_to_id[norm_team]
        if norm_team in TEAM_ALIASES:
            alias = TEAM_ALIASES[norm_team]
            if alias in club_name_to_id:
                return club_name_to_id[alias]
        for cname, cid in club_name_to_id.items():
            if norm_team in cname or cname in norm_team:
                return cid
        return None

    def match_player(eafc_row: dict) -> dict | None:
        name = eafc_row.get("Name", "").strip()
        if not name:
            return None
        if name in MANUAL_ALIASES:
            pid = MANUAL_ALIASES[name]
            if pid in people_by_id:
                return people_by_id[pid]
        norm = normalize_name(name)
        matches = full_index.get(norm, [])
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            eafc_club_id = find_club_id(eafc_row.get("Team", ""))
            if eafc_club_id:
                club_matches = [m for m in matches if m.get("club_id") == eafc_club_id]
                if len(club_matches) == 1:
                    return club_matches[0]
            return matches[0]
        cleaned = norm.rstrip(".")
        for suffix in (" jr", " jr.", " ii", " iii", " sr"):
            if cleaned.endswith(suffix):
                cleaned = cleaned[:-len(suffix)].strip()
        if cleaned != norm:
            matches = full_index.get(cleaned, [])
            if len(matches) == 1:
                return matches[0]
        parts = norm.replace(".", "").split()
        surname = parts[-1] if parts else norm
        surname_matches = surname_index.get(surname, [])
        if len(surname_matches) == 1:
            return surname_matches[0]
        if len(surname_matches) > 1:
            eafc_club_id = find_club_id(eafc_row.get("Team", ""))
            if eafc_club_id:
                club_matches = [m for m in surname_matches if m.get("club_id") == eafc_club_id]
                if len(club_matches) == 1:
                    return club_matches[0]
        if len(parts) >= 2:
            first_word = parts[0]
            first_matches = surname_index.get(first_word, [])
            if len(first_matches) == 1:
                return first_matches[0]
            if len(first_matches) > 1:
                eafc_club_id = find_club_id(eafc_row.get("Team", ""))
                if eafc_club_id:
                    club_matches = [m for m in first_matches if m.get("club_id") == eafc_club_id]
                    if len(club_matches) == 1:
                        return club_matches[0]
        return None

    # ── Process ──────────────────────────────────────────────────────────────

    foot_updates = []     # (person_id, preferred_foot)
    trait_rows = []       # player_trait_scores rows

    stats = {
        "matched": 0, "unmatched": 0,
        "foot_filled": 0, "foot_skipped": 0, "foot_already": 0,
        "two_footed": 0, "skill_moves": 0,
    }

    processed = 0
    for eafc in eafc_players:
        name = eafc.get("Name", "").strip()
        if not name:
            continue

        person = match_player(eafc)
        if not person:
            stats["unmatched"] += 1
            continue

        person_id = person["id"]
        if args.player and person_id != args.player:
            continue

        stats["matched"] += 1

        # ── 1. Preferred foot ────────────────────────────────────────────
        eafc_foot = eafc.get("Preferred foot", "").strip()
        current_foot = person.get("preferred_foot")

        if eafc_foot in ("Left", "Right"):
            if not current_foot or FORCE:
                foot_updates.append((person_id, eafc_foot))
                stats["foot_filled"] += 1
            else:
                stats["foot_already"] += 1
        else:
            stats["foot_skipped"] += 1

        # ── 2. Weak foot → Two Footed trait ──────────────────────────────
        wf_raw = eafc.get("Weak foot", "").strip().rstrip("★")
        try:
            wf = int(wf_raw)
        except (ValueError, TypeError):
            wf = 0

        if wf >= 4:
            severity = 7 if wf == 4 else 9  # 4★ = good, 5★ = elite
            trait_rows.append({
                "player_id": person_id,
                "trait": "Two Footed",
                "category": "style",
                "severity": severity,
                "source": SOURCE,
            })
            stats["two_footed"] += 1

        # ── 3. Skill moves → Skill Moves trait ──────────────────────────
        sm_raw = eafc.get("Skill moves", "").strip().rstrip("★")
        try:
            sm = int(sm_raw)
        except (ValueError, TypeError):
            sm = 0

        if sm >= 4:
            severity = 6 if sm == 4 else 9  # 4★ = skilled, 5★ = elite
            trait_rows.append({
                "player_id": person_id,
                "trait": "Skill Moves",
                "category": "style",
                "severity": severity,
                "source": SOURCE,
            })
            stats["skill_moves"] += 1

        processed += 1
        if args.limit and processed >= args.limit:
            break

    # ── Summary ──────────────────────────────────────────────────────────────

    print(f"\n  Matched:           {stats['matched']}")
    print(f"  Unmatched:         {stats['unmatched']}")
    print(f"\n  Preferred foot:")
    print(f"    Would fill:      {stats['foot_filled']}")
    print(f"    Already set:     {stats['foot_already']}")
    print(f"    No foot data:    {stats['foot_skipped']}")
    print(f"\n  Traits:")
    print(f"    Two Footed:      {stats['two_footed']}")
    print(f"    Skill Moves:     {stats['skill_moves']}")

    if DRY_RUN:
        # Show samples
        if foot_updates:
            print(f"\n  Sample foot updates:")
            for pid, foot in foot_updates[:10]:
                name = people_by_id[pid]["name"]
                print(f"    {name:30s} → {foot}")
        print(f"\n  [dry-run] Would update {len(foot_updates)} feet, upsert {len(trait_rows)} traits")
        return

    # ── Write preferred foot ─────────────────────────────────────────────────

    if foot_updates:
        print(f"\n  Writing {len(foot_updates)} preferred_foot updates...")
        for i in range(0, len(foot_updates), CHUNK_SIZE):
            chunk = foot_updates[i:i + CHUNK_SIZE]
            for pid, foot in chunk:
                sb.table("people").update({"preferred_foot": foot}).eq("id", pid).execute()
            if (i + CHUNK_SIZE) % 2000 == 0:
                print(f"    ... {min(i + CHUNK_SIZE, len(foot_updates))}/{len(foot_updates)}")
        print(f"  Updated: {len(foot_updates)} rows")

    # ── Write traits ─────────────────────────────────────────────────────────

    if trait_rows:
        # Deduplicate: keep highest severity per (player_id, trait)
        deduped: dict[tuple, dict] = {}
        for row in trait_rows:
            key = (row["player_id"], row["trait"])
            if key not in deduped or row["severity"] > deduped[key]["severity"]:
                deduped[key] = row
        trait_rows = list(deduped.values())

        print(f"  Writing {len(trait_rows)} trait scores...")
        for i in range(0, len(trait_rows), CHUNK_SIZE):
            chunk = trait_rows[i:i + CHUNK_SIZE]
            sb.table("player_trait_scores").upsert(
                chunk, on_conflict="player_id,trait,source"
            ).execute()
        print(f"  Upserted: {len(trait_rows)} trait rows")

    print(f"\n── Done ──────────────────────────────────────────────────────────")


if __name__ == "__main__":
    main()
