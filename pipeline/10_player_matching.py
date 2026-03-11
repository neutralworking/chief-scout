"""
10_player_matching.py — Match external player IDs to people table.

Links players from StatsBomb lineups and Understat stats to people.id
using exact name matching, fuzzy matching, and club/date disambiguation.

Usage:
    python 10_player_matching.py                  # full run
    python 10_player_matching.py --dry-run        # preview matches without writing
    python 10_player_matching.py --source understat  # one source only
    python 10_player_matching.py --source statsbomb
"""
import argparse
import html
import math
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone

import psycopg2
from psycopg2.extras import execute_values

from config import POSTGRES_DSN

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Match external player IDs to people table")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--source", choices=["understat", "statsbomb", "fbref", "all"], default="all",
                    help="Which source to match (default: all)")
parser.add_argument("--auto-add", action="store_true",
                    help="Auto-add unmatched players to people table")
args = parser.parse_args()
DRY_RUN = args.dry_run
SOURCE = args.source
AUTO_ADD = args.auto_add

# ── DB connection ─────────────────────────────────────────────────────────────

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Ensure linking tables exist ───────────────────────────────────────────────

cur.execute("""
CREATE TABLE IF NOT EXISTS player_id_links (
    id              bigserial PRIMARY KEY,
    person_id       bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    source          text NOT NULL,          -- 'understat' or 'statsbomb'
    external_id     text NOT NULL,          -- player_id from the source
    external_name   text,                   -- name as it appears in source
    match_method    text,                   -- 'exact', 'normalized', 'fuzzy'
    confidence      float DEFAULT 1.0,
    created_at      timestamptz DEFAULT now(),
    UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS player_id_links_person_idx ON player_id_links(person_id);
CREATE INDEX IF NOT EXISTS player_id_links_source_idx ON player_id_links(source, external_id);
""")

# ── Name normalization ────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    """Normalize a player name for matching."""
    if not name:
        return ""
    # Decode HTML entities (Amari&#039;i → Amari'i)
    name = html.unescape(name)
    # Strip accents (André → Andre)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    # Lowercase, strip extra whitespace
    name = name.lower().strip()
    name = re.sub(r"\s+", " ", name)
    # Remove suffixes like "Jr", "Jr.", "III", "II"
    name = re.sub(r"\s+(jr\.?|sr\.?|ii|iii|iv)$", "", name, flags=re.IGNORECASE)
    return name


def _dehyphenate(name: str) -> str:
    """Remove hyphens (Smith-Rowe → Smith Rowe)."""
    return name.replace("-", " ")


def name_variants(name: str) -> list[str]:
    """Generate plausible name variants for fuzzy matching."""
    norm = normalize_name(name)
    variants = {norm}

    # Dehyphenated version
    dehyp = _dehyphenate(norm)
    if dehyp != norm:
        variants.add(dehyp)

    parts = norm.split()
    if len(parts) >= 2:
        # First + Last
        variants.add(f"{parts[0]} {parts[-1]}")
        # Last name only (for single-name players like "Joelinton")
        variants.add(parts[-1])
        # First name only
        variants.add(parts[0])

    # Also dehyphenate the first+last combo
    dehyp_parts = dehyp.split()
    if len(dehyp_parts) >= 2:
        variants.add(f"{dehyp_parts[0]} {dehyp_parts[-1]}")

    # For multi-word names (3+), try dropping middle names
    if len(parts) >= 3:
        # First + Last (skipping middle)
        variants.add(f"{parts[0]} {parts[-1]}")
        # First two + Last
        variants.add(f"{parts[0]} {parts[1]} {parts[-1]}")
        # All contiguous subsets of 2 consecutive names
        for i in range(len(parts) - 1):
            variants.add(f"{parts[i]} {parts[i+1]}")

    return list(variants)


# Known name mappings for players whose external names don't match people table
MANUAL_OVERRIDES = {
    # Understat name (normalized) → people table name (normalized)
    "aleksandar mitrovic": "alexsander mitrovic",
    "jarrod bowen": "jarred bowen",
    "trevoh chalobah": "trevor chalobah",
    "jean-philippe mateta": "jean-phillipe mateta",
    "konstantinos tsimikas": "kostas tsimikas",
    "giovanni reyna": "gio reyna",
    "naif aguerd": "nayef aguerd",
    "estupinan": "victor estupinan",
    "anssumane fati": "ansu fati",
    "joseph gomez": "joe gomez",
    "matthew cash": "matty cash",
    "emile smith-rowe": "emile smith rowe",
    "benoit badiashile mukinayi": "benoit badiashile",
    "bryan gil salvatierra": "bryan gil",
    "hee-chan hwang": "hwang hee-chan",
    "jean-phillipe mateta": "jean-phillipe mateta",
}


