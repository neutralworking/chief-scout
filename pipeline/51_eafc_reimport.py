"""
51_eafc_reimport.py — Import EA FC 25 ratings from Kaggle as loose-weight attribute grades.

Uses the EA FC 25 Kaggle dataset (nyagami/ea-sports-fc-25-database-ratings-and-stats)
which has 30+ granular 0-99 attributes per player (~17k players).

Maps EA FC attributes directly to our attribute taxonomy and converts
0-99 → 0-20 stat_score scale. These sit at lowest source priority (10)
with 0.75 dampening weight — only filling gaps where no better data exists.

Usage:
    python 51_eafc_reimport.py                  # all matched players
    python 51_eafc_reimport.py --player ID       # single player
    python 51_eafc_reimport.py --limit 50        # first 50
    python 51_eafc_reimport.py --dry-run         # preview
    python 51_eafc_reimport.py --force           # overwrite existing eafc rows

Requires: imports/kaggle/eafc25/male_players.csv (from Kaggle)
"""
import argparse
import csv
import sys
import unicodedata
from pathlib import Path

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Args ───────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Import EA FC 25 ratings as attribute grades")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
parser.add_argument("--limit", type=int, default=None, help="Max players to process")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing eafc_inferred rows")
parser.add_argument("--include-women", action="store_true", help="Include female players too")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
CHUNK_SIZE = 200
SOURCE = "eafc_inferred"

# ── Connections ────────────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Attribute mapping ─────────────────────────────────────────────────────────
#
# EA FC 25 column → our attribute name.
# Direct 1:1 mapping where possible. EA FC has granular stats so no fanning needed.

OUTFIELD_MAP: dict[str, str] = {
    # Pace
    "Acceleration":     "acceleration",
    "Sprint Speed":     "pace",
    # Shooting
    "Positioning":      "movement",
    "Finishing":        "close_range",
    "Shot Power":       "long_range",
    "Long Shots":       "mid_range",
    "Volleys":          "volleys",
    "Penalties":        "penalties",
    # Passing
    "Vision":           "vision",
    "Crossing":         "crossing",
    "Short Passing":    "pass_accuracy",
    "Long Passing":     "pass_range",
    "Curve":            "through_balls",
    # Dribbling
    "Dribbling":        "take_ons",
    "Agility":          "balance",
    "Balance":          "shielding",
    "Reactions":        "reactions",
    "Ball Control":     "first_touch",
    "Composure":        "composure",
    # Defending
    "Interceptions":    "interceptions",
    "Heading Accuracy": "heading",
    "Def Awareness":    "awareness",
    "Standing Tackle":  "tackling",
    "Sliding Tackle":   "marking",
    # Physical
    "Jumping":          "jumping",
    "Stamina":          "stamina",
    "Strength":         "physical",
    "Aggression":       "aggression",
}

GK_MAP: dict[str, str] = {
    "GK Diving":       "close_range",
    "GK Handling":     "reactions",
    "GK Kicking":      "pass_range",
    "GK Positioning":  "positioning",
    "GK Reflexes":     "reactions",  # overlaps — higher value wins
    # GKs also get physical stats
    "Acceleration":    "acceleration",
    "Sprint Speed":    "pace",
    "Jumping":         "jumping",
    "Stamina":         "stamina",
    "Strength":        "physical",
    "Aggression":      "aggression",
    "Reactions":       "reactions",
}

GK_POSITIONS = {"GK"}

# ── Manual alias map ──────────────────────────────────────────────────────────
# EA FC name → person_id in our DB. For players where automated matching fails
# due to short names, reversed name order, or licensing renames.

