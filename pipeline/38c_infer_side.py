"""
38c_infer_side.py — Infer preferred side (L/R/C) for player_profiles.

Priority:
  1. EA FC 25 position data (LW/RW/LB/RB/LM/RM → L or R, rest → C)
  2. Foot-based inference for wide positions (WF inverts, WD/WM matches)
  3. Central positions default to C

Only fills NULLs — never overwrites existing side data.

Usage:
    python 38c_infer_side.py --dry-run
    python 38c_infer_side.py
    python 38c_infer_side.py --force   # overwrite existing
"""
import argparse
import csv
import unicodedata
from pathlib import Path

from config import POSTGRES_DSN
from lib.db import require_conn, get_supabase

parser = argparse.ArgumentParser(description="Infer preferred side from EA FC + foot")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true", help="Overwrite existing side data")
args = parser.parse_args()

conn = require_conn(autocommit=True)
sb = get_supabase()
cur = conn.cursor()

KAGGLE_DIR = Path(__file__).parent.parent / "imports" / "kaggle" / "eafc25"

# ── Step 1: Load EA FC position data ────────────────────────────────────────

EAFC_SIDE_MAP = {
    "LW": "L", "LB": "L", "LM": "L",
    "RW": "R", "RB": "R", "RM": "R",
    "ST": "C", "CAM": "C", "CM": "C", "CDM": "C", "CB": "C", "GK": "C",
}


def normalize_name(name):
    if not name:
        return ""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.lower().strip()


def infer_side_from_eafc(pos, alt_positions):
    """Infer side from EA FC primary + alternative positions.

    If primary is sided (LW/RW/LB/RB/LM/RM), use that.
    If primary is central but alts include a sided position, use that.
    If alts include both L and R sided positions, return None (plays both).
    """
    primary_side = EAFC_SIDE_MAP.get(pos)

    if primary_side in ("L", "R"):
        return primary_side

    # Check alternatives
    alt_sides = set()
    for ap in (alt_positions or "").split(","):
        ap = ap.strip()
        s = EAFC_SIDE_MAP.get(ap)
        if s in ("L", "R"):
            alt_sides.add(s)

    if len(alt_sides) == 1:
        return alt_sides.pop()
    if len(alt_sides) == 2:
        return None  # plays both sides

    return primary_side  # C or None


# Parse EAFC CSV → name → side
eafc_sides = {}  # normalized_name → side
csv_path = KAGGLE_DIR / "male_players.csv"
if csv_path.exists():
    with open(csv_path) as f:
        for row in csv.DictReader(f):
            name = row.get("Name") or row.get("Known as") or row.get("Full name", "")
            pos = row.get("Position", "")
            alt = row.get("Alternative positions", "") or row.get("Alt Positions", "")
            side = infer_side_from_eafc(pos, alt)
            if side and name:
                nname = normalize_name(name)
                eafc_sides[nname] = side
    print(f"  EA FC sides loaded: {len(eafc_sides)} players")
    from collections import Counter
    sc = Counter(eafc_sides.values())
    print(f"    L={sc.get('L',0)}, R={sc.get('R',0)}, C={sc.get('C',0)}")
else:
    print(f"  [warn] EA FC CSV not found at {csv_path}")

# ── Step 2: Load players needing side ───────────────────────────────────────

where = "WHERE pp.side IS NULL" if not args.force else ""
cur.execute(f"""
    SELECT pp.person_id, p.name, pp.position, p.preferred_foot
    FROM player_profiles pp
    JOIN people p ON p.id = pp.person_id
    WHERE pp.position IS NOT NULL
      {"AND pp.side IS NULL" if not args.force else ""}
""")
rows = cur.fetchall()
print(f"  Players to process: {len(rows)}")


# ── Step 3: Infer side ─────────────────────────────────────────────────────

def infer_side_from_foot(position, foot):
    """Fallback: infer side from position + preferred foot."""
    if position in ("GK", "CD", "DM", "CM", "AM", "CF"):
        return "C"
    if not foot or foot in ("Either", "Both"):
        return None

    if position == "WF":
        # Inverted wingers: left foot → right side
        return "R" if foot == "Left" else "L"
    elif position in ("WD", "WM"):
        # Natural: foot = side
        return "L" if foot == "Left" else "R"
    return None


updates = []
stats = {"eafc": 0, "foot": 0, "central": 0, "skip": 0}
side_counts = {"L": 0, "R": 0, "C": 0}

for person_id, name, position, foot in rows:
    side = None

    # Priority 1: EA FC position data
    nname = normalize_name(name)
    if nname in eafc_sides:
        side = eafc_sides[nname]
        if side:
            stats["eafc"] += 1

    # Priority 2: foot-based inference
    if side is None:
        side = infer_side_from_foot(position, foot)
        if side == "C":
            stats["central"] += 1
        elif side:
            stats["foot"] += 1

    if side is None:
        stats["skip"] += 1
        continue

    side_counts[side] += 1
    updates.append({"person_id": person_id, "side": side})


# ── Step 4: Apply ──────────────────────────────────────────────────────────

print(f"\n  Results:")
print(f"    From EA FC:     {stats['eafc']}")
print(f"    From foot:      {stats['foot']}")
print(f"    Central default: {stats['central']}")
print(f"    Skipped:        {stats['skip']}")
print(f"    Total:          L={side_counts['L']}, R={side_counts['R']}, C={side_counts['C']}")

if not args.dry_run and updates:
    for i in range(0, len(updates), 200):
        chunk = updates[i:i + 200]
        sb.table("player_profiles").upsert(chunk, on_conflict="person_id").execute()
    print(f"\n  Applied {len(updates)} side assignments")
else:
    print(f"\n  [dry-run] would apply {len(updates)} side assignments")

cur.close()
conn.close()
print("Done.")