# ── Load people lookup ────────────────────────────────────────────────────────

print("Loading people table...")
cur.execute("""
    SELECT p.id, p.name, c.name AS club_name
    FROM people p
    LEFT JOIN clubs c ON c.id = p.club_id
    WHERE p.name IS NOT NULL
""")
people_rows = cur.fetchall()
print(f"  {len(people_rows)} people loaded")

# Build normalized name → list of (id, original_name, club)
people_by_norm = defaultdict(list)
for pid, pname, club in people_rows:
    people_by_norm[normalize_name(pname)].append((pid, pname, club))

# Also index people by their name variants for reverse matching
# This helps when the external source uses a short name and people table has a long name
people_by_variant = defaultdict(list)
for pid, pname, club in people_rows:
    for variant in name_variants(pname):
        if variant != normalize_name(pname):  # skip exact (already in people_by_norm)
            people_by_variant[variant].append((pid, pname, club))

print(f"  {len(people_by_norm)} unique normalized names, {len(people_by_variant)} variant entries")

# Club name normalization for fuzzy club matching
CLUB_ALIASES = {
    # Premier League
    "tottenham": "tottenham hotspur",
    "spurs": "tottenham hotspur",
    "west ham": "west ham united",
    "man city": "manchester city",
    "manchester city fc": "manchester city",
    "man united": "manchester united",
    "man utd": "manchester united",
    "manchester united fc": "manchester united",
    "newcastle": "newcastle united",
    "newcastle utd": "newcastle united",
    "wolves": "wolverhampton wanderers",
    "wolverhampton": "wolverhampton wanderers",
    "nottm forest": "nottingham forest",
    "nott'm forest": "nottingham forest",
    "sheffield utd": "sheffield united",
    "luton": "luton town",
    "brighton": "brighton & hove albion",
    "brighton and hove albion": "brighton & hove albion",
    "brighton hove albion": "brighton & hove albion",
    "leicester": "leicester city",
    "west brom": "west bromwich albion",
    "west bromwich": "west bromwich albion",
    "crystal palace fc": "crystal palace",
    "arsenal fc": "arsenal",
    "liverpool fc": "liverpool",
    "chelsea fc": "chelsea",
    "everton fc": "everton",
    # La Liga
    "atletico madrid": "atletico de madrid",
    "atlético madrid": "atletico de madrid",
    "atlético de madrid": "atletico de madrid",
    "atletico": "atletico de madrid",
    "real sociedad": "real sociedad de futbol",
    "athletic bilbao": "athletic club",
    "athletic club bilbao": "athletic club",
    "betis": "real betis",
    "real betis balompie": "real betis",
    "villarreal cf": "villarreal",
    "celta vigo": "celta de vigo",
    "celta": "celta de vigo",
    "real madrid cf": "real madrid",
    "fc barcelona": "barcelona",
    "barça": "barcelona",
    "barca": "barcelona",
    # Bundesliga
    "bayern": "bayern munich",
    "bayern munchen": "bayern munich",
    "bayern münchen": "bayern munich",
    "fc bayern munchen": "bayern munich",
    "fc bayern münchen": "bayern munich",
    "bayer leverkusen": "bayer 04 leverkusen",
    "leverkusen": "bayer 04 leverkusen",
    "dortmund": "borussia dortmund",
    "borussia monchengladbach": "borussia monchengladbach",
    "gladbach": "borussia monchengladbach",
    "rb leipzig": "rasenballsport leipzig",
    "leipzig": "rasenballsport leipzig",
    "eintracht frankfurt": "eintracht frankfurt",
    "frankfurt": "eintracht frankfurt",
    "wolfsburg": "vfl wolfsburg",
    "freiburg": "sc freiburg",
    # Serie A
    "ac milan": "milan",
    "inter": "inter milan",
    "inter milan": "internazionale",
    "internazionale milano": "internazionale",
    "fc internazionale": "internazionale",
    "juventus fc": "juventus",
    "juve": "juventus",
    "napoli": "ssc napoli",
    "as roma": "roma",
    "ss lazio": "lazio",
    # Ligue 1
    "paris saint-germain": "paris saint germain",
    "paris saint germain f.c.": "paris saint germain",
    "psg": "paris saint germain",
    "olympique lyonnais": "lyon",
    "olympique de marseille": "marseille",
    "om": "marseille",
    "as monaco": "monaco",
    "as monaco fc": "monaco",
    "stade rennais": "rennes",
    "ogc nice": "nice",
    "rc lens": "lens",
    "losc lille": "lille",
    "losc": "lille",
    # Eredivisie
    "ajax amsterdam": "ajax",
    "afc ajax": "ajax",
    "psv eindhoven": "psv",
    "feyenoord rotterdam": "feyenoord",
    "az alkmaar": "az",
    # Portuguese
    "fc porto": "porto",
    "sl benfica": "benfica",
    "sporting cp": "sporting lisbon",
    "sporting clube de portugal": "sporting lisbon",
}


