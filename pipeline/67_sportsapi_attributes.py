"""
67_sportsapi_attributes.py — Fetch player attribute radar from SportsAPIPro.

SportsAPIPro provides a 5-axis attribute overview (0-100):
attacking, technical, tactical, defending, creativity.
Includes year-over-year history (up to 4 seasons) and position averages.

Usage:
    python 67_sportsapi_attributes.py                    # all linked players
    python 67_sportsapi_attributes.py --player "Saka"    # single player by name
    python 67_sportsapi_attributes.py --limit 50         # first 50 players
    python 67_sportsapi_attributes.py --link-only        # search + match, no attrs
    python 67_sportsapi_attributes.py --dry-run           # preview without writing
    python 67_sportsapi_attributes.py --force             # re-fetch even if data exists
"""

import argparse
import html
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.dirname(__file__))
from config import SPORTSAPI_PRO_KEY

API_BASE = "https://v2.football.sportsapipro.com"
SOURCE = "sportsapi"
REQUEST_DELAY = 1.0  # seconds between requests (free tier = 100/day)

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest SportsAPIPro player attributes")
parser.add_argument("--player", type=str, default=None, help="Single player name search")
parser.add_argument("--limit", type=int, default=None, help="Max players to process")
parser.add_argument("--link-only", action="store_true", help="Search + match only, skip attribute fetch")
parser.add_argument("--dry-run", action="store_true", help="Preview counts, no writes")
parser.add_argument("--force", action="store_true", help="Re-fetch even if data exists")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

# ── API helpers ──────────────────────────────────────────────────────────────

request_count = 0
rate_limited = False


def api_get(path: str, params: dict = None) -> dict | None:
    """Make a SportsAPIPro request with rate limiting."""
    global request_count, rate_limited
    if rate_limited:
        return None

    headers = {"x-api-key": SPORTSAPI_PRO_KEY}
    url = f"{API_BASE}{path}"
    resp = requests.get(url, headers=headers, params=params, timeout=30)

    request_count += 1

    if resp.status_code == 429:
        print("  RATE LIMIT HIT — stopping all requests.")
        rate_limited = True
        return None
    if resp.status_code == 404:
        return None
    resp.raise_for_status()

    data = resp.json()
    if not data.get("success"):
        print(f"  API error: {data}")
        return None

    time.sleep(REQUEST_DELAY)
    return data.get("data")


def search_player(name: str) -> list[dict]:
    """Search SportsAPIPro for a player by name. Returns list of results."""
    data = api_get("/api/search", {"q": name})
    if not data:
        return []
    results = data.get("results", [])
    # Filter to football players only
    return [r for r in results
            if r.get("type") == "player"
            and r.get("entity", {}).get("team", {}).get("sport", {}).get("slug") == "football"]


def fetch_attributes(sportsapi_id: int) -> dict | None:
    """Fetch attribute overviews for a player."""
    return api_get(f"/api/players/{sportsapi_id}/attribute-overviews")


# ── Name matching (reuse pipeline 65 patterns) ──────────────────────────────

def normalize(name: str) -> str:
    name = html.unescape(name)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.lower().strip()
    name = re.sub(r"\s+", " ", name)
    name = re.sub(r"\s+(jr\.?|sr\.?|ii|iii|iv)$", "", name)
    return name


def build_people_lookups(cur):
    """Build lookup dicts from people table."""
    cur.execute("SELECT id, name FROM people WHERE active = true")
    people_rows = cur.fetchall()

    by_norm = {}
    by_last = {}
    for pid, pname in people_rows:
        norm = normalize(pname)
        by_norm.setdefault(norm, []).append((pid, pname))
        parts = norm.split()
        if len(parts) >= 2:
            by_last.setdefault(parts[-1], []).append((pid, pname))

    # Load clubs for disambiguation
    cur.execute("""
        SELECT p.id, c.clubname FROM people p
        JOIN clubs c ON c.id = p.club_id
        WHERE p.active = true AND p.club_id IS NOT NULL
    """)
    people_club = {r[0]: normalize(r[1]) for r in cur.fetchall()}

    return by_norm, by_last, people_club


def normalize_club(name: str) -> str:
    n = normalize(name)
    for full, short in [("manchester united", "man utd"), ("manchester city", "man city"),
                        ("tottenham hotspur", "tottenham"), ("wolverhampton wanderers", "wolves"),
                        ("nottingham forest", "nott forest"), ("newcastle united", "newcastle"),
                        ("west ham united", "west ham"), ("leicester city", "leicester")]:
        if n == full or n == short:
            return full
    return n


