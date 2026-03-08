"""
add_dof_columns.py — Add Director of Football decision columns to the players table.

  pursuit_status         TEXT  'Pass' | 'Watch' | 'Interested' | 'Priority'
  director_valuation_meur INTEGER  DoF's internal valuation in millions of euros
  fit_note               TEXT  one-line note on how the player fits the system
"""
from __future__ import annotations
import sys

from config import POSTGRES_DSN

DRY_RUN = "--dry-run" in sys.argv


def main():
    import psycopg2

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    ddl = [
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS pursuit_status TEXT "
        "CHECK (pursuit_status IN ('Pass','Watch','Interested','Priority'))",
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS director_valuation_meur INTEGER",
        "ALTER TABLE players ADD COLUMN IF NOT EXISTS fit_note TEXT",
    ]

    for stmt in ddl:
        print(f"  {stmt[:80]}…")
        cur.execute(stmt)

    if DRY_RUN:
        print("\n--dry-run: rolling back.")
        conn.rollback()
    else:
        conn.commit()
        print("\nDone. 3 columns added (IF NOT EXISTS — safe to re-run).")

    conn.close()


if __name__ == "__main__":
    main()