def normalize_club(club: str) -> str:
    if not club:
        return ""
    c = club.lower().strip()
    return CLUB_ALIASES.get(c, c)


def _disambiguate_by_club(candidates: list, club_hint: str) -> tuple[int | None, str | None]:
    """Try to pick a single candidate by matching club."""
    if not club_hint:
        return None, None
    norm_hint = normalize_club(club_hint)
    club_matches = [
        (pid, pname) for pid, pname, club in candidates
        if club and normalize_club(club) == norm_hint
    ]
    if len(club_matches) == 1:
        return club_matches[0]
    # Partial match (e.g. "Burnley" in "Burnley FC")
    club_matches = [
        (pid, pname) for pid, pname, club in candidates
        if club and (norm_hint in normalize_club(club) or normalize_club(club) in norm_hint)
    ]
    if len(club_matches) == 1:
        return club_matches[0]
    return None, None


def find_match(ext_name: str, club_hint: str = "") -> tuple[int | None, str | None, str]:
    """
    Try to match an external name to a person_id.
    Returns (person_id, original_name, method) or (None, None, 'none').
    """
    norm = normalize_name(ext_name)

    # 0. Check manual overrides first
    override = MANUAL_OVERRIDES.get(norm)
    if override:
        candidates = people_by_norm.get(normalize_name(override), [])
        if len(candidates) == 1:
            return candidates[0][0], candidates[0][1], "manual"
        if len(candidates) > 1:
            pid, pname = _disambiguate_by_club(candidates, club_hint)
            if pid:
                return pid, pname, "manual_club"

    # 1. Exact normalized match
    candidates = people_by_norm.get(norm, [])
    if len(candidates) == 1:
        return candidates[0][0], candidates[0][1], "exact"

    # 2. Multiple exact matches — try club disambiguation
    if len(candidates) > 1:
        pid, pname = _disambiguate_by_club(candidates, club_hint)
        if pid:
            return pid, pname, "club_disambig"
        return None, None, "ambiguous"

    # 3. Try dehyphenated match
    dehyp = _dehyphenate(norm)
    if dehyp != norm:
        candidates = people_by_norm.get(dehyp, [])
        if len(candidates) == 1:
            return candidates[0][0], candidates[0][1], "dehyphen"
        if len(candidates) > 1:
            pid, pname = _disambiguate_by_club(candidates, club_hint)
            if pid:
                return pid, pname, "dehyphen_club"

    # 4. Try variant matching (first+last, substrings, etc.)
    for variant in name_variants(ext_name):
        if variant == norm:
            continue  # already tried
        candidates = people_by_norm.get(variant, [])
        if len(candidates) == 1:
            return candidates[0][0], candidates[0][1], "variant"
        if len(candidates) > 1:
            pid, pname = _disambiguate_by_club(candidates, club_hint)
            if pid:
                return pid, pname, "variant_club"

    # 5. Reverse variant lookup — check if ext_name matches any people variant
    #    (handles case: ext has "João Félix", people has "João Félix Sequeira")
    candidates = people_by_variant.get(norm, [])
    if len(candidates) == 1:
        return candidates[0][0], candidates[0][1], "reverse_variant"
    if len(candidates) > 1:
        pid, pname = _disambiguate_by_club(candidates, club_hint)
        if pid:
            return pid, pname, "reverse_variant_club"

    return None, None, "none"