def match_search_result(result: dict, by_norm: dict, by_last: dict, people_club: dict) -> tuple[int | None, str]:
    """Try to match a SportsAPIPro search result to a person_id.
    Returns (person_id, method) or (None, '')."""
    entity = result.get("entity", {})
    api_name = entity.get("name", "")
    team = entity.get("team", {})
    team_name = team.get("name", "")
    norm_name = normalize(api_name)

    # Strategy 1: Exact name
    candidates = by_norm.get(norm_name, [])
    if len(candidates) == 1:
        return candidates[0][0], "exact"

    # Strategy 2: Exact name + club disambiguation
    if len(candidates) > 1 and team_name:
        norm_team = normalize_club(team_name)
        club_matches = [pid for pid, _ in candidates if norm_team in people_club.get(pid, "")]
        if len(club_matches) == 1:
            return club_matches[0], "exact_club"

    # Strategy 3: Fuzzy (last name exact + first name JW)
    parts = norm_name.split()
    if len(parts) >= 2:
        last = parts[-1]
        first = " ".join(parts[:-1])
        fuzzy_candidates = by_last.get(last, [])
        if fuzzy_candidates:
            try:
                from rapidfuzz import fuzz
            except ImportError:
                return None, ""

            best_score = 0
            best_pid = None
            for pid, pname in fuzzy_candidates:
                pnorm = normalize(pname)
                pparts = pnorm.split()
                if len(pparts) < 2:
                    continue
                p_first = " ".join(pparts[:-1])

                jw = fuzz.ratio(norm_name, pnorm) / 100.0
                first_jw = fuzz.ratio(first, p_first) / 100.0
                if first_jw < 0.65:
                    continue

                score = jw * 0.5 + first_jw * 0.5
                if team_name:
                    norm_team = normalize_club(team_name)
                    if norm_team in people_club.get(pid, ""):
                        score += 0.05

                if score > best_score:
                    best_score = score
                    best_pid = pid

            if best_pid and best_score >= 0.90:
                return best_pid, "fuzzy"

    return None, ""


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not SPORTSAPI_PRO_KEY:
        print("ERROR: SPORTSAPI_PRO_KEY not set in .env.local")
        sys.exit(1)

    from lib.db import require_conn
    from psycopg2.extras import execute_values

    conn = require_conn()
    cur = conn.cursor()

    # Ensure tables exist (raise timeout for DDL — Supabase default 2min can be too short)
    sql_path = os.path.join(os.path.dirname(__file__), "sql", "051_sportsapi.sql")
    if os.path.exists(sql_path):
        cur.execute("SET statement_timeout = '5min'")
        with open(sql_path) as f:
            cur.execute(f.read())
        conn.commit()
        cur.execute("RESET statement_timeout")

    # Load existing links
    cur.execute("SELECT person_id, external_id FROM player_id_links WHERE source = %s", (SOURCE,))
    existing_links = {int(r[1]): r[0] for r in cur.fetchall()}  # sportsapi_id → person_id
    reverse_links = {v: int(k) for k, v in existing_links.items()}  # person_id → sportsapi_id
    print(f"Existing SportsAPIPro links: {len(existing_links)}")

    # Build people lookups
    by_norm, by_last, people_club = build_people_lookups(cur)

    # ── Determine target players ─────────────────────────────────────────────

    if args.player:
        # Single player mode
        cur.execute("SELECT id, name FROM people WHERE active = true AND name ILIKE %s",
                    (f"%{args.player}%",))
        targets = cur.fetchall()
        if not targets:
            print(f"No people found matching '{args.player}'")
            sys.exit(0)
        print(f"Targeting {len(targets)} player(s) matching '{args.player}'")
    else:
        # All profiled players not yet enriched with SportsAPIPro attributes
        cur.execute("""
            SELECT p.id, p.name FROM people p
            JOIN player_profiles pp ON pp.person_id = p.id
            LEFT JOIN sportsapi_attributes sa ON sa.person_id = p.id AND sa.year_shift = 0
            WHERE p.active = true
              AND sa.id IS NULL
            ORDER BY pp.level DESC NULLS LAST, pp.overall DESC NULLS LAST
        """)
        targets = cur.fetchall()
        print(f"Targeting {len(targets)} profiled players without SportsAPIPro data")

    if args.limit:
        targets = targets[:args.limit]
        print(f"  Limited to {args.limit}")

    # ── Phase 1: Search + Link ───────────────────────────────────────────────

    linked = 0
    already = 0
    failed = 0
    links_to_insert = []
    players_to_fetch = []  # (person_id, sportsapi_id)

    for person_id, name in targets:
        if person_id in reverse_links:
            already += 1
            players_to_fetch.append((person_id, reverse_links[person_id]))
            continue

        # Search SportsAPIPro
        if rate_limited:
            break
        results = search_player(name)
        if not results:
            failed += 1
            continue

        # Try to match the top result
        pid, method = match_search_result(results[0], by_norm, by_last, people_club)
        if pid and pid == person_id:
            sportsapi_id = results[0]["entity"]["id"]
            links_to_insert.append((person_id, SOURCE, str(sportsapi_id), name, method, 0.85))
            players_to_fetch.append((person_id, sportsapi_id))
            reverse_links[person_id] = sportsapi_id
            linked += 1
        elif pid and pid != person_id:
            # Matched a different person — try other results
            matched = False
            for r in results[1:5]:
                pid2, method2 = match_search_result(r, by_norm, by_last, people_club)
                if pid2 == person_id:
                    sportsapi_id = r["entity"]["id"]
                    links_to_insert.append((person_id, SOURCE, str(sportsapi_id), name, method2, 0.80))
                    players_to_fetch.append((person_id, sportsapi_id))
                    reverse_links[person_id] = sportsapi_id
                    linked += 1
                    matched = True
                    break
            if not matched:
                failed += 1
        else:
            failed += 1

        if request_count % 25 == 0:
            print(f"  Progress: {request_count} API calls, {linked} linked, {failed} failed")

    print(f"\nLinking: {linked} new + {already} existing = {linked + already} total, {failed} unmatched")

    if not DRY_RUN and links_to_insert:
        execute_values(cur, """
            INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
            VALUES %s
            ON CONFLICT (source, external_id) DO NOTHING
        """, links_to_insert)
        conn.commit()
        print(f"  Wrote {len(links_to_insert)} links to player_id_links")

    if args.link_only:
        print(f"\nDone (link-only mode). {request_count} API calls used.")
        conn.close()
        return

    # ── Phase 2: Fetch attributes ────────────────────────────────────────────

    if not FORCE:
        # Skip players we already have attributes for
        cur.execute("SELECT DISTINCT person_id FROM sportsapi_attributes")
        have_attrs = {r[0] for r in cur.fetchall()}
        before = len(players_to_fetch)
        players_to_fetch = [(pid, sid) for pid, sid in players_to_fetch if pid not in have_attrs]
        skipped = before - len(players_to_fetch)
        if skipped:
            print(f"  Skipping {skipped} players with existing attributes (use --force)")

    attrs_inserted = 0
    avgs_seen = {}

    print(f"\nFetching attributes for {len(players_to_fetch)} players...")

    for i, (person_id, sportsapi_id) in enumerate(players_to_fetch):
        if rate_limited:
            break
        data = fetch_attributes(sportsapi_id)
        if not data:
            continue

        # Player attribute overviews (multi-year)
        player_attrs = data.get("playerAttributeOverviews", [])
        rows = []
        for attr in player_attrs:
            rows.append((
                person_id,
                sportsapi_id,
                attr.get("position"),
                attr.get("attacking"),
                attr.get("technical"),
                attr.get("tactical"),
                attr.get("defending"),
                attr.get("creativity"),
                attr.get("yearShift", 0),
                datetime.now(timezone.utc).isoformat(),
            ))

        if rows and not DRY_RUN:
            execute_values(cur, """
                INSERT INTO sportsapi_attributes
                    (person_id, sportsapi_id, position, attacking, technical, tactical, defending, creativity, year_shift, fetched_at)
                VALUES %s
                ON CONFLICT (person_id, year_shift) DO UPDATE SET
                    sportsapi_id = EXCLUDED.sportsapi_id,
                    position = EXCLUDED.position,
                    attacking = EXCLUDED.attacking,
                    technical = EXCLUDED.technical,
                    tactical = EXCLUDED.tactical,
                    defending = EXCLUDED.defending,
                    creativity = EXCLUDED.creativity,
                    fetched_at = EXCLUDED.fetched_at
            """, rows)
            attrs_inserted += len(rows)

        # Position averages (store once per position)
        avg_attrs = data.get("averageAttributeOverviews", [])
        for avg in avg_attrs:
            pos = avg.get("position")
            ys = avg.get("yearShift", 0)
            key = (pos, ys)
            if key not in avgs_seen:
                avgs_seen[key] = avg

        # Commit every 25 players
        if (i + 1) % 25 == 0 and not DRY_RUN:
            conn.commit()
            print(f"  {i + 1}/{len(players_to_fetch)} — {attrs_inserted} attribute rows")

    # Write position averages
    if avgs_seen and not DRY_RUN:
        avg_rows = [(a.get("position"), a.get("attacking"), a.get("technical"),
                     a.get("tactical"), a.get("defending"), a.get("creativity"),
                     a.get("yearShift", 0), datetime.now(timezone.utc).isoformat())
                    for a in avgs_seen.values()]
        execute_values(cur, """
            INSERT INTO sportsapi_position_averages
                (position, attacking, technical, tactical, defending, creativity, year_shift, fetched_at)
            VALUES %s
            ON CONFLICT (position, year_shift) DO UPDATE SET
                attacking = EXCLUDED.attacking,
                technical = EXCLUDED.technical,
                tactical = EXCLUDED.tactical,
                defending = EXCLUDED.defending,
                creativity = EXCLUDED.creativity,
                fetched_at = EXCLUDED.fetched_at
        """, avg_rows)

    if not DRY_RUN:
        conn.commit()

    print(f"\n{'=' * 50}")
    print(f"Attributes: {attrs_inserted} rows {'(dry-run)' if DRY_RUN else 'written'}")
    print(f"Position averages: {len(avgs_seen)} stored")
    print(f"API calls used: {request_count}")
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
