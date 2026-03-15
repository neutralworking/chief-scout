"""
comparables.py — Find comparable transfers for valuation context.

Usage:
    from lib.comparables import find_comparables

    comps = find_comparables(conn, position="CF", age=22, limit=10)
"""
from __future__ import annotations

from psycopg2.extras import RealDictCursor


def find_comparables(
    conn,
    position: str,
    age: int,
    primary_archetype: str | None = None,
    fee_range: tuple[float, float] | None = None,
    from_league: str | None = None,
    to_league: str | None = None,
    deal_context: str | None = None,
    window: str | None = None,
    limit: int = 10,
) -> list[dict]:
    """
    Query the transfers table for comparable transfers.

    Args:
        conn: psycopg2 connection
        position: Target position (e.g. "CF", "CM"). Fuzzy-matched via ILIKE.
        age: Target age. Matches ±2 years.
        primary_archetype: Optional archetype filter (ILIKE match).
        fee_range: Optional (min, max) fee in EUR millions.
        from_league: Optional source league filter.
        to_league: Optional destination league filter.
        deal_context: Optional deal context filter (exact match).
        window: Optional window filter (e.g. "2025_jan").
        limit: Max results (default 10).

    Returns:
        List of transfer dicts sorted by transfer_date DESC.
    """
    conditions = []
    params: list = []

    # Position fuzzy match
    conditions.append("position ILIKE %s")
    params.append(f"%{position}%")

    # Age range ±2
    conditions.append("age_at_transfer BETWEEN %s AND %s")
    params.extend([age - 2, age + 2])

    # Optional filters
    if primary_archetype:
        conditions.append("primary_archetype ILIKE %s")
        params.append(f"%{primary_archetype}%")

    if fee_range:
        fee_min, fee_max = fee_range
        conditions.append("fee_eur_m >= %s AND fee_eur_m <= %s")
        params.extend([fee_min, fee_max])

    if from_league:
        conditions.append("from_league ILIKE %s")
        params.append(f"%{from_league}%")

    if to_league:
        conditions.append("to_league ILIKE %s")
        params.append(f"%{to_league}%")

    if deal_context:
        conditions.append("deal_context = %s")
        params.append(deal_context)

    if window:
        conditions.append("window = %s")
        params.append(window)

    where = " AND ".join(conditions)
    params.append(limit)

    query = f"""
        SELECT *
        FROM transfers
        WHERE {where}
        ORDER BY transfer_date DESC
        LIMIT %s
    """

    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(query, params)
    results = [dict(row) for row in cur.fetchall()]
    cur.close()
    return results