# ── Already-linked IDs ───────────────────────────────────────────────────────

cur.execute("SELECT source, external_id FROM player_id_links")
already_linked = {(r[0], r[1]) for r in cur.fetchall()}
print(f"  {len(already_linked)} existing links")

# ── Match Understat ───────────────────────────────────────────────────────────

if SOURCE in ("understat", "all"):
    print("\n── Matching Understat players ──")
    # Get distinct players with their most common team (derived from match data)
    cur.execute("""
        SELECT ups.player_id::text, ups.player_name,
               MODE() WITHIN GROUP (ORDER BY
                   CASE WHEN ups.h_a = 'h' THEN um.home_team ELSE um.away_team END
               ) AS team
        FROM understat_player_match_stats ups
        JOIN understat_matches um ON um.id = ups.match_id
        WHERE ups.player_name IS NOT NULL
        GROUP BY ups.player_id, ups.player_name
    """)
    understat_players = cur.fetchall()
    print(f"  {len(understat_players)} distinct players")

    matched = 0
    ambiguous = 0
    unmatched = 0
    skipped = 0
    inserts = []

    for ext_id, ext_name, ext_team in understat_players:
        if ("understat", ext_id) in already_linked:
            skipped += 1
            continue

        pid, orig_name, method = find_match(ext_name, club_hint=ext_team or "")
        if pid:
            matched += 1
            inserts.append((pid, "understat", ext_id, ext_name, method, 1.0 if method == "exact" else 0.8))
        elif method == "ambiguous":
            ambiguous += 1
        else:
            unmatched += 1

    print(f"  Matched: {matched} | Ambiguous: {ambiguous} | Unmatched: {unmatched} | Skipped (existing): {skipped}")

    if inserts and not DRY_RUN:
        execute_values(cur, """
            INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
            VALUES %s
            ON CONFLICT (source, external_id) DO NOTHING
        """, inserts)
        print(f"  Inserted {len(inserts)} links")
    elif inserts:
        print(f"  [dry-run] would insert {len(inserts)} links")

    # Show unmatched for review
    if unmatched > 0:
        print(f"\n  Unmatched Understat players ({min(unmatched, 20)} shown):")
        count = 0
        for ext_id, ext_name, ext_team in understat_players:
            if ("understat", ext_id) in already_linked:
                continue
            pid, _, method = find_match(ext_name, club_hint=ext_team or "")
            if pid is None and method == "none":
                print(f"    {ext_name} (id={ext_id}) [{ext_team}]")
                count += 1
                if count >= 20:
                    break

    if ambiguous > 0:
        print(f"\n  Ambiguous matches ({min(ambiguous, 10)} shown):")
        count = 0
        for ext_id, ext_name, ext_team in understat_players:
            if ("understat", ext_id) in already_linked:
                continue
            pid, _, method = find_match(ext_name, club_hint=ext_team or "")
            if method == "ambiguous":
                norm = normalize_name(ext_name)
                candidates = people_by_norm.get(norm, [])
                ids = [str(c[0]) for c in candidates]
                print(f"    {ext_name} [{ext_team}] → people ids: {', '.join(ids)}")
                count += 1
                if count >= 10:
                    break

# ── Match StatsBomb ───────────────────────────────────────────────────────────

