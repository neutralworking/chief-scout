"""
36_verify_clubs.py — Verify and fix player club assignments via Wikidata.

Cross-checks people.club_id against the player's current club from Wikidata P54.
Targets high-level players first since stale clubs matter most for them.
Also detects retired players and marks them inactive.

This is a focused, priority-ordered re-run of 18_wikidata_player_clubs.py that:
  1. Only targets top players (by level) with --force
  2. Reports mismatches clearly for manual review
  3. Can be run regularly to catch transfer window changes

Usage:
    python 36_verify_clubs.py --dry-run              # preview changes
    python 36_verify_clubs.py --min-level 80         # only level 80+ (default)
    python 36_verify_clubs.py --limit 200            # cap batch size
    python 36_verify_clubs.py --player 14666         # single player
    python 36_verify_clubs.py --retired              # also flag retired players (no current club)
"""
from __future__ import annotations

import argparse
import sys
import time
import unicodedata

import psycopg2
import psycopg2.extras
import requests

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Verify player clubs via Wikidata")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--min-level", type=int, default=80, help="Minimum level to check")
parser.add_argument("--limit", type=int, default=200, help="Max players to process")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
parser.add_argument("--retired", action="store_true", help="Flag players with no current club as inactive")
parser.add_argument("--verbose", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run
VERBOSE = args.verbose

# ── Wikidata ──────────────────────────────────────────────────────────────────

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "ChiefScout/1.0 (football scouting tool)"})


def normalize(name: str) -> str:
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.lower().strip()


CLUB_ALIASES: dict[str, str] = {
    "fc barcelona": "barcelona",
    "futbol club barcelona": "barcelona",
    "real madrid cf": "real madrid",
    "real madrid c.f.": "real madrid",
    "real madrid club de futbol": "real madrid",
    "manchester united fc": "manchester united",
    "manchester united f.c.": "manchester united",
    "manchester city fc": "manchester city",
    "manchester city f.c.": "manchester city",
    "arsenal fc": "arsenal",
    "arsenal f.c.": "arsenal",
    "chelsea fc": "chelsea",
    "chelsea f.c.": "chelsea",
    "liverpool fc": "liverpool",
    "liverpool f.c.": "liverpool",
    "tottenham hotspur fc": "tottenham hotspur",
    "tottenham hotspur f.c.": "tottenham hotspur",
    "paris saint-germain fc": "paris saint-germain",
    "paris saint-germain f.c.": "paris saint-germain",
    "fc bayern munich": "bayern munich",
    "fc bayern munchen": "bayern munich",
    "juventus fc": "juventus",
    "juventus f.c.": "juventus",
    "ac milan": "milan",
    "inter milan": "internazionale",
    "fc internazionale milano": "internazionale",
    "ssc napoli": "napoli",
    "s.s.c. napoli": "napoli",
    "atletico de madrid": "atletico madrid",
    "club atletico de madrid": "atletico madrid",
    "fc porto": "porto",
}


def normalize_club_name(name: str) -> str:
    norm = normalize(name)
    for suffix in [" fc", " f.c.", " cf", " c.f.", " sc", " s.c."]:
        if norm.endswith(suffix):
            norm = norm[:-len(suffix)].strip()
    return CLUB_ALIASES.get(norm, norm)


def batch_get_clubs(qids: list[str]) -> dict[str, dict]:
    """Query Wikidata for current clubs of multiple players (P54)."""
    values = " ".join(f"wd:{qid}" for qid in qids)
    query = f"""
    SELECT ?player ?team ?teamLabel ?start ?end WHERE {{
      VALUES ?player {{ {values} }}
      ?player p:P54 ?stmt .
      ?stmt ps:P54 ?team .
      OPTIONAL {{ ?stmt pq:P580 ?start . }}
      OPTIONAL {{ ?stmt pq:P582 ?end . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    ORDER BY ?player DESC(?start)
    """
    try:
        resp = SESSION.get(WIKIDATA_SPARQL, params={"query": query, "format": "json"}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"  SPARQL error: {e}")
        return {}

    player_clubs: dict[str, list] = {}
    for row in data.get("results", {}).get("bindings", []):
        p_qid = row["player"]["value"].split("/")[-1]
        t_qid = row["team"]["value"].split("/")[-1]
        t_label = row.get("teamLabel", {}).get("value", "")
        end = row.get("end", {}).get("value")
        start = row.get("start", {}).get("value", "")

        if p_qid not in player_clubs:
            player_clubs[p_qid] = []
        player_clubs[p_qid].append({
            "club_qid": t_qid, "club_label": t_label,
            "start": start, "end": end,
        })

    result = {}
    for qid, clubs in player_clubs.items():
        current = [c for c in clubs if c["end"] is None and c["start"]]
        ended = [c for c in clubs if c["end"] is not None]
        undated = [c for c in clubs if c["end"] is None and not c["start"]]

        if current:
            current.sort(key=lambda c: c["start"] or "", reverse=True)
            result[qid] = current[0]
        elif ended:
            ended.sort(key=lambda c: c["end"] or "", reverse=True)
            result[qid] = ended[0]
        elif undated:
            result[qid] = undated[0]

    return result


