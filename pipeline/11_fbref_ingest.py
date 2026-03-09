"""
11_fbref_ingest.py — Scrape player season stats from FBRef and push to Supabase.

FBRef enforces strict rate limits. This script respects them:
  - 4 seconds between page requests (FBRef blocks at ~3s)
  - Incremental: tracks synced comp/season/stat_type in fbref_sync_log
  - First run fetches everything; subsequent runs skip already-synced pages

Usage:
    python 11_fbref_ingest.py                           # all priority comps, current season
    python 11_fbref_ingest.py --season 2023-2024        # specific season
    python 11_fbref_ingest.py --comp 9                  # EPL only
    python 11_fbref_ingest.py --force                   # re-scrape even if already synced
    python 11_fbref_ingest.py --dry-run                 # preview without writing
    python 11_fbref_ingest.py --seasons-back 3          # current + 2 previous seasons
"""
import argparse
import re
import sys
import time
import html as html_module
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import execute_values

from config import POSTGRES_DSN

# ── CLI ───────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Scrape FBRef player stats into Supabase")
parser.add_argument("--comp", type=int, default=None, help="Single competition ID")
parser.add_argument("--season", default=None, help="Season string, e.g. '2023-2024'")
parser.add_argument("--seasons-back", type=int, default=1,
                    help="Number of seasons to fetch (default: 1 = current only)")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Re-scrape already-synced data")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

# ── Rate limiting ─────────────────────────────────────────────────────────────

REQUEST_DELAY = 4.0  # seconds between HTTP requests — FBRef blocks below ~3s
_last_request_time = 0.0

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
})


def _fetch(url: str) -> BeautifulSoup | None:
    """Fetch a URL with rate limiting. Returns parsed HTML or None on failure."""
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < REQUEST_DELAY:
        time.sleep(REQUEST_DELAY - elapsed)

    try:
        resp = SESSION.get(url, timeout=30)
        _last_request_time = time.time()
        if resp.status_code == 429:
            print(f"  RATE LIMITED — sleeping 60s")
            time.sleep(60)
            return _fetch(url)  # retry once
        if resp.status_code != 200:
            print(f"  HTTP {resp.status_code} for {url}")
            return None
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        print(f"  WARN: fetch failed for {url}: {e}")
        return None


# ── Competition registry ──────────────────────────────────────────────────────

COMPETITIONS = {
    # Top 5 European leagues
    9:   {"name": "Premier-League",       "type": "league"},
    12:  {"name": "La-Liga",              "type": "league"},
    20:  {"name": "Bundesliga",           "type": "league"},
    11:  {"name": "Serie-A",              "type": "league"},
    13:  {"name": "Ligue-1",              "type": "league"},
    # Continental
    8:   {"name": "Champions-League",     "type": "cup"},
    19:  {"name": "Europa-League",        "type": "cup"},
    882: {"name": "Europa-Conference-League", "type": "cup"},
    # International
    1:   {"name": "World-Cup",            "type": "intl"},
    676: {"name": "European-Championship", "type": "intl"},
    # Youth
    531: {"name": "UEFA-U21-Championship", "type": "intl"},
}

# Stat pages to scrape per competition
STAT_PAGES = {
    "standard": "stats",
    "shooting": "shooting",
    "passing":  "passing",
    "defense":  "defense",
    "possession": "possession",
    "keepers":  "keepers",
}

# ── Season computation ────────────────────────────────────────────────────────

def current_season() -> str:
    """Return current season string, e.g. '2024-2025'."""
    now = datetime.now()
    year = now.year if now.month >= 8 else now.year - 1
    return f"{year}-{year + 1}"


def season_range(n_back: int, explicit: str | None) -> list[str]:
    """Generate list of season strings to scrape."""
    if explicit:
        return [explicit]
    cur = current_season()
    start_year = int(cur.split("-")[0])
    return [f"{start_year - i}-{start_year - i + 1}" for i in range(n_back)]


# ── URL builders ──────────────────────────────────────────────────────────────