if SOURCE in ("statsbomb", "all"):
    print("\n── Matching StatsBomb players ──")
    cur.execute("""
        SELECT DISTINCT player_id::text, player_name
        FROM sb_lineups
        WHERE player_name IS NOT NULL
    """)
    sb_players = cur.fetchall()
    print(f"  {len(sb_players)} distinct players")

    matched = 0
    ambiguous = 0
    unmatched = 0
    skipped = 0
    inserts = []

    for ext_id, ext_name in sb_players:
        if ("statsbomb", ext_id) in already_linked:
            skipped += 1
            continue

        pid, orig_name, method = find_match(ext_name)
        if pid:
            matched += 1
            inserts.append((pid, "statsbomb", ext_id, ext_name, method, 1.0 if method == "exact" else 0.8))
        elif method == "ambiguous":
            ambiguous += 1
        else:
            unmatched += 1

    print(f"  Matched: {matched} | Ambiguous: {ambiguous} | Unmatched: {unmatched} | Skipped (existing): {skipped}")

    if inserts and not DRY_RUN:
        execute_values(cur, """
            INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
            VALUES %s
            ON CONFLICT (source, external_id) DO NOTHING
        """, inserts)
        print(f"  Inserted {len(inserts)} links")
    elif inserts:
        print(f"  [dry-run] would insert {len(inserts)} links")

    # Show unmatched
    if unmatched > 0:
        print(f"\n  Unmatched StatsBomb players ({min(unmatched, 20)} shown):")
        count = 0
        for ext_id, ext_name in sb_players:
            if ("statsbomb", ext_id) in already_linked:
                continue
            pid, _, method = find_match(ext_name)
            if pid is None and method == "none":
                print(f"    {ext_name} (id={ext_id})")
                count += 1
                if count >= 20:
                    break

# ── Match FBRef ──────────────────────────────────────────────────────────

if SOURCE in ("fbref", "all"):
    print("\n── Matching FBRef players ──")
    cur.execute("""
        SELECT fbref_id, name, nation, position
        FROM fbref_players
        WHERE person_id IS NULL
    """)
    fbref_players = cur.fetchall()
    print(f"  {len(fbref_players)} unlinked fbref_players")

    # Also get team hints from season stats (most recent season per player)
    cur.execute("""
        SELECT DISTINCT ON (fbref_id) fbref_id, team
        FROM fbref_player_season_stats
        ORDER BY fbref_id, season DESC
    """)
    fbref_teams = {r[0]: r[1] for r in cur.fetchall()}

    matched = 0
    ambiguous = 0
    unmatched = 0
    skipped = 0
    link_inserts = []
    direct_updates = []  # (person_id, fbref_id) for fbref_players.person_id

    for fbref_id, ext_name, nation, position in fbref_players:
        if ("fbref", fbref_id) in already_linked:
            skipped += 1
            continue

        club_hint = fbref_teams.get(fbref_id, "")
        pid, orig_name, method = find_match(ext_name, club_hint=club_hint)
        if pid:
            matched += 1
            link_inserts.append((pid, "fbref", fbref_id, ext_name, method, 1.0 if method == "exact" else 0.8))
            direct_updates.append((pid, fbref_id))
        elif method == "ambiguous":
            ambiguous += 1
        else:
            unmatched += 1

    print(f"  Matched: {matched} | Ambiguous: {ambiguous} | Unmatched: {unmatched} | Skipped (existing): {skipped}")

    if link_inserts and not DRY_RUN:
        execute_values(cur, """
            INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
            VALUES %s
            ON CONFLICT (source, external_id) DO NOTHING
        """, link_inserts)
        print(f"  Inserted {len(link_inserts)} links into player_id_links")

        # Also set person_id directly on fbref_players for easy joins
        for pid, fid in direct_updates:
            cur.execute("UPDATE fbref_players SET person_id = %s WHERE fbref_id = %s AND person_id IS NULL",
                        (pid, fid))
        print(f"  Updated {len(direct_updates)} fbref_players.person_id")
    elif link_inserts:
        print(f"  [dry-run] would insert {len(link_inserts)} links + update {len(direct_updates)} fbref_players")

    # Show unmatched for review
    if unmatched > 0:
        print(f"\n  Unmatched FBRef players ({min(unmatched, 20)} shown):")
        count = 0
        for fbref_id, ext_name, nation, position in fbref_players:
            if ("fbref", fbref_id) in already_linked:
                continue
            club_hint = fbref_teams.get(fbref_id, "")
            pid, _, method = find_match(ext_name, club_hint=club_hint)
            if pid is None and method == "none":
                print(f"    {ext_name} ({fbref_id}) [{club_hint}]")
                count += 1
                if count >= 20:
                    break

    if ambiguous > 0:
        print(f"\n  Ambiguous matches ({min(ambiguous, 10)} shown):")
        count = 0
        for fbref_id, ext_name, nation, position in fbref_players:
            if ("fbref", fbref_id) in already_linked:
                continue
            club_hint = fbref_teams.get(fbref_id, "")
            pid, _, method = find_match(ext_name, club_hint=club_hint)
            if method == "ambiguous":
                norm = normalize_name(ext_name)
                candidates = people_by_norm.get(norm, [])
                ids = [str(c[0]) for c in candidates]
                print(f"    {ext_name} [{club_hint}] → people ids: {', '.join(ids)}")
                count += 1
                if count >= 10:
                    break

