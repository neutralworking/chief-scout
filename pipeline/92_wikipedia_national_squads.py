"""
92_wikipedia_national_squads.py — Fetch national team squads from Wikipedia for WC 2026 nations.

Parses the "Current squad" / "Players" section from each nation's Wikipedia page,
extracts player names, positions, clubs, caps, and goals, then matches to existing
people records or inserts new ones. Ensures all 48 WC nations have playable rosters
for On The Plane.

Wikipedia pages follow a consistent MediaWiki template for squad lists, making them
the most current source for national team composition (updated after every call-up).

Usage:
    python pipeline/92_wikipedia_national_squads.py                  # all 48 nations
    python pipeline/92_wikipedia_national_squads.py --nation france  # single nation
    python pipeline/92_wikipedia_national_squads.py --thin-only      # only nations with <26 players
    python pipeline/92_wikipedia_national_squads.py --dry-run        # preview, no writes
    python pipeline/92_wikipedia_national_squads.py --force          # re-fetch even if cached
    python pipeline/92_wikipedia_national_squads.py --list           # just show coverage
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import unicodedata
import urllib.request
import urllib.parse
from datetime import datetime, date
from typing import Optional

import psycopg2
import psycopg2.extras

from config import POSTGRES_DSN, CACHE_DIR

# ── CLI ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Fetch national team squads from Wikipedia")
parser.add_argument("--nation", type=str, help="Single nation slug (e.g., 'france')")
parser.add_argument("--thin-only", action="store_true", help="Only process nations with <26 players")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Re-fetch even if recently cached")
parser.add_argument("--list", action="store_true", help="Just show coverage, don't fetch")
parser.add_argument("--verbose", action="store_true", help="Extra logging")
parser.add_argument("--min-players", type=int, default=11, help="Minimum players for 'playable' (default 11)")
args = parser.parse_args()

DRY_RUN = args.dry_run
VERBOSE = args.verbose

CACHE_DIR.mkdir(parents=True, exist_ok=True)
SQUAD_CACHE = CACHE_DIR / "wikipedia_squads"
SQUAD_CACHE.mkdir(parents=True, exist_ok=True)

# ── Wikipedia article titles for national football teams ─────────────────────
# Maps WC nation slug → Wikipedia article title
WIKI_ARTICLES: dict[str, str] = {
    # UEFA
    "france": "France national football team",
    "spain": "Spain national football team",
    "england": "England national football team",
    "belgium": "Belgium national football team",
    "netherlands": "Netherlands national football team",
    "portugal": "Portugal national football team",
    "italy": "Italy national football team",
    "germany": "Germany national football team",
    "croatia": "Croatia national football team",
    "denmark": "Denmark national football team",
    "austria": "Austria national football team",
    "switzerland": "Switzerland national football team",
    "ukraine": "Ukraine national football team",
    "turkey": "Turkey national football team",
    "serbia": "Serbia national football team",
    "poland": "Poland national football team",
    # CONMEBOL
    "argentina": "Argentina national football team",
    "brazil": "Brazil national football team",
    "uruguay": "Uruguay national football team",
    "colombia": "Colombia national football team",
    "ecuador": "Ecuador national football team",
    "paraguay": "Paraguay national football team",
    # CONCACAF
    "usa": "United States men's national soccer team",
    "mexico": "Mexico national football team",
    "canada": "Canada men's national soccer team",
    "costa-rica": "Costa Rica national football team",
    "jamaica": "Jamaica national football team",
    "panama": "Panama national football team",
    # CAF
    "morocco": "Morocco national football team",
    "senegal": "Senegal national football team",
    "nigeria": "Nigeria national football team",
    "egypt": "Egypt national football team",
    "cameroon": "Cameroon national football team",
    "ivory-coast": "Ivory Coast national football team",
    "algeria": "Algeria national football team",
    "south-africa": "South Africa national football team",
    "dr-congo": "DR Congo national football team",
    # AFC
    "japan": "Japan national football team",
    "south-korea": "South Korea national football team",
    "iran": "Iran national football team",
    "australia": "Australia men's national soccer team",
    "saudi-arabia": "Saudi Arabia national football team",
    "qatar": "Qatar national football team",
    "iraq": "Iraq national football team",
    "indonesia": "Indonesia national football team",
    # OFC
    "new-zealand": "New Zealand men's national football team",
    # Playoff
    "peru": "Peru national football team",
    "honduras": "Honduras national football team",
}

# Position normalization: Wikipedia uses various labels
POSITION_MAP: dict[str, str] = {
    "gk": "GK", "goalkeeper": "GK",
    "df": "CD", "defender": "CD", "cb": "CD", "centre-back": "CD",
    "rb": "WD", "lb": "WD", "right-back": "WD", "left-back": "WD",
    "right back": "WD", "left back": "WD", "full-back": "WD", "fullback": "WD",
    "wing-back": "WD", "wingback": "WD", "wb": "WD",
    "mf": "CM", "midfielder": "CM", "cm": "CM", "central midfielder": "CM",
    "central midfield": "CM",
    "dm": "DM", "defensive midfielder": "DM", "defensive midfield": "DM", "cdm": "DM",
    "am": "AM", "attacking midfielder": "AM", "attacking midfield": "AM", "cam": "AM",
    "winger": "WF", "rw": "WF", "lw": "WF", "right winger": "WF", "left winger": "WF",
    "wide midfielder": "WM", "rm": "WM", "lm": "WM",
    "fw": "CF", "forward": "CF", "striker": "CF", "st": "CF",
    "centre-forward": "CF", "center forward": "CF", "cf": "CF",
}


def normalize_name(name: str) -> str:
    """Normalize a player name for matching: strip accents, lowercase, collapse whitespace."""
    # Remove content in parentheses like "(captain)"
    name = re.sub(r"\s*\(.*?\)\s*", " ", name)
    # NFD decompose, strip combining marks
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Lowercase, collapse whitespace, strip
    return re.sub(r"\s+", " ", ascii_name.lower()).strip()


def normalize_position(pos_raw: str) -> Optional[str]:
    """Map Wikipedia position text to our position enum."""
    pos = pos_raw.strip().lower()
    # Try direct lookup
    if pos in POSITION_MAP:
        return POSITION_MAP[pos]
    # Try partial match
    for key, val in POSITION_MAP.items():
        if key in pos:
            return val
    return None


# ── Wikipedia API fetching ───────────────────────────────────────────────────

WIKI_API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "ChiefScout/1.0 (football scouting; contact@chief-scout.com)"


def fetch_wiki_html(article_title: str) -> Optional[str]:
    """Fetch the HTML of a Wikipedia article via the REST API."""
    cache_file = SQUAD_CACHE / f"{article_title.replace(' ', '_')}.html"

    # Use cache unless --force
    if cache_file.exists() and not args.force:
        age_hours = (time.time() - cache_file.stat().st_mtime) / 3600
        if age_hours < 24:  # Cache for 24h
            if VERBOSE:
                print(f"  [cache] Using cached HTML for {article_title} ({age_hours:.1f}h old)")
            return cache_file.read_text(encoding="utf-8")

    # Fetch via parse API (returns HTML)
    params = {
        "action": "parse",
        "page": article_title,
        "prop": "text",
        "format": "json",
        "disableeditsection": "true",
        "redirects": "true",
    }
    url = f"{WIKI_API}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            html_text = data.get("parse", {}).get("text", {}).get("*", "")
            if html_text:
                cache_file.write_text(html_text, encoding="utf-8")
                time.sleep(0.5)  # Respect Wikipedia rate limits
                return html_text
    except Exception as e:
        print(f"  [error] Failed to fetch {article_title}: {e}")

    return None


def parse_squad_from_html(html_text: str, nation_slug: str) -> list[dict]:
    """Parse the current squad table from Wikipedia HTML.

    Wikipedia national team pages use {{nat fs player}} templates which render
    as table rows with: No., Pos., Name, Date of birth (age), Caps, Goals, Club.
    """
    players = []

    # Strategy 1: Find squad tables by looking for table rows with player data
    # Wikipedia squad tables have <th> headers: No., Pos., Player/Name, DOB, Caps, Goals, Club
    # They render as <tr> rows inside <table class="wikitable sortable">

    # Find all table rows that look like squad entries
    # Pattern: rows with a position cell (GK/DF/MF/FW) and player name link
    row_pattern = re.compile(
        r'<tr[^>]*>\s*'
        r'<td[^>]*>(\d+)\s*</td>\s*'        # Jersey number
        r'<td[^>]*>(\w+)\s*</td>\s*'         # Position (GK/DF/MF/FW)
        r'<td[^>]*>(.*?)</td>\s*'             # Name cell (contains <a> link)
        r'<td[^>]*>(.*?)</td>\s*'             # DOB cell
        r'<td[^>]*>([\d,]*)\s*</td>\s*'      # Caps
        r'<td[^>]*>([\d,]*)\s*</td>',         # Goals
        re.DOTALL
    )

    # Also try a more flexible pattern for different Wikipedia layouts
    # Some pages use slightly different column orders
    flexible_pattern = re.compile(
        r'<tr[^>]*>\s*'
        r'(?:<td[^>]*>\s*\d*\s*</td>\s*)?'   # Optional jersey number
        r'<td[^>]*>\s*(GK|DF|MF|FW)\s*</td>\s*'  # Position
        r'<td[^>]*>(.*?)</td>',                # Name cell
        re.DOTALL | re.IGNORECASE
    )

    # Strategy 2: Parse using nat_fs_player template artifacts
    # These templates produce specific class patterns
    nat_fs_pattern = re.compile(
        r'<tr>\s*<td>(\d+)</td>\s*<td>(GK|DF|MF|FW)</td>\s*'
        r'<td[^>]*>.*?(?:title="([^"]+)"[^>]*>([^<]+)</a>|>([^<]+)<).*?</td>\s*'
        r'(?:<td[^>]*>.*?</td>\s*)?'  # DOB
        r'<td[^>]*>\s*(\d+)\s*</td>\s*'  # Caps
        r'<td[^>]*>\s*(\d+)\s*</td>',  # Goals
        re.DOTALL
    )

    # Try multiple extraction strategies
    seen_names = set()

    # Strategy A: Look for sortable wikitable with position column
    # Wikipedia class ordering varies (e.g. "wikitable sortable" or "sortable wikitable plainrowheaders")
    tables = re.findall(r'<table[^>]*class="[^"]*(?:wikitable[^"]*sortable|sortable[^"]*wikitable)[^"]*"[^>]*>(.*?)</table>', html_text, re.DOTALL)
    if not tables:
        tables = re.findall(r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>', html_text, re.DOTALL)

    for table_html in tables:
        # Check if this looks like a squad table (has GK/DF/MF/FW positions, possibly with sort-key prefix like "1GK")
        if not re.search(r'>\d*(?:GK|DF|MF|FW)<', table_html, re.IGNORECASE):
            continue

        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL)
        for row_html in rows:
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row_html, re.DOTALL)
            if len(cells) < 3:
                continue

            # Find position cell
            pos_idx = None
            pos_val = None
            for i, cell in enumerate(cells):
                cell_text = re.sub(r'<[^>]+>', '', cell).strip()
                # Wikipedia sort keys prepend digits (e.g. "1GK", "2DF") — strip them
                cell_clean = re.sub(r'^\d+', '', cell_text).strip()
                if cell_clean.upper() in ("GK", "DF", "MF", "FW"):
                    pos_idx = i
                    pos_val = cell_clean.upper()
                    break

            if pos_idx is None:
                continue

            # Name is typically the cell after position (or 2 after if number comes first)
            name_idx = pos_idx + 1
            if name_idx >= len(cells):
                continue

            name_cell = cells[name_idx]

            # Extract name from link or plain text
            name_match = re.search(r'title="([^"]+)"', name_cell)
            if name_match:
                player_name = name_match.group(1)
                # Clean up: remove " (footballer)" suffixes
                player_name = re.sub(r'\s*\(footballer[^)]*\)', '', player_name)
                player_name = re.sub(r'\s*\(soccer[^)]*\)', '', player_name)
                player_name = re.sub(r'\s*\(born \d{4}\)', '', player_name)
                player_name = re.sub(r'\s*\(page does not exist\)', '', player_name)
            else:
                player_name = re.sub(r'<[^>]+>', '', name_cell).strip()

            if not player_name or len(player_name) < 2:
                continue

            # Extract jersey number (cell before position, or first cell)
            jersey = None
            if pos_idx > 0:
                num_text = re.sub(r'<[^>]+>', '', cells[pos_idx - 1]).strip()
                if num_text.isdigit():
                    jersey = int(num_text)

            # Extract caps and goals (cells after name)
            caps = None
            goals = None
            for i in range(name_idx + 1, min(len(cells), name_idx + 5)):
                cell_text = re.sub(r'<[^>]+>', '', cells[i]).strip().replace(',', '')
                if cell_text.isdigit():
                    if caps is None:
                        # Skip DOB-looking numbers
                        if len(cell_text) <= 3:
                            caps = int(cell_text)
                    elif goals is None:
                        goals = int(cell_text)

            # Extract DOB from "(aged XX)" or date pattern
            dob = None
            for i in range(name_idx + 1, min(len(cells), name_idx + 4)):
                dob_match = re.search(r'(\d{4})-(\d{2})-(\d{2})', cells[i])
                if dob_match:
                    try:
                        dob = date(int(dob_match.group(1)), int(dob_match.group(2)), int(dob_match.group(3)))
                    except ValueError:
                        pass
                    break

            # Extract club from later cells (look for links to club articles)
            # Club cells typically have: flag icon (links to federation) + actual club link
            # We want the last non-federation link in the cell
            club_name = None
            for i in range(name_idx + 1, len(cells)):
                # Find ALL title links in this cell
                all_links = re.findall(r'title="([^"]+)"', cells[i])
                # Filter out federation/association, nation, flag, date links
                skip_re = re.compile(
                    r'(football team|national|federation|association|FIFA|Category|\d{4}|flag of)',
                    re.IGNORECASE
                )
                club_candidates = [t for t in all_links if not skip_re.search(t)]
                if club_candidates:
                    # Take the last candidate (usually the actual club, after flag icons)
                    club_candidate = club_candidates[-1]
                    club_candidate = re.sub(r'\s*F\.?C\.?\s*$', ' FC', club_candidate).strip()
                    club_name = club_candidate
                    break

            norm = normalize_name(player_name)
            if norm in seen_names:
                continue
            seen_names.add(norm)

            position = normalize_position(pos_val)

            players.append({
                "name": player_name.strip(),
                "name_normalized": norm,
                "position": position or "CM",  # Fallback
                "position_raw": pos_val,
                "jersey_number": jersey,
                "caps": caps,
                "goals": goals,
                "dob": dob,
                "club_name": club_name,
            })

    # Strategy B: If we got very few from tables, try a broader regex on the full HTML
    if len(players) < 11:
        if VERBOSE:
            print(f"  [info] Only {len(players)} from tables, trying broader extraction...")

        # Look for player links in a "Current squad" or "Squad" section
        # Find section boundaries
        squad_section = None
        for header_pattern in [
            r'(?:Current squad|Squad|Players|Recent call-ups)',
        ]:
            match = re.search(
                rf'<span[^>]*id="[^"]*(?:Current_squad|Squad|Players|Recent_call-ups)[^"]*"[^>]*>.*?</span>(.*?)(?:<span[^>]*id="|$)',
                html_text, re.DOTALL | re.IGNORECASE
            )
            if match:
                squad_section = match.group(1)
                break

        if squad_section:
            # Find player links with position context
            entries = re.findall(
                r'(GK|DF|MF|FW)\s*</td>\s*<td[^>]*>.*?title="([^"]+)"',
                squad_section, re.DOTALL | re.IGNORECASE
            )
            for pos_raw, player_title in entries:
                player_name = re.sub(r'\s*\(footballer[^)]*\)', '', player_title)
                player_name = re.sub(r'\s*\(soccer[^)]*\)', '', player_name)
                player_name = re.sub(r'\s*\(born \d{4}\)', '', player_name)
                norm = normalize_name(player_name)
                if norm in seen_names or len(player_name) < 2:
                    continue
                seen_names.add(norm)
                position = normalize_position(pos_raw.strip())
                players.append({
                    "name": player_name.strip(),
                    "name_normalized": norm,
                    "position": position or "CM",
                    "position_raw": pos_raw.strip().upper(),
                    "jersey_number": None,
                    "caps": None,
                    "goals": None,
                    "dob": None,
                    "club_name": None,
                })

    return players


# ── Database matching ────────────────────────────────────────────────────────

def match_player_to_db(cur, player: dict, nation_id: int) -> Optional[int]:
    """Try to match a Wikipedia player to an existing people record.

    Matching tiers:
    1. Exact normalized name + same nation
    2. Exact normalized name + any nation (dual nationality)
    3. Partial name match (last name) + same nation + same position
    """
    norm = player["name_normalized"]

    # Tier 1: Exact name + nation
    cur.execute("""
        SELECT p.id, p.name FROM people p
        WHERE lower(regexp_replace(
            translate(p.name, 'àáâãäåæçèéêëìíîïðñòóôõöùúûüýÿ',
                              'aaaaaaaceeeeiiiidnooooouuuuyy'),
            '\\s+', ' ', 'g'
        )) = %s
        AND p.nation_id = %s
        AND p.active = true
        LIMIT 1
    """, (norm, nation_id))
    row = cur.fetchone()
    if row:
        return row[0]

    # Tier 1b: Check via player_nationalities (dual nationality)
    cur.execute("""
        SELECT p.id, p.name FROM people p
        JOIN player_nationalities pn ON pn.person_id = p.id
        WHERE lower(regexp_replace(
            translate(p.name, 'àáâãäåæçèéêëìíîïðñòóôõöùúûüýÿ',
                              'aaaaaaaceeeeiiiidnooooouuuuyy'),
            '\\s+', ' ', 'g'
        )) = %s
        AND pn.nation_id = %s
        AND p.active = true
        LIMIT 1
    """, (norm, nation_id))
    row = cur.fetchone()
    if row:
        return row[0]

    # Tier 2: Try matching just last name + nation + position (for common name variants)
    parts = norm.split()
    if len(parts) >= 2:
        last_name = parts[-1]
        if len(last_name) > 3:  # Avoid matching on very short names
            cur.execute("""
                SELECT p.id, p.name FROM people p
                LEFT JOIN player_profiles pp ON pp.person_id = p.id
                WHERE lower(regexp_replace(
                    translate(p.name, 'àáâãäåæçèéêëìíîïðñòóôõöùúûüýÿ',
                                      'aaaaaaaceeeeiiiidnooooouuuuyy'),
                    '\\s+', ' ', 'g'
                )) LIKE %s
                AND p.nation_id = %s
                AND p.active = true
                AND (pp.position IS NULL OR pp.position = %s)
                LIMIT 1
            """, (f"%{last_name}", nation_id, player["position"]))
            row = cur.fetchone()
            if row:
                return row[0]

    return None


def insert_player(cur, player: dict, nation_id: int) -> Optional[int]:
    """Insert a new player from Wikipedia squad data."""
    # people.id has no auto-increment — generate next ID manually
    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM people")
    next_id = cur.fetchone()[0]
    cur.execute("""
        INSERT INTO people (id, name, nation_id, date_of_birth, active)
        VALUES (%s, %s, %s, %s, true)
        RETURNING id
    """, (next_id, player["name"], nation_id, player.get("dob")))
    row = cur.fetchone()
    if not row:
        return None
    person_id = row[0]

    # Insert profile with position
    if player.get("position"):
        cur.execute("""
            INSERT INTO player_profiles (person_id, position)
            VALUES (%s, %s)
            ON CONFLICT (person_id) DO NOTHING
        """, (person_id, player["position"]))

    return person_id


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not POSTGRES_DSN:
        print("ERROR: POSTGRES_DSN not set. Check .env.local")
        sys.exit(1)

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    # Load WC nations
    cur.execute("""
        SELECT wn.slug, n.id as nation_id, n.name,
               wn.confederation, wn.fifa_ranking
        FROM wc_nations wn
        JOIN nations n ON n.id = wn.nation_id
        ORDER BY wn.fifa_ranking
    """)
    wc_nations = cur.fetchall()

    if not wc_nations:
        print("ERROR: No WC nations found. Run pipeline/83_seed_wc_nations.py first")
        sys.exit(1)

    # Get current player counts
    nation_counts: dict[str, int] = {}
    for slug, nation_id, name, conf, rank in wc_nations:
        cur.execute("""
            SELECT COUNT(DISTINCT p.id) FROM people p
            WHERE (p.nation_id = %s OR EXISTS (
                SELECT 1 FROM player_nationalities pn
                WHERE pn.person_id = p.id AND pn.nation_id = %s
            )) AND p.active = true
        """, (nation_id, nation_id))
        nation_counts[slug] = cur.fetchone()[0]

    # Filter nations to process
    nations_to_process = []
    for slug, nation_id, name, conf, rank in wc_nations:
        if args.nation and slug != args.nation:
            continue
        if args.thin_only and nation_counts.get(slug, 0) >= 26:
            continue
        nations_to_process.append((slug, nation_id, name, conf, rank))

    # List mode: just show coverage
    if args.list:
        print("\n── WC 2026 Nation Coverage ──")
        thin = 0
        low = 0
        ok = 0
        for slug, nation_id, name, conf, rank in wc_nations:
            count = nation_counts.get(slug, 0)
            if count < 11:
                status = "✗ THIN"
                thin += 1
            elif count < 26:
                status = "⚠ LOW "
                low += 1
            else:
                status = "✓ OK  "
                ok += 1
            bar = "█" * min(count // 2, 20)
            print(f"  {status} {name:25s} {count:4d} {bar}")
        print(f"\nSummary: {ok} OK, {low} low, {thin} thin (unplayable)")
        print(f"Playable: {ok + low}/48 | Target: 48/48")
        cur.close()
        conn.close()
        return

    print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}Processing {len(nations_to_process)} nations...")
    print()

    total_matched = 0
    total_inserted = 0
    total_fetched = 0
    nation_results = []

    for slug, nation_id, name, conf, rank in nations_to_process:
        article = WIKI_ARTICLES.get(slug)
        if not article:
            print(f"  ⚠ {name}: No Wikipedia article mapped")
            continue

        count_before = nation_counts.get(slug, 0)
        print(f"  {'─' * 50}")
        print(f"  {name} ({conf}) — currently {count_before} players")
        print(f"  Fetching: {article}")

        html_text = fetch_wiki_html(article)
        if not html_text:
            print(f"  ✗ Failed to fetch Wikipedia page")
            continue

        squad = parse_squad_from_html(html_text, slug)
        total_fetched += len(squad)

        if not squad:
            print(f"  ⚠ No squad data parsed from Wikipedia")
            continue

        print(f"  Found {len(squad)} players in squad")
        if VERBOSE:
            for p in squad:
                print(f"    {p['position_raw']:3s} {p['jersey_number'] or '-':>3} {p['name']:30s} "
                      f"caps={p['caps'] or '?':>4} club={p['club_name'] or '?'}")

        matched = 0
        inserted = 0
        skipped = 0

        for player in squad:
            # Try to match existing
            person_id = match_player_to_db(cur, player, nation_id)

            if person_id:
                matched += 1
                if VERBOSE:
                    print(f"    ✓ Matched: {player['name']} → id={person_id}")
            else:
                # Insert new player
                if DRY_RUN:
                    inserted += 1
                    print(f"    + [DRY-RUN] Would insert: {player['name']} ({player['position']})")
                else:
                    person_id = insert_player(cur, player, nation_id)
                    if person_id:
                        inserted += 1
                        if VERBOSE:
                            print(f"    + Inserted: {player['name']} → id={person_id}")
                    else:
                        skipped += 1

        total_matched += matched
        total_inserted += inserted
        count_after = count_before + inserted
        status = "✓" if count_after >= 26 else "⚠" if count_after >= 11 else "✗"

        print(f"  Result: {matched} matched, {inserted} new, {skipped} skipped → {count_after} total {status}")
        nation_results.append((name, count_before, count_after, matched, inserted))

    # Commit
    if not DRY_RUN and total_inserted > 0:
        conn.commit()
        print(f"\n✓ Committed {total_inserted} new players")
    elif DRY_RUN:
        conn.rollback()

    # Summary
    print(f"\n{'═' * 55}")
    print(f"{'[DRY-RUN] ' if DRY_RUN else ''}SUMMARY")
    print(f"  Nations processed: {len(nation_results)}")
    print(f"  Players found on Wikipedia: {total_fetched}")
    print(f"  Matched to existing DB: {total_matched}")
    print(f"  New players inserted: {total_inserted}")
    print()

    if nation_results:
        print("  Nation results:")
        for name, before, after, matched, inserted in nation_results:
            delta = f"+{inserted}" if inserted > 0 else "—"
            status = "✓" if after >= 26 else "⚠" if after >= 11 else "✗"
            print(f"    {status} {name:25s} {before:4d} → {after:4d} ({delta})")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