def stats_url(comp_id: int, season: str, stat_type: str) -> str:
    """Build FBRef stats page URL."""
    comp = COMPETITIONS[comp_id]
    comp_name = comp["name"]
    stat_page = STAT_PAGES[stat_type]
    # FBRef URL pattern: /en/comps/{id}/{season}/{stat_page}/{season}-{comp_name}-Stats
    return (f"https://fbref.com/en/comps/{comp_id}/{season}/{stat_page}/"
            f"{season}-{comp_name}-Stats")


# ── HTML parsing ──────────────────────────────────────────────────────────────

def _safe_int(val: str | None) -> int | None:
    if not val or val.strip() == "":
        return None
    try:
        return int(val.replace(",", ""))
    except (ValueError, TypeError):
        return None


def _safe_float(val: str | None) -> float | None:
    if not val or val.strip() == "":
        return None
    try:
        f = float(val.replace(",", ""))
        return f if f == f else None  # NaN check
    except (ValueError, TypeError):
        return None


def _extract_fbref_id(href: str) -> str | None:
    """Extract player ID from FBRef URL like /en/players/abc123/Name."""
    m = re.search(r"/players/([a-f0-9]+)/", href)
    return m.group(1) if m else None


def parse_stats_table(soup: BeautifulSoup, stat_type: str) -> list[dict]:
    """
    Parse the main stats table from a FBRef page.
    FBRef wraps some tables in HTML comments — we handle that.
    """
    # FBRef hides some tables inside HTML comments to reduce page weight
    # Look for the standard table first, then check comments
    table = None

    # Map stat_type to expected table ID
    table_ids = {
        "standard": "stats_standard",
        "shooting": "stats_shooting",
        "passing":  "stats_passing",
        "defense":  "stats_defense",
        "possession": "stats_possession",
        "keepers":  "stats_keeper",
    }

    target_id = table_ids.get(stat_type, f"stats_{stat_type}")

    # Try direct table lookup
    table = soup.find("table", {"id": target_id})

    # If not found, search inside HTML comments
    if table is None:
        for comment in soup.find_all(string=lambda t: isinstance(t, type(soup.new_string("")))
                                     and t.__class__.__name__ == "Comment"):
            if target_id in str(comment):
                comment_soup = BeautifulSoup(str(comment), "lxml")
                table = comment_soup.find("table", {"id": target_id})
                if table:
                    break

    # Fallback: try any table with "stats" in ID
    if table is None:
        for t in soup.find_all("table"):
            tid = t.get("id", "")
            if "stats" in tid and stat_type.replace("standard", "standard") in tid:
                table = t
                break

    if table is None:
        return []

    # Parse header to get column mapping
    thead = table.find("thead")
    if not thead:
        return []

    # Get the last header row (the one with actual column names)
    header_rows = thead.find_all("tr")
    header_row = header_rows[-1] if header_rows else None
    if not header_row:
        return []

    headers = []
    for th in header_row.find_all("th"):
        stat = th.get("data-stat", th.get_text(strip=True))
        headers.append(stat)

    # Parse body rows
    tbody = table.find("tbody")
    if not tbody:
        return []

    rows = []
    for tr in tbody.find_all("tr"):
        # Skip separator/header rows
        if "thead" in tr.get("class", []) or tr.find("th", {"colspan": True}):
            continue

        cells = tr.find_all(["th", "td"])
        if len(cells) < 5:
            continue

        row = {}
        for i, cell in enumerate(cells):
            if i < len(headers):
                stat_name = headers[i]
            else:
                stat_name = cell.get("data-stat", f"col_{i}")

            # Extract player link for ID
            if stat_name == "player":
                link = cell.find("a")
                if link and link.get("href"):
                    row["_fbref_id"] = _extract_fbref_id(link["href"])
                    row["_fbref_url"] = link["href"]

            row[stat_name] = cell.get_text(strip=True)

        if row.get("player") and row.get("_fbref_id"):
            rows.append(row)

    return rows


# ── Data extraction per stat type ─────────────────────────────────────────────