# ── Auto-add unmatched players ────────────────────────────────────────────────

if AUTO_ADD:
    print("\n── Auto-adding unmatched players to people table ──")

    # Collect all unmatched players across sources
    unmatched_players = []  # (source, ext_id, ext_name)

    if SOURCE in ("understat", "all"):
        cur.execute("""
            SELECT ups.player_id::text, ups.player_name,
                   MODE() WITHIN GROUP (ORDER BY
                       CASE WHEN ups.h_a = 'h' THEN um.home_team ELSE um.away_team END
                   ) AS team
            FROM understat_player_match_stats ups
            JOIN understat_matches um ON um.id = ups.match_id
            WHERE ups.player_name IS NOT NULL
            GROUP BY ups.player_id, ups.player_name
        """)
        for ext_id, ext_name, ext_team in cur.fetchall():
            if ("understat", ext_id) in already_linked:
                continue
            # Re-check if linked now (from earlier in this run)
            cur.execute("SELECT 1 FROM player_id_links WHERE source='understat' AND external_id=%s", (ext_id,))
            if cur.fetchone():
                continue
            pid, _, method = find_match(ext_name, club_hint=ext_team or "")
            if pid is None and method != "ambiguous":
                unmatched_players.append(("understat", ext_id, ext_name))

    if SOURCE in ("statsbomb", "all"):
        cur.execute("""
            SELECT DISTINCT player_id::text, player_name
            FROM sb_lineups WHERE player_name IS NOT NULL
        """)
        for ext_id, ext_name in cur.fetchall():
            if ("statsbomb", ext_id) in already_linked:
                continue
            cur.execute("SELECT 1 FROM player_id_links WHERE source='statsbomb' AND external_id=%s", (ext_id,))
            if cur.fetchone():
                continue
            pid, _, method = find_match(ext_name)
            if pid is None and method != "ambiguous":
                unmatched_players.append(("statsbomb", ext_id, ext_name))

    if SOURCE in ("fbref", "all"):
        cur.execute("SELECT fbref_id, name FROM fbref_players WHERE person_id IS NULL")
        for fbref_id, ext_name in cur.fetchall():
            if ("fbref", fbref_id) in already_linked:
                continue
            cur.execute("SELECT 1 FROM player_id_links WHERE source='fbref' AND external_id=%s", (fbref_id,))
            if cur.fetchone():
                continue
            club_hint = ""
            pid, _, method = find_match(ext_name, club_hint=club_hint)
            if pid is None and method != "ambiguous":
                unmatched_players.append(("fbref", fbref_id, ext_name))

    print(f"  {len(unmatched_players)} unmatched players to add")

    # Get next available ID
    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM people")
    next_id = cur.fetchone()[0]

    added = 0
    linked = 0
    for source, ext_id, ext_name in unmatched_players:
        clean_name = html.unescape(ext_name).strip()

        if DRY_RUN:
            added += 1
            continue

        # Insert into people with explicit ID
        cur.execute(
            "INSERT INTO people (id, name, active) VALUES (%s, %s, true) RETURNING id",
            (next_id, clean_name,)
        )
        new_pid = cur.fetchone()[0]
        added += 1

        # Link it
        cur.execute("""
            INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
            VALUES (%s, %s, %s, %s, 'auto_added', 0.6)
            ON CONFLICT (source, external_id) DO NOTHING
        """, (new_pid, source, ext_id, ext_name))
        linked += 1
        next_id += 1

    print(f"  Added {added} new people, linked {linked}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

# ── Summary ───────────────────────────────────────────────────────────────────

cur.execute("SELECT source, count(*), count(DISTINCT person_id) FROM player_id_links GROUP BY source")
print("\n── Link summary ──")
for source, count, people_count in cur.fetchall():
    print(f"  {source}: {count} links → {people_count} distinct people")

if DRY_RUN:
    print("\n(dry-run — no data was written)")

cur.close()
conn.close()
print("\nDone.")