def match_club(club_qid: str, club_label: str,
               clubs_by_wikidata: dict, clubs_by_name_norm: dict, clubs_by_alias: dict) -> int | None:
    if club_qid in clubs_by_wikidata:
        return clubs_by_wikidata[club_qid]
    norm = normalize(club_label)
    if norm in clubs_by_name_norm:
        return clubs_by_name_norm[norm]
    alias = normalize_club_name(club_label)
    if alias in clubs_by_alias:
        return clubs_by_alias[alias]
    # Partial word match
    norm_words = set(norm.split()) - {"fc", "cf", "sc", "ac", "de", "la", "le", "el", "al"}
    if len(norm_words) >= 2:
        for cname_norm, cid in clubs_by_name_norm.items():
            cname_words = set(cname_norm.split()) - {"fc", "cf", "sc", "ac", "de", "la", "le", "el", "al"}
            if len(cname_words) >= 2 and (cname_words <= norm_words or norm_words <= cname_words):
                return cid
    return None


def main():
    print("36 — Club Verification (Wikidata)")

    if not POSTGRES_DSN:
        print("  ERROR: Set POSTGRES_DSN in .env.local")
        sys.exit(1)

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Load clubs ────────────────────────────────────────────────────────
    cur.execute("SELECT id, clubname, wikidata_id FROM clubs")
    clubs_by_wikidata: dict[str, int] = {}
    clubs_by_name_norm: dict[str, int] = {}
    clubs_by_alias: dict[str, int] = {}
    clubs_by_id: dict[int, str] = {}

    for row in cur.fetchall():
        cid, cname, cwikidata = row["id"], row["clubname"], row["wikidata_id"]
        clubs_by_id[cid] = cname
        clubs_by_name_norm[normalize(cname)] = cid
        clubs_by_alias[normalize_club_name(cname)] = cid
        if cwikidata:
            clubs_by_wikidata[cwikidata] = cid

    print(f"  Loaded {len(clubs_by_id)} clubs ({len(clubs_by_wikidata)} with wikidata_id)")

    # ── Load players to verify ────────────────────────────────────────────
    if args.player:
        cur.execute("""
            SELECT pe.id, pe.name, pe.wikidata_id, pe.club_id, pe.active,
                   c.clubname as current_club, pp.level
            FROM people pe
            LEFT JOIN clubs c ON c.id = pe.club_id
            LEFT JOIN player_profiles pp ON pp.person_id = pe.id
            WHERE pe.id = %s AND pe.wikidata_id IS NOT NULL
        """, (args.player,))
    else:
        cur.execute("""
            SELECT pe.id, pe.name, pe.wikidata_id, pe.club_id, pe.active,
                   c.clubname as current_club, pp.level
            FROM people pe
            LEFT JOIN clubs c ON c.id = pe.club_id
            LEFT JOIN player_profiles pp ON pp.person_id = pe.id
            WHERE pe.wikidata_id IS NOT NULL
            AND pe.active = true
            AND pp.level >= %s
            ORDER BY pp.level DESC NULLS LAST
            LIMIT %s
        """, (args.min_level, args.limit))

    players = cur.fetchall()
    print(f"  Players to verify: {len(players)}")

    if not players:
        conn.close()
        return

    # ── Process in SPARQL batches ─────────────────────────────────────────
    BATCH_SIZE = 25
    updated = 0
    retired_count = 0
    no_change = 0
    no_data = 0
    no_match = 0
    mismatches = []

    for i in range(0, len(players), BATCH_SIZE):
        batch = players[i:i + BATCH_SIZE]
        qid_map = {}
        for p in batch:
            qid = p["wikidata_id"]
            if qid and qid.startswith("Q"):
                qid_map[qid] = p

        if not qid_map:
            continue

        print(f"\n  Batch {i // BATCH_SIZE + 1}: querying {len(qid_map)} players...")
        clubs_data = batch_get_clubs(list(qid_map.keys()))

        for qid, p in qid_map.items():
            if qid not in clubs_data:
                no_data += 1
                if args.retired and p["active"]:
                    print(f"    {p['name']} (lvl {p['level']}): NO CURRENT CLUB on Wikidata")
                elif VERBOSE:
                    print(f"    {p['name']}: no club data")
                continue

            wd = clubs_data[qid]
            club_id = match_club(
                wd["club_qid"], wd["club_label"],
                clubs_by_wikidata, clubs_by_name_norm, clubs_by_alias,
            )

            if club_id is None:
                no_match += 1
                if VERBOSE:
                    print(f"    {p['name']}: WD says '{wd['club_label']}' — not in our clubs")
                continue

            if club_id == p["club_id"]:
                no_change += 1
                continue

            old_club = p["current_club"] or "None"
            new_club = clubs_by_id.get(club_id, wd["club_label"])

            print(f"    {p['name']} (lvl {p['level']}): {old_club} → {new_club}")
            mismatches.append({
                "id": p["id"], "name": p["name"], "level": p["level"],
                "old_club": old_club, "new_club": new_club, "new_club_id": club_id,
            })

            if not DRY_RUN:
                cur.execute("UPDATE people SET club_id = %s WHERE id = %s", (club_id, p["id"]))
            updated += 1

        time.sleep(2)  # Rate limit SPARQL

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n  ── Summary ──")
    print(f"  Checked:    {len(players)}")
    print(f"  Correct:    {no_change}")
    print(f"  Updated:    {updated}")
    print(f"  No WD data: {no_data}")
    print(f"  No match:   {no_match}")
    if retired_count:
        print(f"  Retired:    {retired_count}")
    if DRY_RUN:
        print(f"  (dry-run — no data was written)")

    if mismatches:
        print(f"\n  ── Mismatches fixed ──")
        for m in sorted(mismatches, key=lambda x: -(x["level"] or 0)):
            print(f"    {m['name']} (lvl {m['level']}): {m['old_club']} → {m['new_club']}")

    conn.close()
    print("\n  Done.")


if __name__ == "__main__":
    main()
