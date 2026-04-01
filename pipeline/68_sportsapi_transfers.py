"""
68_sportsapi_transfers.py — Fetch transfer history from SportsAPIPro.

Ingests structured transfer records with actual fees (EUR), dates, and
club names. Writes to the existing `transfers` table with source='sportsapi'.

Requires player links from 67_sportsapi_attributes.py (player_id_links).

Usage:
    python 68_sportsapi_transfers.py                    # all linked players
    python 68_sportsapi_transfers.py --player "Osimhen" # single player
    python 68_sportsapi_transfers.py --limit 50         # first 50 linked players
    python 68_sportsapi_transfers.py --dry-run           # preview without writing
    python 68_sportsapi_transfers.py --force             # overwrite existing sportsapi transfers
"""

import argparse
import os
import sys
import time
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.dirname(__file__))
from config import SPORTSAPI_PRO_KEY

API_BASE = "https://v2.football.sportsapipro.com"
SOURCE = "sportsapi"
REQUEST_DELAY = 1.0

# SportsAPIPro transfer type codes
TRANSFER_TYPES = {
    1: "loan",
    2: "loan",        # loan return — we store as loan with reversed clubs
    3: "permanent",
}

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Ingest SportsAPIPro transfer history")
parser.add_argument("--player", type=str, default=None, help="Single player name search")
parser.add_argument("--limit", type=int, default=None, help="Max players to process")
parser.add_argument("--dry-run", action="store_true", help="Preview counts, no writes")
parser.add_argument("--force", action="store_true", help="Overwrite existing sportsapi transfers")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

# ── API helpers ──────────────────────────────────────────────────────────────

request_count = 0
rate_limited = False


def api_get(path: str) -> dict | None:
    global request_count, rate_limited
    if rate_limited:
        return None

    headers = {"x-api-key": SPORTSAPI_PRO_KEY}
    url = f"{API_BASE}{path}"
    resp = requests.get(url, headers=headers, timeout=30)

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


