"""
56b_eafc_playstyles.py — Import EA FC 25 PlayStyles as style tags.

EA FC 25 assigns editorial PlayStyle labels (e.g. "Finesse Shot+", "Rapid",
"Tiki Taka") to ~7,500 players. These are non-statistical attributes describing
HOW a player plays, not just how good they are.

Reuses the name-matching logic from 56_eafc_reimport.py. Maps EAFC PlayStyles
to our existing style tags where possible, creates new ones where needed.

"+" variants are treated as the same tag but recorded in player_trait_scores
with severity 8 (vs 5 for standard).

Usage:
    python 56b_eafc_playstyles.py                  # all matched players
    python 56b_eafc_playstyles.py --player ID       # single player
    python 56b_eafc_playstyles.py --limit 50        # first 50
    python 56b_eafc_playstyles.py --dry-run         # preview
    python 56b_eafc_playstyles.py --force           # overwrite existing rows
"""
import argparse
import csv
import sys
import unicodedata
from pathlib import Path

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Args ───────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Import EA FC 25 PlayStyles as tags")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
parser.add_argument("--limit", type=int, default=None, help="Max players to process")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Overwrite existing eafc_playstyle rows")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
CHUNK_SIZE = 200
SOURCE = "eafc_playstyle"

# ── Connections ────────────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── PlayStyle → style tag mapping ────────────────────────────────────────────
#
# Maps EAFC PlayStyle base names (without "+") to our existing style tags.
# If value is None, a new tag will be created with the EAFC name.

PLAYSTYLE_MAP: dict[str, str | None] = {
    # ── Shooting ──
    "Finesse Shot":   "Finishing",
    "Chip Shot":      "Finishing",
    "Power Shot":     "Long Range Shooting",
    "Power Header":   "Aerial Ability",
    # ── Passing ──
    "Incisive Pass":  "Passing Ability",
    "Pinged Pass":    "Passing Ability",
    "Long Ball Pass": "Long Range Passing",
    "Tiki Taka":      "Ball Retention",
    "Whipped Pass":   "Crossing Ability",
    "Trivela":        None,  # unique enough to keep
    "Dead Ball":      "Set Piece Threat",
    "Long Throw":     "Long Throws",
    "Far Throw":      None,  # GK-specific, keep
    # ── Dribbling / Movement ──
    "Technical":      "Technical Ability",
    "Flair":          "Trickery",
    "First Touch":    "Close Control",
    "Quick Step":     "Acceleration",
    "Rapid":          "Pace",
    "Trickster":      "Trickery",
    # ── Defending ──
    "Jockey":         "Tackling Ability",
    "Block":          "Positioning",
    "Intercept":      "Defensive Awareness",
    "Slide Tackle":   "Tackling Ability",
    "Anticipate":     "Anticipation",
    "Bruiser":        "Strength",
    # ── Physical ──
    "Aerial":         "Aerial Ability",
    "Relentless":     "Work Rate",
    "Acrobatic":      None,  # unique — acrobatic finishing/clearances
    "Press Proven":   None,  # composure under pressure, keep
    # ── GK ──
    "1v1 Close Down": "One On One Specialist",
    "Cross Claimer":  None,  # GK cross claiming, keep
    "Deflector":      "Shot Stopping",
    "Far Reach":      "Shot Stopping",
    "Footwork":       None,  # GK footwork, keep
    "Rush Out":       "Sweeper Keeper",
}

# ── Name matching (reused from 56_eafc_reimport.py) ─────────────────────────

# Import manual aliases from the sibling script
from importlib.util import spec_from_file_location, module_from_spec
_spec = spec_from_file_location("eafc_reimport", Path(__file__).parent / "56_eafc_reimport.py")
_mod = module_from_spec(_spec)
# Only grab the MANUAL_ALIASES dict, don't execute main
sys.modules["eafc_reimport"] = _mod
# Read the file to extract MANUAL_ALIASES
import ast
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
        parts = norm.split()
        if parts:
            surname_index.setdefault(parts[-1], []).append(p)

    print(f"  People loaded: {len(all_people)}, full names: {len(full_index)}, surnames: {len(surname_index)}")
    return full_index, surname_index, all_people


# ── CSV parsing ──────────────────────────────────────────────────────────────

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