def extract_standard(row: dict) -> dict:
    """Extract standard stats fields."""
    return {
        "age": row.get("age"),
        "minutes": _safe_int(row.get("minutes")),
        "matches_played": _safe_int(row.get("games")),
        "starts": _safe_int(row.get("games_starts")),
        "goals": _safe_int(row.get("goals")),
        "assists": _safe_int(row.get("assists")),
        "penalties_made": _safe_int(row.get("pens_made")),
        "penalties_att": _safe_int(row.get("pens_att")),
        "yellow_cards": _safe_int(row.get("cards_yellow")),
        "red_cards": _safe_int(row.get("cards_red")),
        "xg": _safe_float(row.get("xg")),
        "npxg": _safe_float(row.get("npxg")),
        "xag": _safe_float(row.get("xg_assist")),
        # Player identity
        "team": row.get("team"),
        "nation": row.get("nationality"),
        "position": row.get("position"),
    }


def extract_shooting(row: dict) -> dict:
    return {
        "shots": _safe_int(row.get("shots")),
        "shots_on_target": _safe_int(row.get("shots_on_target")),
        "xg": _safe_float(row.get("xg")),
        "npxg": _safe_float(row.get("npxg")),
    }


def extract_passing(row: dict) -> dict:
    return {
        "passes_completed": _safe_int(row.get("passes_completed")),
        "passes_attempted": _safe_int(row.get("passes")),
        "pass_pct": _safe_float(row.get("passes_pct")),
        "progressive_passes": _safe_int(row.get("progressive_passes")),
        "key_passes": _safe_int(row.get("assisted_shots")),
    }


def extract_defense(row: dict) -> dict:
    return {
        "tackles": _safe_int(row.get("tackles")),
        "tackles_won": _safe_int(row.get("tackles_won")),
        "interceptions": _safe_int(row.get("interceptions")),
        "blocks": _safe_int(row.get("blocks")),
        "clearances": _safe_int(row.get("clearances")),
    }


def extract_possession(row: dict) -> dict:
    return {
        "touches": _safe_int(row.get("touches")),
        "carries": _safe_int(row.get("carries")),
        "progressive_carries": _safe_int(row.get("progressive_carries")),
        "successful_dribbles": _safe_int(row.get("dribbles_completed")),
        "dribbles_attempted": _safe_int(row.get("dribbles")),
    }


def extract_keepers(row: dict) -> dict:
    return {
        "gk_saves": _safe_int(row.get("gk_saves")),
        "gk_save_pct": _safe_float(row.get("gk_save_pct")),
        "gk_clean_sheets": _safe_int(row.get("gk_clean_sheets")),
        "gk_goals_against": _safe_int(row.get("gk_goals_against")),
        "gk_psxg": _safe_float(row.get("gk_psxg")),
    }


EXTRACTORS = {
    "standard": extract_standard,
    "shooting": extract_shooting,
    "passing":  extract_passing,
    "defense":  extract_defense,
    "possession": extract_possession,
    "keepers":  extract_keepers,
}

# ── DB connection ─────────────────────────────────────────────────────────────

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Sync log helpers ──────────────────────────────────────────────────────────

def is_synced(comp_id: int, season: str, stat_type: str) -> bool:
    if FORCE:
        return False
    cur.execute("""
        SELECT 1 FROM fbref_sync_log
        WHERE comp_id = %s AND season = %s AND stat_type = %s
    """, (comp_id, season, stat_type))
    return cur.fetchone() is not None


def mark_synced(comp_id: int, season: str, stat_type: str, rows_fetched: int):
    if DRY_RUN:
        return
    cur.execute("""
        INSERT INTO fbref_sync_log (comp_id, season, stat_type, rows_fetched)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (comp_id, season, stat_type)
        DO UPDATE SET rows_fetched = EXCLUDED.rows_fetched, synced_at = now()
    """, (comp_id, season, stat_type, rows_fetched))


# ── Main scraping loop ────────────────────────────────────────────────────────

comps_to_scrape = {args.comp: COMPETITIONS[args.comp]} if args.comp else COMPETITIONS
seasons = season_range(args.seasons_back, args.season)

print(f"FBRef Ingest — {len(comps_to_scrape)} competitions × {len(seasons)} seasons")
print(f"  Rate limit: {REQUEST_DELAY}s between requests")
if DRY_RUN:
    print("  (dry-run mode)")
print()

total_players_upserted = 0
total_stats_upserted = 0

