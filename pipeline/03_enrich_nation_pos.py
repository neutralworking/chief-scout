"""
03_enrich_nation_pos.py — Fill nation and position gaps.

1. Nation:  name-match against people table (full country names)
2. Position: GK detection from player_attributes (handling/footwork signals)
             + attribute pattern matching for field players
"""
from __future__ import annotations
import sys
import unicodedata

from config import POSTGRES_DSN

DRY_RUN = "--dry-run" in sys.argv

VALID_POSITIONS = {"GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"}


def normalise(name: str) -> str:
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower().strip()


def infer_position_from_attrs(pa: dict) -> str | None:
    """
    Use player_attributes to infer position.
    Logic: treat NULL as 'not applicable', non-null as 'this applies'.
    Rules are based on which attribute sets are exclusive to a role.
    """
    def sig(col):
        v = pa.get(col)
        return v is not None and v != "Average"

    def present(col):
        return pa.get(col) is not None

    # GK: only GKs have footwork / handling / communication as meaningful attributes
    gk_score = sum([sig("footwork"), sig("handling"), present("communication") and sig("communication")])
    if gk_score >= 1 and sig("handling") or sig("footwork"):
        return "GK"

    # Collect signals
    def_sigs  = sum([sig("tackling"), sig("marking"), sig("blocking"), sig("positioning")])
    atk_sigs  = sum([sig("close_range"), sig("volleys"), sig("heading") and present("heading")])
    wide_sigs = sum([sig("crossing"), sig("takeons"), sig("pace")])
    mid_sigs  = sum([sig("creativity"), sig("vision"), sig("through_balls"), sig("stamina")])

    total = def_sigs + atk_sigs + wide_sigs + mid_sigs
    if total == 0:
        return None

    # Strong exclusive signals
    if def_sigs >= 2 and atk_sigs == 0:
        if wide_sigs >= 1:
            return "WD"
        return "CD"

    if atk_sigs >= 2 and def_sigs == 0:
        if wide_sigs >= 1:
            return "WF"
        return "CF"

    if mid_sigs >= 2 and def_sigs >= 1 and atk_sigs == 0:
        return "DM"

    if mid_sigs >= 2 and atk_sigs >= 1 and def_sigs == 0:
        return "AM"

    if wide_sigs >= 2:
        if def_sigs > atk_sigs:
            return "WD"
        return "WF"

    if mid_sigs >= 2:
        return "CM"

    return None


def main():
    import psycopg2
    import psycopg2.extras

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── 1. NATION via people table name-match ────────────────────────────────

    cur.execute("SELECT name AS \"Name\", n.name AS \"Nation\" FROM people p JOIN nations n ON n.id = p.nation_id WHERE p.nation_id IS NOT NULL")
    people_rows = cur.fetchall()
    people_map = {normalise(r["Name"]): r["Nation"] for r in people_rows}
    print(f"People table: {len(people_map):,} entries with nation")

    cur.execute("SELECT id, name FROM players WHERE nation IS NULL OR nation = ''")
    missing_nation = cur.fetchall()
    print(f"Players missing nation: {len(missing_nation):,}")

    nation_updates = []
    for p in missing_nation:
        key = normalise(p["name"])
        nation = people_map.get(key)
        if nation:
            nation_updates.append((nation, p["id"]))

    print(f"Nation matches found: {len(nation_updates)}")

    # ── 2. POSITION via player_attributes ────────────────────────────────────

    cur.execute("""
        SELECT pl.id, pl.name,
               pa.footwork, pa.handling, pa.communication,
               pa.tackling, pa.marking, pa.blocking, pa.positioning,
               pa.close_range, pa.volleys, pa.heading,
               pa.crossing, pa.takeons, pa.pace,
               pa.creativity, pa.vision, pa.through_balls, pa.stamina
        FROM players pl
        JOIN player_attributes pa ON pl.id = pa.id
        WHERE pl.position IS NULL
    """)
    no_pos = cur.fetchall()
    print(f"\nPlayers with attributes but no position: {len(no_pos):,}")

    pos_updates = []
    pos_dist: dict[str, int] = {}
    for p in no_pos:
        inferred = infer_position_from_attrs(p)
        if inferred:
            pos_updates.append((inferred, p["id"]))
            pos_dist[inferred] = pos_dist.get(inferred, 0) + 1

    print(f"Position inferred: {len(pos_updates):,}")
    for pos, n in sorted(pos_dist.items(), key=lambda x: -x[1]):
        print(f"  {pos}: {n}")

    if DRY_RUN:
        print("\n--dry-run: no writes.")
        conn.rollback()
        conn.close()
        return

    # ── Write nation ──────────────────────────────────────────────────────────
    # Nation updates: look up nation_id and update people table
    if nation_updates:
        cur.execute("SELECT id, name FROM nations")
        nation_name_to_id = {r["name"]: r["id"] for r in cur.fetchall()}
        nation_id_updates = []
        for nation_name, pid in nation_updates:
            nid = nation_name_to_id.get(nation_name)
            if nid:
                nation_id_updates.append((nid, pid))
        if nation_id_updates:
            cur.executemany("UPDATE people SET nation_id = %s WHERE id = %s", nation_id_updates)
            conn.commit()
            print(f"\n{len(nation_id_updates)} nation values written.")

    # ── Write position ────────────────────────────────────────────────────────
    if pos_updates:
        cur.executemany("UPDATE player_profiles SET position = %s::\"position\" WHERE person_id = %s", pos_updates)
        conn.commit()
        print(f"{len(pos_updates)} position values written.")

    # ── Final stats ───────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) n FROM players WHERE nation IS NOT NULL AND nation != ''")
    nat = cur.fetchone()["n"]
    cur.execute("SELECT COUNT(*) n FROM players WHERE position IS NOT NULL")
    pos = cur.fetchone()["n"]
    cur.execute("SELECT COUNT(*) n FROM players")
    total = cur.fetchone()["n"]
    print(f"\nFinal: nation {nat/total*100:.1f}% | position {pos/total*100:.1f}%")

    conn.close()


if __name__ == "__main__":
    main()