MANUAL_ALIASES: dict[str, int] = {
    # Top-rated unmatched — verified person_ids
    "Heung Min Son": 17513,       # Son Heung-min
    "Benjamin White": 8969,       # Ben White
    "Kim Min Jae": 13561,         # Kim Min-Jae
    "Brahim": 9150,               # Brahim Diaz
    "Raphaël Guerreiro": 19633,   # Raphaël Adelino José Guerreiro
    "Aleksandar Mitrović": 8203,  # Alexsander Mitrovic
    "Tijjani Reijnders": 17963,   # Tijani Reijnders
    "Yeray": 18646,               # Yeray Álvarez
    "Ali Al Musrati": 7988,       # Al-Musrati
    "Reinildo": 16558,            # Reinildo Mandava
    "Lee Kang In": 13801,         # Lee Kang-in
    "Jean-Philippe Mateta": 12507, # Jean-Phillipe Mateta
    "Pape Matar Sarr": 16087,     # Pape Sarr
    "Hwang Hee Chan": 11868,      # Hwang Hee-chan
    # Spanish single-name players
    "Morata": 8310,               # Alvaro Morata
    "Parejo": 9888,               # Dani Parejo
    "Oyarzabal": 15198,           # Mikel Oyarzabal
    "Sancet": 15844,              # Oihan Sancet
    "Guruzeta": 11502,            # Gorka Guruzeta
    "Kirian": 13570,              # Kirian Rodríguez
    "Azpilicueta": 9470,          # César Azpilicueta
    "Zubimendi": 14666,           # Martín Zubimendi
    "Catena": 8052,               # Alejandro Catena
    "Riquelme": 16772,            # Rodrigo Riquelme (Atlético)
}

# ── CSV parsing ───────────────────────────────────────────────────────────────

KAGGLE_DIR = Path(__file__).parent.parent / "imports" / "kaggle" / "eafc25"