for comp_id, comp_info in comps_to_scrape.items():
    comp_name = comp_info["name"]

    for season in seasons:
        print(f"── {comp_name} {season} ──")

        # Accumulate stats per player across stat pages
        player_stats = {}  # fbref_id → merged dict

        for stat_type in STAT_PAGES:
            if is_synced(comp_id, season, stat_type):
                print(f"  {stat_type}: already synced (skip)")
                continue

            url = stats_url(comp_id, season, stat_type)
            print(f"  {stat_type}: {url}")

            soup = _fetch(url)
            if soup is None:
                print(f"    SKIP — failed to fetch")
                continue

            rows = parse_stats_table(soup, stat_type)
            print(f"    parsed {len(rows)} player rows")

            if not rows:
                # Page might not exist for this comp/season combo
                mark_synced(comp_id, season, stat_type, 0)
                continue

            extractor = EXTRACTORS[stat_type]

            for row in rows:
                fbref_id = row.get("_fbref_id")
                if not fbref_id:
                    continue

                # Initialize player entry if new
                if fbref_id not in player_stats:
                    player_stats[fbref_id] = {
                        "fbref_id": fbref_id,
                        "name": row.get("player", ""),
                        "fbref_url": row.get("_fbref_url", ""),
                        "nation": row.get("nationality"),
                        "position": row.get("position"),
                        "team": row.get("team"),
                    }

                # Merge extracted stats
                extracted = extractor(row)
                player_stats[fbref_id].update(
                    {k: v for k, v in extracted.items() if v is not None}
                )

            mark_synced(comp_id, season, stat_type, len(rows))

        # ── Upsert players and stats ──────────────────────────────────────

        if not player_stats:
            print(f"  No players found for {comp_name} {season}")
            continue

        print(f"  Upserting {len(player_stats)} players...")

        if DRY_RUN:
            print(f"  [dry-run] would upsert {len(player_stats)} fbref_players")
            print(f"  [dry-run] would upsert {len(player_stats)} fbref_player_season_stats")
            total_players_upserted += len(player_stats)
            total_stats_upserted += len(player_stats)
            continue

        # Upsert fbref_players
        player_values = [
            (p["fbref_id"], p["name"], p.get("nation"), p.get("position"),
             f"https://fbref.com{p['fbref_url']}" if p.get("fbref_url") else None)
            for p in player_stats.values()
        ]
        execute_values(cur, """
            INSERT INTO fbref_players (fbref_id, name, nation, position, fbref_url)
            VALUES %s
            ON CONFLICT (fbref_id) DO UPDATE SET
                name = EXCLUDED.name,
                nation = COALESCE(EXCLUDED.nation, fbref_players.nation),
                position = COALESCE(EXCLUDED.position, fbref_players.position),
                fbref_url = COALESCE(EXCLUDED.fbref_url, fbref_players.fbref_url),
                updated_at = now()
        """, player_values)
        total_players_upserted += len(player_values)

        # Upsert stats
        stat_values = []
        for p in player_stats.values():
            stat_values.append((
                p["fbref_id"], comp_id, comp_name, season,
                p.get("team"), p.get("age"),
                p.get("minutes"), p.get("matches_played"), p.get("starts"),
                p.get("goals"), p.get("assists"),
                p.get("penalties_made"), p.get("penalties_att"),
                p.get("yellow_cards"), p.get("red_cards"),
                p.get("shots"), p.get("shots_on_target"),
                p.get("xg"), p.get("npxg"), p.get("xag"),
                p.get("passes_completed"), p.get("passes_attempted"),
                p.get("pass_pct"), p.get("progressive_passes"), p.get("key_passes"),
                p.get("tackles"), p.get("tackles_won"),
                p.get("interceptions"), p.get("blocks"), p.get("clearances"),
                p.get("touches"), p.get("carries"),
                p.get("progressive_carries"), p.get("successful_dribbles"),
                p.get("dribbles_attempted"),
                p.get("gk_saves"), p.get("gk_save_pct"),
                p.get("gk_clean_sheets"), p.get("gk_goals_against"), p.get("gk_psxg"),
            ))

        execute_values(cur, """
            INSERT INTO fbref_player_season_stats (
                fbref_id, comp_id, comp_name, season,
                team, age,
                minutes, matches_played, starts,
                goals, assists,
                penalties_made, penalties_att,
                yellow_cards, red_cards,
                shots, shots_on_target,
                xg, npxg, xag,
                passes_completed, passes_attempted,
                pass_pct, progressive_passes, key_passes,
                tackles, tackles_won,
                interceptions, blocks, clearances,
                touches, carries,
                progressive_carries, successful_dribbles,
                dribbles_attempted,
                gk_saves, gk_save_pct,
                gk_clean_sheets, gk_goals_against, gk_psxg
            )
            VALUES %s
            ON CONFLICT (fbref_id, comp_id, season)
            DO UPDATE SET
                team = EXCLUDED.team,
                minutes = COALESCE(EXCLUDED.minutes, fbref_player_season_stats.minutes),
                matches_played = COALESCE(EXCLUDED.matches_played, fbref_player_season_stats.matches_played),
                starts = COALESCE(EXCLUDED.starts, fbref_player_season_stats.starts),
                goals = COALESCE(EXCLUDED.goals, fbref_player_season_stats.goals),
                assists = COALESCE(EXCLUDED.assists, fbref_player_season_stats.assists),
                xg = COALESCE(EXCLUDED.xg, fbref_player_season_stats.xg),
                npxg = COALESCE(EXCLUDED.npxg, fbref_player_season_stats.npxg),
                xag = COALESCE(EXCLUDED.xag, fbref_player_season_stats.xag),
                shots = COALESCE(EXCLUDED.shots, fbref_player_season_stats.shots),
                shots_on_target = COALESCE(EXCLUDED.shots_on_target, fbref_player_season_stats.shots_on_target),
                passes_completed = COALESCE(EXCLUDED.passes_completed, fbref_player_season_stats.passes_completed),
                passes_attempted = COALESCE(EXCLUDED.passes_attempted, fbref_player_season_stats.passes_attempted),
                pass_pct = COALESCE(EXCLUDED.pass_pct, fbref_player_season_stats.pass_pct),
                progressive_passes = COALESCE(EXCLUDED.progressive_passes, fbref_player_season_stats.progressive_passes),
                key_passes = COALESCE(EXCLUDED.key_passes, fbref_player_season_stats.key_passes),
                tackles = COALESCE(EXCLUDED.tackles, fbref_player_season_stats.tackles),
                tackles_won = COALESCE(EXCLUDED.tackles_won, fbref_player_season_stats.tackles_won),
                interceptions = COALESCE(EXCLUDED.interceptions, fbref_player_season_stats.interceptions),
                blocks = COALESCE(EXCLUDED.blocks, fbref_player_season_stats.blocks),
                clearances = COALESCE(EXCLUDED.clearances, fbref_player_season_stats.clearances),
                touches = COALESCE(EXCLUDED.touches, fbref_player_season_stats.touches),
                carries = COALESCE(EXCLUDED.carries, fbref_player_season_stats.carries),
                progressive_carries = COALESCE(EXCLUDED.progressive_carries, fbref_player_season_stats.progressive_carries),
                successful_dribbles = COALESCE(EXCLUDED.successful_dribbles, fbref_player_season_stats.successful_dribbles),
                dribbles_attempted = COALESCE(EXCLUDED.dribbles_attempted, fbref_player_season_stats.dribbles_attempted),
                gk_saves = COALESCE(EXCLUDED.gk_saves, fbref_player_season_stats.gk_saves),
                gk_save_pct = COALESCE(EXCLUDED.gk_save_pct, fbref_player_season_stats.gk_save_pct),
                gk_clean_sheets = COALESCE(EXCLUDED.gk_clean_sheets, fbref_player_season_stats.gk_clean_sheets),
                gk_goals_against = COALESCE(EXCLUDED.gk_goals_against, fbref_player_season_stats.gk_goals_against),
                gk_psxg = COALESCE(EXCLUDED.gk_psxg, fbref_player_season_stats.gk_psxg),
                synced_at = now()
        """, stat_values)
        total_stats_upserted += len(stat_values)

        print(f"  ✓ {len(player_stats)} players + stats upserted")

# ── Summary ───────────────────────────────────────────────────────────────────

print(f"\nDone.")
print(f"  Players upserted     : {total_players_upserted}")
print(f"  Season stats upserted: {total_stats_upserted}")
if DRY_RUN:
    print("  (dry-run — no data was written)")

cur.close()
conn.close()