def parse_playstyles(raw: str) -> list[tuple[str, bool]]:
    """Parse 'Finesse Shot+, Rapid, Tiki Taka' → [(name, is_plus), ...]."""
    if not raw.strip():
        return []
    result = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        is_plus = token.endswith("+")
        base = token.rstrip("+").strip()
        result.append((base, is_plus))
    return result


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("EA FC 25 PlayStyles Import")
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

    # Check existing eafc_playstyle rows
    existing_players = set()
    if not FORCE:
        offset = 0
        while True:
            r = sb.table("player_trait_scores").select("player_id").eq("source", SOURCE).range(offset, offset + 999).execute()
            if not r.data:
                break
            for row in r.data:
                existing_players.add(row["player_id"])
            offset += 1000
            if len(r.data) < 1000:
                break
        print(f"  Players already with eafc_playstyle: {len(existing_players)}")

    # Process
    trait_rows = []
    stats = {"matched": 0, "unmatched": 0, "skipped_existing": 0, "skipped_no_styles": 0, "traits_total": 0}
    style_counts: dict[str, int] = {}

    processed = 0
    for eafc in eafc_players:
        name = eafc.get("Name", "").strip()
        if not name:
            continue

        play_style_raw = eafc.get("play style", "").strip()
        if not play_style_raw:
            stats["skipped_no_styles"] += 1
            continue

        person = match_player(eafc)
        if not person:
            stats["unmatched"] += 1
            continue

        person_id = person["id"]
        if args.player and person_id != args.player:
            continue
        if not FORCE and person_id in existing_players:
            stats["skipped_existing"] += 1
            continue

        playstyles = parse_playstyles(play_style_raw)
        if not playstyles:
            continue

        for base_name, is_plus in playstyles:
            # Map to our tag name
            if base_name not in PLAYSTYLE_MAP:
                print(f"  WARNING: unmapped PlayStyle '{base_name}' — skipping")
                continue

            our_tag = PLAYSTYLE_MAP[base_name]
            if our_tag is None:
                our_tag = base_name  # keep EAFC name

            severity = 8 if is_plus else 5
            trait_rows.append({
                "player_id": person_id,
                "trait": our_tag,
                "category": "style",
                "severity": severity,
                "source": SOURCE,
            })

            style_counts[our_tag] = style_counts.get(our_tag, 0) + 1

        stats["matched"] += 1
        stats["traits_total"] += len(playstyles)
        processed += 1
        if args.limit and processed >= args.limit:
            break

    # Sample output
    if trait_rows:
        sample_pid = trait_rows[0]["player_id"]
        sample_traits = [r for r in trait_rows if r["player_id"] == sample_pid]
        sample_name = next((p["name"] for p in all_people if p["id"] == sample_pid), "?")
        print(f"\n  Sample: {sample_name} (id={sample_pid})")
        for t in sample_traits:
            plus = " [+]" if t["severity"] == 8 else ""
            print(f"    {t['trait']:25s}  severity={t['severity']}{plus}")

    # Style distribution
    if style_counts:
        print(f"\n  PlayStyle distribution ({len(style_counts)} unique):")
        for style, cnt in sorted(style_counts.items(), key=lambda x: -x[1])[:25]:
            bar = "#" * min(cnt // 20 + 1, 40)
            print(f"    {style:25s}  {cnt:>5}  {bar}")

    # Write
    if DRY_RUN:
        print(f"\n  [dry-run] Would upsert {len(trait_rows)} trait rows")
    else:
        # Delete existing if force
        if FORCE and existing_players:
            print(f"  Deleting existing eafc_playstyle rows for {len(existing_players)} players...")
            existing_list = list(existing_players)
            for i in range(0, len(existing_list), 100):
                batch_ids = existing_list[i:i + 100]
                sb.table("player_trait_scores").delete().eq("source", SOURCE).in_("player_id", batch_ids).execute()

        # Deduplicate trait rows: keep highest severity per (player_id, trait)
        deduped: dict[tuple, dict] = {}
        for row in trait_rows:
            key = (row["player_id"], row["trait"])
            if key not in deduped or row["severity"] > deduped[key]["severity"]:
                deduped[key] = row
        trait_rows = list(deduped.values())

        # Upsert traits
        total = 0
        for i in range(0, len(trait_rows), CHUNK_SIZE):
            chunk = trait_rows[i:i + CHUNK_SIZE]
            sb.table("player_trait_scores").upsert(
                chunk, on_conflict="player_id,trait,source"
            ).execute()
            total += len(chunk)
            if total % 2000 == 0:
                print(f"    ... {total}/{len(trait_rows)} trait rows")
        print(f"  Upserted: {total} trait rows")

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  EA FC players:     {len(eafc_players)}")
    print(f"  With PlayStyles:   {len(eafc_players) - stats['skipped_no_styles']}")
    print(f"  Matched:           {stats['matched']}")
    print(f"  Unmatched:         {stats['unmatched']}")
    print(f"  Skipped existing:  {stats['skipped_existing']}")
    print(f"  Skipped no styles: {stats['skipped_no_styles']}")
    print(f"  Trait rows:        {len(trait_rows)}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")


if __name__ == "__main__":
    main()