def parse_transfer(raw: dict, person_id: int, player_name: str) -> dict | None:
    """Parse a SportsAPIPro transfer record into our transfers schema."""
    transfer_type = raw.get("type")
    fee_raw = raw.get("transferFeeRaw", {})
    fee_value = fee_raw.get("value", 0)
    timestamp = raw.get("transferDateTimestamp")

    if not timestamp:
        return None

    from_team = raw.get("fromTeamName", "")
    to_team = raw.get("toTeamName", "")

    if not from_team or not to_team:
        return None

    # Skip loan returns (type 2) — these are just bookkeeping
    if transfer_type == 2:
        return None

    transfer_date = datetime.fromtimestamp(timestamp, tz=timezone.utc).date()

    # Determine fee type
    if transfer_type == 1:
        fee_type = "loan"
    elif fee_value and fee_value > 0:
        fee_type = "permanent"
    else:
        fee_type = "free"

    # Fee in EUR millions (API returns raw EUR)
    fee_eur_m = round(fee_value / 1_000_000, 2) if fee_value and fee_value > 0 else (0 if fee_type == "free" else None)

    # Infer transfer window from date
    month = transfer_date.month
    year = transfer_date.year
    if 6 <= month <= 9:
        window = f"{year}_summer"
    elif month == 1 or month == 2:
        window = f"{year}_jan"
    else:
        window = None

    return {
        "player_name": player_name,
        "player_id": person_id,
        "from_club": from_team,
        "to_club": to_team,
        "fee_eur_m": fee_eur_m,
        "fee_type": fee_type,
        "transfer_date": transfer_date.isoformat(),
        "transfer_window": window,
        "source": SOURCE,
        "confidence": "medium",
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if not SPORTSAPI_PRO_KEY:
        print("ERROR: SPORTSAPI_PRO_KEY not set in .env.local")
        sys.exit(1)

    from lib.db import require_conn
    from psycopg2.extras import execute_values

    conn = require_conn()
    cur = conn.cursor()

    # Ensure migration applied
    sql_path = os.path.join(os.path.dirname(__file__), "sql", "051_sportsapi.sql")
    if os.path.exists(sql_path):
        with open(sql_path) as f:
            cur.execute(f.read())
        conn.commit()

    # Load linked players
    if args.player:
        cur.execute("""
            SELECT l.person_id, l.external_id, p.name
            FROM player_id_links l
            JOIN people p ON p.id = l.person_id
            WHERE l.source = %s AND p.name ILIKE %s
        """, (SOURCE, f"%{args.player}%"))
    else:
        # Linked players without existing sportsapi transfers
        cur.execute("""
            SELECT l.person_id, l.external_id, p.name
            FROM player_id_links l
            JOIN people p ON p.id = l.person_id
            LEFT JOIN transfers t ON t.player_id = l.person_id AND t.source = %s
            WHERE l.source = %s AND t.id IS NULL
            ORDER BY p.name
        """, (SOURCE, SOURCE))

    linked_players = cur.fetchall()
    print(f"SportsAPIPro linked players: {len(linked_players)}")

    if not linked_players:
        print("No linked players found. Run 67_sportsapi_attributes.py first.")
        conn.close()
        return

    if args.limit:
        linked_players = linked_players[:args.limit]
        print(f"  Limited to {args.limit}")

    # Optionally clear existing sportsapi transfers
    if FORCE and not DRY_RUN:
        cur.execute("DELETE FROM transfers WHERE source = %s", (SOURCE,))
        deleted = cur.rowcount
        conn.commit()
        print(f"  Cleared {deleted} existing sportsapi transfers")

    # Load existing sportsapi transfers to avoid re-fetching
    cur.execute("""
        SELECT player_id, transfer_date, to_club FROM transfers
        WHERE source = %s AND player_id IS NOT NULL
    """, (SOURCE,))
    existing = {(r[0], str(r[1]), r[2]) for r in cur.fetchall()}

    # Load higher-priority transfers to avoid overwriting
    cur.execute("""
        SELECT player_id, transfer_date, to_club FROM transfers
        WHERE source IN ('seed', 'manual') AND player_id IS NOT NULL
    """)
    protected = {(r[0], str(r[1]), r[2]) for r in cur.fetchall()}

    total_inserted = 0
    total_skipped = 0

    print(f"\nFetching transfer history...")

    for i, (person_id, sportsapi_id, player_name) in enumerate(linked_players):
        if rate_limited:
            break
        data = api_get(f"/api/players/{sportsapi_id}/transfer-history")
        if data is None:
            break  # rate limit hit

        history = data.get("transferHistory", [])
        rows = []
        for raw in history:
            parsed = parse_transfer(raw, person_id, player_name)
            if not parsed:
                continue

            key = (person_id, parsed["transfer_date"], parsed["to_club"])

            # Skip if higher-priority source exists
            if key in protected:
                total_skipped += 1
                continue

            # Skip if already exists (unless forcing)
            if key in existing and not FORCE:
                total_skipped += 1
                continue

            rows.append(parsed)

        if rows and not DRY_RUN:
            values = [(r["player_name"], r["player_id"], r["from_club"], r["to_club"],
                       r["fee_eur_m"], r["fee_type"], r["transfer_date"], r["transfer_window"],
                       r["source"], r["confidence"])
                      for r in rows]
            execute_values(cur, """
                INSERT INTO transfers
                    (player_name, player_id, from_club, to_club, fee_eur_m, fee_type,
                     transfer_date, transfer_window, source, confidence)
                VALUES %s
                ON CONFLICT (player_id, transfer_date, to_club) WHERE player_id IS NOT NULL
                DO UPDATE SET
                    fee_eur_m = EXCLUDED.fee_eur_m,
                    fee_type = EXCLUDED.fee_type,
                    from_club = EXCLUDED.from_club,
                    transfer_window = EXCLUDED.transfer_window,
                    source = EXCLUDED.source
                WHERE transfers.source = 'sportsapi'
            """, values)
            total_inserted += len(rows)

        if (i + 1) % 25 == 0:
            if not DRY_RUN:
                conn.commit()
            print(f"  {i + 1}/{len(linked_players)} — {total_inserted} transfers")

    if not DRY_RUN:
        conn.commit()

    print(f"\n{'=' * 50}")
    print(f"Transfers: {total_inserted} {'(dry-run)' if DRY_RUN else 'written'}, {total_skipped} skipped")
    print(f"API calls used: {request_count}")
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
