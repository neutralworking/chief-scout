"""
07_push_to_supabase.py — Full data push: scouting notes + formations + transfers

Run AFTER executing schema_additions.sql in Supabase SQL Editor.

Usage:
    python pipeline/07_push_to_supabase.py
"""
import json, time, sys
from pathlib import Path
from supabase import create_client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY, CACHE_DIR

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Load pre-computed data ────────────────────────────────────────────────────

data_dir = CACHE_DIR
with open(data_dir / "rsg_players.json") as f:
    rsg_players = json.load(f)
with open(data_dir / "formations.json") as f:
    formations = json.load(f)


def safe_update(player_id, update_dict, name=""):
    update = {k: v for k, v in update_dict.items() if v is not None}
    if not update:
        return False
    for attempt in range(3):
        try:
            sb.table("players").update(update).eq("id", player_id).execute()
            return True
        except Exception as e:
            if attempt == 2:
                print(f"  ERR {name}: {str(e)[:80]}")
            time.sleep(1)
    return False


# ── 1. Scouting notes ─────────────────────────────────────────────────────────

print("Pushing scouting notes...")
with_notes = [p for p in rsg_players if p.get("db_id") and p.get("scouting_notes")]
print(f"  {len(with_notes)} players have scouting notes")

ok = errors = 0
for p in with_notes:
    update = {
        "scouting_notes": p["scouting_notes"],
        "hg": p.get("hg") or False,
    }
    if p.get("joined_year"): update["joined_year"] = p["joined_year"]
    if p.get("prev_club"): update["prev_club"] = p["prev_club"]
    if p.get("transfer_fee_eur"): update["transfer_fee_eur"] = p["transfer_fee_eur"]

    if safe_update(p["db_id"], update, p["name"]):
        ok += 1
    else:
        errors += 1
    if ok % 100 == 0 and ok:
        print(f"  {ok}/{len(with_notes)} notes pushed...", end="\r")

print(f"\n  Done: {ok} scouting notes pushed, {errors} errors")


# ── 2. Formations ─────────────────────────────────────────────────────────────

print("\nPushing formations...")
result = sb.table("formations").upsert(formations, on_conflict="name").execute()
print(f"  {len(result.data)} formations upserted")


print("\nAll done.")
