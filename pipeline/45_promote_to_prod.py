#!/usr/bin/env python3
"""
40_promote_to_prod.py — Promote finished (Tier 1) players to production Supabase.

Only players with complete data across all 6 tables are promoted:
  - people (identity)
  - player_profiles (archetype, blueprint, position, level, overall)
  - player_personality (MBTI + traits)
  - player_market (valuation)
  - player_status (pursuit + scouting notes)
  - attribute_grades (30+ grades)

Also promotes supporting reference data:
  - nations, clubs (referenced by promoted players)
  - tags (referenced by player_tags)
  - tactical_roles, formation_slots

Usage:
    python 40_promote_to_prod.py --dry-run          # Preview what would be promoted
    python 40_promote_to_prod.py                     # Promote to prod
    python 40_promote_to_prod.py --player "Saka"     # Promote specific player
    python 40_promote_to_prod.py --list              # List all prod-ready players

Requires PROD_SUPABASE_URL and PROD_SUPABASE_SERVICE_KEY in .env.local
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from supabase import create_client

# ── Load env ──────────────────────────────────────────────────────────

_env_local = Path(__file__).resolve().parent.parent / ".env.local"
_env_file = Path(__file__).resolve().parent.parent / ".env"
if _env_local.exists() and load_dotenv:
    load_dotenv(_env_local)
elif _env_file.exists() and load_dotenv:
    load_dotenv(_env_file)

STAGING_URL = os.environ.get("SUPABASE_URL", "")
STAGING_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
PROD_URL = os.environ.get("PROD_SUPABASE_URL", "")
PROD_KEY = os.environ.get("PROD_SUPABASE_SERVICE_KEY", "")

# ── Minimum attribute count to qualify as complete ────────────────────
MIN_ATTRIBUTES = 20


def _fetch_all(query_builder):
    """Paginate through supabase-py's 1000-row default limit."""
    PAGE = 1000
    rows = []
    offset = 0
    while True:
        page = query_builder.range(offset, offset + PAGE - 1).execute().data
        rows.extend(page)
        if len(page) < PAGE:
            break
        offset += PAGE
    return rows


def _fetch_ids_batched(staging, table, id_col, ids, select="person_id", extra_filters=None):
    """Fetch rows in batches of 500 IDs (Supabase IN limit)."""
    BATCH = 500
    rows = []
    for i in range(0, len(ids), BATCH):
        batch = ids[i : i + BATCH]
        q = staging.table(table).select(select).in_(id_col, batch)
        if extra_filters:
            q = extra_filters(q)
        rows.extend(_fetch_all(q))
    return rows


def get_prod_ready_players(staging):
    """Find all Tier 1 players with complete data across all tables."""

    # Get Tier 1 profiles (archetype is not null)
    profiles = _fetch_all(
        staging.table("player_profiles")
        .select("person_id")
        .not_.is_("archetype", "null")
    )
    tier1_ids = [r["person_id"] for r in profiles]
    if not tier1_ids:
        return []

    # Check personality exists
    personality = _fetch_ids_batched(staging, "player_personality", "person_id", tier1_ids)
    has_personality = {r["person_id"] for r in personality}

    # Check market exists
    market = _fetch_ids_batched(staging, "player_market", "person_id", tier1_ids)
    has_market = {r["person_id"] for r in market}

    # Check status exists (scouting_notes required, pursuit_status optional)
    def status_filters(q):
        return q.not_.is_("scouting_notes", "null").neq("scouting_notes", "")

    status = _fetch_ids_batched(
        staging, "player_status", "person_id", tier1_ids,
        select="person_id", extra_filters=status_filters,
    )
    has_status = {r["person_id"] for r in status}

    # Check attribute count per player
    grades = _fetch_ids_batched(
        staging, "attribute_grades", "player_id", tier1_ids, select="player_id",
    )
    attr_counts: dict[int, int] = {}
    for r in grades:
        attr_counts[r["player_id"]] = attr_counts.get(r["player_id"], 0) + 1
    has_enough_attrs = {
        pid for pid, count in attr_counts.items() if count >= MIN_ATTRIBUTES
    }

    # Intersection: must have ALL tables populated
    ready_ids = [
        pid
        for pid in tier1_ids
        if pid in has_personality
        and pid in has_market
        and pid in has_status
        and pid in has_enough_attrs
    ]

    return sorted(ready_ids)


