"""Incremental processing helpers for pipeline scripts.

Usage in a pipeline script:

    from lib.incremental import get_changed_player_ids, mark_step_complete

    # Returns None = never run before (do full run), empty set = no changes, set = changed IDs
    changed = get_changed_player_ids(conn, "ratings", tables=["attribute_grades", "player_profiles"])

    if changed is None:
        print("  First run — processing all")
    elif not changed:
        print("  No changes — skipping")
        return
    else:
        print(f"  {len(changed)} players changed")
        # Filter to only process changed players

    # After success:
    mark_step_complete(conn, "ratings", processed_count)
"""

import json
from datetime import datetime, timezone


def get_last_run(conn, step_name: str) -> datetime | None:
    """Get the timestamp of the last successful run for a step."""
    cur = conn.cursor()
    cur.execute("""
        SELECT ran_at FROM cron_log
        WHERE job = %s AND (stats->>'status') = 'ok'
        ORDER BY ran_at DESC LIMIT 1
    """, (f"step:{step_name}",))
    row = cur.fetchone()
    return row[0] if row else None


def get_changed_player_ids(
    conn,
    step_name: str,
    tables: list[str] | None = None,
    since: datetime | None = None,
) -> set[int] | None:
    """Find player IDs with data changes since the last run of this step.

    Returns:
        None — never run before (caller should do full run)
        empty set — no changes since last run (caller can skip)
        non-empty set — IDs of changed players
    """
    if since is None:
        since = get_last_run(conn, step_name)

    if since is None:
        return None  # Never run before

    if tables is None:
        tables = ["attribute_grades", "player_profiles"]

    cur = conn.cursor()
    changed = set()

    ID_COLUMNS = {
        "attribute_grades": "player_id",
        "player_trait_scores": "player_id",
    }

    for table in tables:
        id_col = ID_COLUMNS.get(table, "person_id")

        # Find best timestamp column
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = %s AND column_name IN ('updated_at', 'created_at')
            ORDER BY column_name DESC LIMIT 1
        """, (table,))
        ts_row = cur.fetchone()
        if not ts_row:
            continue
        ts_col = ts_row[0]

        # Check ID column exists
        cur.execute("""
            SELECT 1 FROM information_schema.columns
            WHERE table_name = %s AND column_name = %s
        """, (table, id_col))
        if not cur.fetchone():
            continue

        cur.execute(
            f"SELECT DISTINCT {id_col} FROM {table} WHERE {ts_col} > %s",
            (since,),
        )
        changed.update(row[0] for row in cur.fetchall())

    return changed


def mark_step_complete(conn, step_name: str, processed: int = 0, details: dict | None = None):
    """Record a successful step completion in cron_log."""
    cur = conn.cursor()
    stats = {
        "status": "ok",
        "processed": processed,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    if details:
        stats.update(details)
    cur.execute(
        "INSERT INTO cron_log (job, stats) VALUES (%s, %s)",
        (f"step:{step_name}", json.dumps(stats)),
    )
    conn.commit()
