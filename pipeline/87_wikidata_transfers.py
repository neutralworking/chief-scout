"""
87_wikidata_transfers.py — Fetch transfer fee data (P1536) from Wikidata.

Pulls transfer fees for players who have wikidata_id set, using the
P1536 (transfer fee) property with date (P580) and team (P54) qualifiers.

Each P1536 statement becomes a separate row in the `transfers` table.
Uses player_career_history to resolve from_club / to_club around the
transfer date.

Usage:
    python 87_wikidata_transfers.py --dry-run --limit 50   # preview first
    python 87_wikidata_transfers.py                         # full run
    python 87_wikidata_transfers.py --player 42             # single player
    python 87_wikidata_transfers.py --force                 # overwrite wikidata rows
"""
import argparse
import sys
import time
from datetime import datetime, date

import requests
import psycopg2

from config import POSTGRES_DSN

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Wikidata transfer fee ingestion (P1536)")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--force", action="store_true", help="Re-fetch even if wikidata rows exist")
parser.add_argument("--player", type=int, default=None, help="Single person_id")
parser.add_argument("--limit", type=int, default=None, help="Max players to process")
parser.add_argument("--batch-size", type=int, default=25, help="Players per SPARQL batch")
parser.add_argument("--verbose", action="store_true", help="Show detailed output")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
VERBOSE = args.verbose
BATCH_SIZE = args.batch_size

# ── DB connection ─────────────────────────────────────────────────────────────

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Wikidata setup ────────────────────────────────────────────────────────────

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = "ChiefScout/1.0 (football scouting tool; https://github.com/neutralworking/chief-scout)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})

# Currency conversion to EUR (approximate, for historical ballpark)
CURRENCY_RATES = {
    "Q4916": 1.0,       # EUR
    "Q25224": 1.17,      # GBP
    "Q4917": 0.92,       # USD
}