def _fetch_batched(staging, table, id_col, ids, select="*"):
    """Fetch rows in batches of 400 IDs, paginating each batch to get all rows."""
    BATCH = 400
    PAGE = 1000
    all_rows = []
    for i in range(0, len(ids), BATCH):
        batch_ids = ids[i : i + BATCH]
        offset = 0
        while True:
            page = (
                staging.table(table)
                .select(select)
                .in_(id_col, batch_ids)
                .range(offset, offset + PAGE - 1)
                .execute()
                .data
            )
            all_rows.extend(page)
            if len(page) < PAGE:
                break
            offset += PAGE
    return all_rows


def fetch_player_data(staging, player_ids: list[int]) -> dict:
    """Fetch complete player data for promotion."""
    if not player_ids:
        return {}

    data = {}

    # People (identity)
    people = _fetch_batched(staging, "people", "id", player_ids)
    data["people"] = people

    # Collect referenced nation/club IDs
    nation_ids = list({p["nation_id"] for p in people if p.get("nation_id")})
    club_ids = list({p["club_id"] for p in people if p.get("club_id")})

    # Nations
    if nation_ids:
        data["nations"] = _fetch_batched(staging, "nations", "id", nation_ids)

    # Clubs (+ their nation_ids)
    if club_ids:
        clubs = _fetch_batched(staging, "clubs", "id", club_ids)
        data["clubs"] = clubs
        # Also grab club nations not already included
        club_nation_ids = [
            c["nation_id"]
            for c in clubs
            if c.get("nation_id") and c["nation_id"] not in nation_ids
        ]
        if club_nation_ids:
            extra_nations = _fetch_batched(staging, "nations", "id", club_nation_ids)
            data.setdefault("nations", []).extend(extra_nations)

    # Player profiles
    data["player_profiles"] = _fetch_batched(staging, "player_profiles", "person_id", player_ids)

    # Player personality
    data["player_personality"] = _fetch_batched(staging, "player_personality", "person_id", player_ids)

    # Player market
    data["player_market"] = _fetch_batched(staging, "player_market", "person_id", player_ids)

    # Player status
    data["player_status"] = _fetch_batched(staging, "player_status", "person_id", player_ids)

    # Attribute grades (can be many rows per player)
    data["attribute_grades"] = _fetch_batched(staging, "attribute_grades", "player_id", player_ids)

    # Player tags
    tags_data = _fetch_batched(staging, "player_tags", "player_id", player_ids)
    data["player_tags"] = tags_data

    # Tags referenced
    tag_ids = list({t["tag_id"] for t in tags_data if t.get("tag_id")})
    if tag_ids:
        data["tags"] = (
            staging.table("tags")
            .select("*")
            .in_("id", tag_ids)
            .execute()
            .data
        )

    # Key moments (optional enrichment)
    try:
        data["key_moments"] = (
            staging.table("key_moments")
            .select("*")
            .in_("player_id", player_ids)
            .execute()
            .data
        )
    except Exception:
        data["key_moments"] = []

    # Career history (optional enrichment)
    try:
        data["player_career_history"] = (
            staging.table("player_career_history")
            .select("*")
            .in_("player_id", player_ids)
            .execute()
            .data
        )
    except Exception:
        data["player_career_history"] = []

    return data