def parse_eafc_csv() -> list[dict]:
    """Parse EA FC 25 Kaggle CSV(s) into list of dicts."""
    files = ["male_players.csv"]
    if args.include_women:
        files.append("female_players.csv")

    players = []
    for fname in files:
        fpath = KAGGLE_DIR / fname
        if not fpath.exists():
            print(f"WARNING: {fpath} not found, skipping")
            continue

        with open(fpath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cleaned = {k.strip(): v.strip() if v else "" for k, v in row.items()}
                players.append(cleaned)
        print(f"  Loaded {fname}: {len(players)} players (cumulative)")

    return players


def eafc_to_scores(row: dict) -> dict[str, int]:
    """Convert an EA FC 25 CSV row to {attribute: stat_score_0_20}."""
    pos = row.get("Position", "").strip().upper()
    is_gk = pos in GK_POSITIONS

    # Use GK map for goalkeepers, outfield for everyone else
    mapping = GK_MAP if is_gk else OUTFIELD_MAP

    scores: dict[str, int] = {}
    for eafc_col, our_attr in mapping.items():
        raw = row.get(eafc_col, "").strip()
        if not raw:
            continue
        try:
            value_99 = int(raw)
        except ValueError:
            continue

        if value_99 <= 0:
            continue

        # Convert 0-99 → 0-20
        value_20 = max(1, min(20, round(value_99 / 5)))

        # Keep higher value if multiple EA FC attrs map to same target
        if our_attr not in scores or value_20 > scores[our_attr]:
            scores[our_attr] = value_20

    return scores


# ── Name matching ─────────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    """Normalize for matching: lowercase, strip accents, trim."""
    name = name.strip().lower()
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def build_name_index(sb_client) -> tuple[dict[str, list[dict]], dict[str, list[dict]], list[dict]]:
    """
    Load all people and build multiple lookup indices.

    Returns:
      - full_index: normalized full name → [people]
      - surname_index: normalized last word of name → [people]
      - all_people: raw list
    """
    print("  Loading people for name matching...")
    all_people = []
    offset = 0
    batch = 1000
    while True:
        r = sb_client.table("people").select("id, name, club_id").range(offset, offset + batch - 1).execute()
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
        # Surname = last word (handles "Virgil van Dijk" → "dijk")
        parts = norm.split()
        if parts:
            surname_index.setdefault(parts[-1], []).append(p)

    print(f"  People loaded: {len(all_people)}, full names: {len(full_index)}, surnames: {len(surname_index)}")
    return full_index, surname_index, all_people


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("EA FC 25 Import (Kaggle)")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    # Parse EA FC CSV
    eafc_players = parse_eafc_csv()
    if not eafc_players:
        print("ERROR: No EA FC data found. Download from Kaggle:")
        print("  kaggle datasets download -d nyagami/ea-sports-fc-25-database-ratings-and-stats -p imports/kaggle/eafc25 --unzip")
        sys.exit(1)

    print(f"  EA FC players: {len(eafc_players)}")

    # Build name indices from people table
    full_index, surname_index, all_people = build_name_index(sb)

    # Load club name → club_id mapping for club-based disambiguation
    print("  Loading clubs...")
    club_name_to_id: dict[str, int] = {}
    club_id_to_name: dict[int, str] = {}
    offset = 0
    while True:
        r = sb.table("clubs").select("id, clubname").range(offset, offset + 999).execute()
        if not r.data:
            break
        for c in r.data:
            if c.get("clubname"):
                club_name_to_id[normalize_name(c["clubname"])] = c["id"]
                club_id_to_name[c["id"]] = c["clubname"]
        offset += 1000
        if len(r.data) < 1000:
            break
    print(f"  Clubs loaded: {len(club_name_to_id)}")

    # EA FC team name → our club name aliases (common mismatches)
    TEAM_ALIASES: dict[str, str] = {
        "spurs": "tottenham hotspur",
        "lombardia fc": "inter",  # licensing
        "milano fc": "ac milan",  # licensing
        "paris sg": "paris saint-germain",
        "om": "olympique de marseille",
        "latium": "lazio",  # licensing
        "old trafford fc": "manchester united",  # licensing
        "east london fc": "west ham united",  # licensing
    }

    def find_club_id(eafc_team: str) -> int | None:
        """Try to match EA FC team name to our club_id."""
        if not eafc_team:
            return None
        norm_team = normalize_name(eafc_team)
        # Direct match
        if norm_team in club_name_to_id:
            return club_name_to_id[norm_team]
        # Alias
        if norm_team in TEAM_ALIASES:
            alias = TEAM_ALIASES[norm_team]
            if alias in club_name_to_id:
                return club_name_to_id[alias]
        # Substring match (e.g. "FC Bayern München" contains "bayern")
        for cname, cid in club_name_to_id.items():
            if norm_team in cname or cname in norm_team:
                return cid
        return None

    # Build person_id → person dict for alias lookups
    people_by_id = {p["id"]: p for p in all_people}

    def match_player(eafc_row: dict) -> dict | None:
        """Try to match an EA FC player to a person in our DB."""
        name = eafc_row.get("Name", "").strip()
        if not name:
            return None

        # 0. Manual alias (highest priority)
        if name in MANUAL_ALIASES:
            pid = MANUAL_ALIASES[name]
            if pid in people_by_id:
                return people_by_id[pid]

        norm = normalize_name(name)

        # 1. Exact full name match
        matches = full_index.get(norm, [])
        if len(matches) == 1:
            return matches[0]

        # 2. Full name match with club disambiguation
        if len(matches) > 1:
            eafc_club_id = find_club_id(eafc_row.get("Team", ""))
            if eafc_club_id:
                club_matches = [m for m in matches if m.get("club_id") == eafc_club_id]
                if len(club_matches) == 1:
                    return club_matches[0]
            return matches[0]  # fallback to first

        # 3. Strip suffixes like "Jr.", "Jr", "II", "III"
        cleaned = norm.rstrip(".")
        for suffix in (" jr", " jr.", " ii", " iii", " sr"):
            if cleaned.endswith(suffix):
                cleaned = cleaned[:-len(suffix)].strip()
        if cleaned != norm:
            matches = full_index.get(cleaned, [])
            if len(matches) == 1:
                return matches[0]

        # 4. Surname-only match + club disambiguation
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

        # 5. Try first word as surname (e.g. "Grimaldo" is a surname)
        if len(parts) == 1:
            # Single-word name — already tried as surname above
            pass
        elif len(parts) >= 2:
            # Try first word as surname too (some cultures: surname first)
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

    # Check existing eafc_inferred rows
    existing_players = set()
    if not FORCE:
        offset = 0
        while True:
            r = sb.table("attribute_grades").select("player_id").eq("source", SOURCE).range(offset, offset + 999).execute()
            if not r.data:
                break
            for row in r.data:
                existing_players.add(row["player_id"])
            offset += 1000
            if len(r.data) < 1000:
                break
        print(f"  Players already with eafc_inferred: {len(existing_players)}")

    # Match and convert
    upsert_rows = []
    stats = {
        "matched": 0,
        "unmatched": 0,
        "skipped_existing": 0,
        "skipped_no_attrs": 0,
        "attrs_total": 0,
    }
    unmatched_sample = []

    processed = 0
    for eafc in eafc_players:
        name = eafc.get("Name", "").strip()
        if not name:
            continue

        person = match_player(eafc)
        if not person:
            stats["unmatched"] += 1
            if len(unmatched_sample) < 20:
                unmatched_sample.append(f"{name} ({eafc.get('Team', '?')})")
            continue

        person_id = person["id"]

        if args.player and person_id != args.player:
            continue

        if not FORCE and person_id in existing_players:
            stats["skipped_existing"] += 1
            continue

        scores = eafc_to_scores(eafc)
        if not scores:
            stats["skipped_no_attrs"] += 1
            continue

        for attr, score in scores.items():
            upsert_rows.append({
                "player_id": person_id,
                "attribute": attr,
                "stat_score": score,
                "source": SOURCE,
                "is_inferred": True,
            })

        stats["matched"] += 1
        stats["attrs_total"] += len(scores)
        processed += 1

        if args.limit and processed >= args.limit:
            break

    # Sample output
    if upsert_rows:
        sample_pid = upsert_rows[0]["player_id"]
        sample_attrs = [r for r in upsert_rows if r["player_id"] == sample_pid]
        sample_name = next((p["name"] for people in full_index.values() for p in people if p["id"] == sample_pid), "?")
        print(f"\n  Sample: {sample_name} (id={sample_pid})")
        for a in sorted(sample_attrs, key=lambda x: -x["stat_score"]):
            print(f"    {a['attribute']:20s}  {a['stat_score']:>2}/20")

    # Unmatched sample
    if unmatched_sample:
        print(f"\n  Unmatched sample ({stats['unmatched']} total):")
        for name in unmatched_sample[:10]:
            print(f"    {name}")

    # Score distribution
    if upsert_rows:
        scores_all = [r["stat_score"] for r in upsert_rows]
        print(f"\n  Score distribution:")
        for bucket in range(1, 21):
            count = scores_all.count(bucket)
            if count > 0:
                bar = "#" * min(count // 50 + 1, 50)
                print(f"    {bucket:>2}/20  {count:>6}  {bar}")

    # Attribute coverage
    if upsert_rows:
        attr_counts: dict[str, int] = {}
        for r in upsert_rows:
            attr_counts[r["attribute"]] = attr_counts.get(r["attribute"], 0) + 1
        print(f"\n  Attributes written ({len(attr_counts)}):")
        for attr, cnt in sorted(attr_counts.items(), key=lambda x: -x[1]):
            print(f"    {attr:20s}  {cnt:>6}")

    # Write
    if DRY_RUN:
        print(f"\n  [dry-run] Would upsert {len(upsert_rows)} rows")
    else:
        # Delete existing eafc_inferred if force
        if FORCE and existing_players:
            print(f"  Deleting {len(existing_players)} existing eafc_inferred players...")
            existing_list = list(existing_players)
            for i in range(0, len(existing_list), 100):
                batch_ids = existing_list[i:i+100]
                sb.table("attribute_grades").delete().eq("source", SOURCE).in_("player_id", batch_ids).execute()

        # Deduplicate: keep highest stat_score per (player_id, attribute)
        deduped: dict[tuple, dict] = {}
        for row in upsert_rows:
            key = (row["player_id"], row["attribute"])
            if key not in deduped or row["stat_score"] > deduped[key]["stat_score"]:
                deduped[key] = row
        upsert_rows = list(deduped.values())
        print(f"  After dedup: {len(upsert_rows)} rows")

        # Upsert in chunks
        total = 0
        for i in range(0, len(upsert_rows), CHUNK_SIZE):
            chunk = upsert_rows[i:i + CHUNK_SIZE]
            sb.table("attribute_grades").upsert(
                chunk, on_conflict="player_id,attribute,source"
            ).execute()
            total += len(chunk)
            if total % 5000 == 0:
                print(f"    ... {total}/{len(upsert_rows)} rows")
        print(f"  Upserted: {total} rows")

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  EA FC players:     {len(eafc_players)}")
    print(f"  Matched:           {stats['matched']}")
    print(f"  Unmatched:         {stats['unmatched']}")
    print(f"  Skipped existing:  {stats['skipped_existing']}")
    print(f"  Skipped no attrs:  {stats['skipped_no_attrs']}")
    print(f"  Attribute rows:    {stats['attrs_total']}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")


if __name__ == "__main__":
    main()