CURRENCY_NAMES = {
    "Q4916": "EUR",
    "Q25224": "GBP",
    "Q4917": "USD",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def to_qid(wikidata_id: str) -> str:
    """Extract QID from full URI or bare QID."""
    return wikidata_id.replace("http://www.wikidata.org/entity/", "").replace("https://www.wikidata.org/entity/", "")


def safe_date(date_str: str | None) -> str | None:
    """Validate and return a date string (YYYY-MM-DD), or None."""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        if dt.year < 1950 or dt > datetime.now():
            return None
        return date_str[:10]
    except (ValueError, TypeError):
        return None


def compute_age(dob_str: str | None, transfer_date_str: str) -> int | None:
    """Compute age at transfer date."""
    if not dob_str:
        return None
    try:
        dob = datetime.strptime(str(dob_str)[:10], "%Y-%m-%d").date()
        td = datetime.strptime(transfer_date_str[:10], "%Y-%m-%d").date()
        age = td.year - dob.year - ((td.month, td.day) < (dob.month, dob.day))
        if 14 <= age <= 45:
            return age
        return None
    except (ValueError, TypeError):
        return None


def derive_transfer_window(transfer_date_str: str) -> str:
    """Derive transfer window from month."""
    try:
        dt = datetime.strptime(transfer_date_str[:10], "%Y-%m-%d")
        month = dt.month
        if month in (1, 2):
            return "Winter"
        elif month in (6, 7, 8):
            return "Summer"
        else:
            return "Other"
    except (ValueError, TypeError):
        return "Other"


def sparql_query(query: str, retries: int = 2) -> list[dict]:
    """Execute a SPARQL query with retry on rate-limit."""
    for attempt in range(retries + 1):
        try:
            resp = SESSION.get(WIKIDATA_SPARQL, params={
                "query": query,
                "format": "json",
            }, timeout=45)
            if resp.status_code == 429:
                wait = 5 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json().get("results", {}).get("bindings", [])
        except Exception as e:
            if attempt < retries:
                print(f"  SPARQL error (retry {attempt+1}): {e}")
                time.sleep(3)
            else:
                print(f"  SPARQL failed: {e}")
                return []
    return []


# ── Load players to process ──────────────────────────────────────────────────

if args.player:
    cur.execute("""
        SELECT p.id, p.name, p.wikidata_id, p.date_of_birth,
               pp.position
        FROM people p
        LEFT JOIN player_profiles pp ON pp.person_id = p.id
        WHERE p.id = %s AND p.wikidata_id IS NOT NULL
    """, (args.player,))
else:
    cur.execute("""
        SELECT p.id, p.name, p.wikidata_id, p.date_of_birth,
               pp.position
        FROM people p
        LEFT JOIN player_profiles pp ON pp.person_id = p.id
        WHERE p.wikidata_id IS NOT NULL AND p.active = true
        ORDER BY p.id
    """)

players = cur.fetchall()
if args.limit:
    players = players[:args.limit]

print(f"Players to process: {len(players)}")

if not players:
    print("No players to process.")
    cur.close()
    conn.close()
    sys.exit(0)

# Build lookup by QID
player_lookup = {}  # qid -> {pid, name, dob, position}
for pid, pname, wikidata_id, dob, position in players:
    qid = to_qid(wikidata_id)
    if qid.startswith("Q"):
        player_lookup[qid] = {
            "pid": pid,
            "name": pname,
            "dob": dob,
            "position": position,
        }

# ── Load career history for from/to club resolution ─────────────────────────

print("Loading career history...")
cur.execute("""
    SELECT person_id, club_name, start_date, end_date, is_loan
    FROM player_career_history
    ORDER BY person_id, start_date NULLS LAST
""")
career_rows = cur.fetchall()

# career_by_pid: pid -> list of {club_name, start, end, is_loan} sorted by start
career_by_pid: dict[int, list[dict]] = {}
for pid, club_name, start_dt, end_dt, is_loan in career_rows:
    if pid not in career_by_pid:
        career_by_pid[pid] = []
    career_by_pid[pid].append({
        "club_name": club_name,
        "start": str(start_dt)[:10] if start_dt else None,
        "end": str(end_dt)[:10] if end_dt else None,
        "is_loan": is_loan,
    })

print(f"Loaded career history for {len(career_by_pid)} players")

# ── Load existing wikidata transfers (for conflict detection) ────────────────

cur.execute("""
    SELECT player_id, transfer_date, source
    FROM transfers
    WHERE source IN ('seed', 'kaggle', 'wikidata')
""")
existing_transfers = set()
existing_sources = {}  # (player_id, date_str) -> source
for pid, tdate, src in cur.fetchall():
    key = (pid, str(tdate)[:10] if tdate else None)
    existing_transfers.add(key)
    existing_sources[key] = src

print(f"Existing transfers (seed/kaggle/wikidata): {len(existing_transfers)}")


def resolve_clubs(pid: int, transfer_date_str: str, team_label: str | None) -> tuple[str, str]:
    """
    Resolve from_club and to_club using player_career_history.
    Returns (from_club, to_club).
    """
    career = career_by_pid.get(pid, [])
    if not career:
        return ("Unknown", team_label or "Unknown")

    td = transfer_date_str[:10]

    # Find the club the player was at BEFORE the transfer date
    # and the club they joined AFTER
    from_club = None
    to_club = None

    for entry in career:
        start = entry["start"]
        end = entry["end"]

        # Club that ended around transfer date = from_club
        if end and abs_days_diff(end, td) <= 60:
            from_club = entry["club_name"]
        # Club that started around transfer date = to_club
        if start and abs_days_diff(start, td) <= 60:
            to_club = entry["club_name"]

    # Fallback: find club active before and after transfer date
    if not from_club or not to_club:
        before = []
        after = []
        for entry in career:
            start = entry["start"]
            end = entry["end"]
            if start and start <= td:
                before.append(entry)
            if start and start >= td:
                after.append(entry)

        if not from_club and before:
            from_club = before[-1]["club_name"]  # most recent before
        if not to_club and after:
            to_club = after[0]["club_name"]  # earliest after

    # Final fallback: use team qualifier
    if not from_club:
        from_club = "Unknown"
    if not to_club:
        to_club = team_label or "Unknown"

    return (from_club, to_club)


def abs_days_diff(date_a: str, date_b: str) -> int:
    """Absolute difference in days between two YYYY-MM-DD strings."""
    try:
        a = datetime.strptime(date_a[:10], "%Y-%m-%d")
        b = datetime.strptime(date_b[:10], "%Y-%m-%d")
        return abs((a - b).days)
    except (ValueError, TypeError):
        return 9999


# ── Main processing loop ─────────────────────────────────────────────────────

stats = {
    "players_checked": 0,
    "transfers_found": 0,
    "transfers_inserted": 0,
    "transfers_skipped_existing": 0,
    "transfers_skipped_no_date": 0,
    "transfers_skipped_currency": 0,
    "currencies_seen": {},
    "errors": 0,
}

all_qids = list(player_lookup.keys())

for i in range(0, len(all_qids), BATCH_SIZE):
    batch_qids = all_qids[i:i + BATCH_SIZE]
    qid_map = {qid: player_lookup[qid] for qid in batch_qids}

    if not qid_map:
        continue

    batch_num = i // BATCH_SIZE + 1
    total_batches = (len(all_qids) + BATCH_SIZE - 1) // BATCH_SIZE
    stats["players_checked"] += len(qid_map)
    print(f"\n  Batch {batch_num}/{total_batches}: {len(qid_map)} players...")

    values = " ".join(f"wd:{qid}" for qid in qid_map.keys())

    query = f"""
    SELECT ?player ?fee ?currency ?currencyLabel ?date ?team ?teamLabel
    WHERE {{
      VALUES ?player {{ {values} }}
      ?player p:P1536 ?stmt .
      ?stmt ps:P1536 ?fee .
      OPTIONAL {{ ?stmt psv:P1536/wikibase:quantityUnit ?currency . }}
      OPTIONAL {{ ?stmt pq:P580 ?date . }}
      OPTIONAL {{ ?stmt pq:P54 ?team . }}
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
    }}
    """

    rows = sparql_query(query)

    for row in rows:
        try:
            # Extract QID
            p_uri = row["player"]["value"]
            qid = p_uri.split("/")[-1]
            if qid not in qid_map:
                continue

            info = qid_map[qid]
            pid = info["pid"]
            pname = info["name"]

            # Fee
            fee_raw = float(row.get("fee", {}).get("value", 0))
            if fee_raw <= 0:
                continue

            # Currency
            currency_uri = row.get("currency", {}).get("value", "")
            currency_qid = currency_uri.split("/")[-1] if currency_uri else ""
            currency_label = row.get("currencyLabel", {}).get("value", currency_qid)

            # Track currencies seen
            ckey = currency_qid or "unknown"
            stats["currencies_seen"][ckey] = stats["currencies_seen"].get(ckey, 0) + 1

            if currency_qid not in CURRENCY_RATES:
                if VERBOSE:
                    print(f"    {pname}: skipping unknown currency {currency_qid} ({currency_label})")
                stats["transfers_skipped_currency"] += 1
                continue

            rate = CURRENCY_RATES[currency_qid]
            fee_eur = fee_raw * rate
            fee_eur_m = round(fee_eur / 1_000_000, 2)

            # Date
            date_str = safe_date(row.get("date", {}).get("value", ""))
            if not date_str:
                stats["transfers_skipped_no_date"] += 1
                if VERBOSE:
                    print(f"    {pname}: skipping transfer with no valid date (fee={fee_eur_m}m)")
                continue

            # Team qualifier
            team_label = row.get("teamLabel", {}).get("value", "") if "teamLabel" in row else None

            # Resolve clubs
            from_club, to_club = resolve_clubs(pid, date_str, team_label)

            # Age at transfer
            age = compute_age(info["dob"], date_str)

            # Transfer window
            window = derive_transfer_window(date_str)

            stats["transfers_found"] += 1

            # Check for existing higher-priority record
            existing_key = (pid, date_str)
            if existing_key in existing_transfers:
                existing_src = existing_sources.get(existing_key, "")
                if existing_src in ("seed", "kaggle"):
                    stats["transfers_skipped_existing"] += 1
                    if VERBOSE:
                        print(f"    {pname}: skipping {date_str} — existing {existing_src} record")
                    continue
                elif existing_src == "wikidata" and not FORCE:
                    stats["transfers_skipped_existing"] += 1
                    continue

            if VERBOSE or DRY_RUN:
                cur_name = CURRENCY_NAMES.get(currency_qid, currency_qid)
                print(f"    {pname}: {from_club} → {to_club} on {date_str}, "
                      f"{fee_eur_m}m EUR (raw: {fee_raw:,.0f} {cur_name}), age={age}")

            if not DRY_RUN:
                cur.execute("""
                    INSERT INTO transfers (
                        player_name, player_id, age_at_transfer, position,
                        from_club, to_club, fee_eur_m, fee_type,
                        transfer_date, transfer_window,
                        source, confidence, created_at, updated_at
                    ) VALUES (
                        %s, %s, %s, %s,
                        %s, %s, %s, 'permanent',
                        %s, %s,
                        'wikidata', 'medium', now(), now()
                    )
                    ON CONFLICT (player_id, transfer_date) DO UPDATE SET
                        fee_eur_m = EXCLUDED.fee_eur_m,
                        from_club = EXCLUDED.from_club,
                        to_club = EXCLUDED.to_club,
                        age_at_transfer = EXCLUDED.age_at_transfer,
                        updated_at = now()
                    WHERE transfers.source = 'wikidata'
                """, (
                    pname, pid, age, info["position"],
                    from_club, to_club, fee_eur_m,
                    date_str, window,
                ))
                stats["transfers_inserted"] += 1

        except Exception as e:
            stats["errors"] += 1
            if VERBOSE:
                print(f"    ERROR processing row: {e}")

    # Rate limit
    time.sleep(2)

# ── Summary ──────────────────────────────────────────────────────────────────

print(f"\n{'═' * 60}")
print(f"  Transfer Fee Ingestion (P1536) — Summary")
print(f"{'═' * 60}")
print(f"  Players checked:         {stats['players_checked']}")
print(f"  Transfers found:         {stats['transfers_found']}")
print(f"  Transfers inserted:      {stats['transfers_inserted']}")
print(f"  Skipped (higher source): {stats['transfers_skipped_existing']}")
print(f"  Skipped (no date):       {stats['transfers_skipped_no_date']}")
print(f"  Skipped (unknown curr.): {stats['transfers_skipped_currency']}")
print(f"  Errors:                  {stats['errors']}")
print(f"  Currencies encountered:")
for cqid, count in sorted(stats["currencies_seen"].items(), key=lambda x: -x[1]):
    name = CURRENCY_NAMES.get(cqid, cqid)
    print(f"    {name}: {count}")
if DRY_RUN:
    print(f"\n  (dry-run — no data was written)")
print(f"{'═' * 60}")

cur.close()
conn.close()
print("\nDone.")