def upsert_to_prod(prod, data: dict, dry_run: bool = False):
    """Push data to production Supabase with upserts."""

    # Order matters — reference tables first
    table_order = [
        ("nations", "id"),
        ("clubs", "id"),
        ("tags", "id"),
        ("people", "id"),
        ("player_profiles", "person_id"),
        ("player_personality", "person_id"),
        ("player_market", "person_id"),
        ("player_status", "person_id"),
        ("attribute_grades", None),  # composite key
        ("player_tags", None),  # composite key
        ("key_moments", "id"),
        ("player_career_history", "id"),
    ]

    for table_name, on_conflict in table_order:
        rows = data.get(table_name, [])
        if not rows:
            continue

        print(f"  {table_name}: {len(rows)} rows", end="")

        if dry_run:
            print(" (dry-run)")
            continue

        try:
            CHUNK = 500
            if on_conflict:
                for j in range(0, len(rows), CHUNK):
                    prod.table(table_name).upsert(
                        rows[j : j + CHUNK], on_conflict=on_conflict
                    ).execute()
            else:
                # For composite-key tables, delete and re-insert
                if table_name in ("attribute_grades", "player_tags"):
                    id_col = "player_id"
                    pids = list({r[id_col] for r in rows})
                    for j in range(0, len(pids), CHUNK):
                        prod.table(table_name).delete().in_(
                            id_col, pids[j : j + CHUNK]
                        ).execute()
                for j in range(0, len(rows), CHUNK):
                    prod.table(table_name).insert(
                        rows[j : j + CHUNK]
                    ).execute()
            print(" OK")
        except Exception as e:
            print(f" ERROR: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Promote Tier 1 players to production Supabase"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--list", action="store_true", help="List prod-ready players")
    parser.add_argument("--player", type=str, help="Promote specific player by name")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip confirmation prompt",
    )
    args = parser.parse_args()

    if not STAGING_URL or not STAGING_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required")
        sys.exit(1)

    if not args.list and not args.dry_run and (not PROD_URL or not PROD_KEY):
        print("ERROR: PROD_SUPABASE_URL and PROD_SUPABASE_SERVICE_KEY required")
        print("Add them to .env.local")
        sys.exit(1)

    staging = create_client(STAGING_URL, STAGING_KEY)

    # Find prod-ready players
    print("Scanning for prod-ready players (Tier 1 + complete data)...")
    ready_ids = get_prod_ready_players(staging)

    if not ready_ids:
        print("No prod-ready players found.")
        sys.exit(0)

    # Get names for display
    people = _fetch_batched(staging, "people", "id", ready_ids, select="id, name")
    name_map = {p["id"]: p["name"] for p in people}

    # Filter by name if specified
    if args.player:
        search = args.player.lower()
        ready_ids = [
            pid
            for pid in ready_ids
            if search in name_map.get(pid, "").lower()
        ]
        if not ready_ids:
            print(f"No prod-ready players matching '{args.player}'")
            sys.exit(0)

    print(f"\n{len(ready_ids)} prod-ready players:")
    for pid in ready_ids:
        print(f"  [{pid}] {name_map.get(pid, '?')}")

    if args.list:
        sys.exit(0)

    # Fetch full data
    print(f"\nFetching complete data for {len(ready_ids)} players...")
    data = fetch_player_data(staging, ready_ids)

    # Summary
    print("\nPromotion payload:")
    for table, rows in data.items():
        if rows:
            print(f"  {table}: {len(rows)} rows")

    if args.dry_run:
        print("\n[DRY RUN] No data written to production.")
        sys.exit(0)

    # Confirmation
    if not args.force:
        answer = input(f"\nPromote {len(ready_ids)} players to production? [y/N] ")
        if answer.lower() != "y":
            print("Aborted.")
            sys.exit(0)

    # Push to prod
    prod = create_client(PROD_URL, PROD_KEY)
    print("\nPushing to production...")
    upsert_to_prod(prod, data)
    print("\nDone. Production updated.")


if __name__ == "__main__":
    main()
