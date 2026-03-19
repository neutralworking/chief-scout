"""Shared database connection helpers for pipeline scripts.

Usage:
    from lib.db import get_conn, require_conn

    # Simple — get a connection (exits if DSN not set)
    conn = require_conn()
    cur = conn.cursor()
    cur.execute("SELECT 1")
    conn.close()

    # Context manager — auto-closes
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT 1")

    # With Supabase client too
    from lib.db import require_conn, get_supabase
    conn = require_conn()
    sb = get_supabase()

    # Production database
    conn = require_conn(prod=True)
"""

import sys
from contextlib import contextmanager

import psycopg2
import psycopg2.extras

from config import (
    POSTGRES_DSN,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
)


def require_conn(dsn: str | None = None, prod: bool = False, autocommit: bool = False) -> psycopg2.extensions.connection:
    """Get a psycopg2 connection. Exits with error if DSN not available.

    Args:
        dsn: Override DSN (default: POSTGRES_DSN from config)
        prod: Use PROD_POSTGRES_DSN instead
        autocommit: Set autocommit mode
    """
    if dsn is None:
        if prod:
            import os
            dsn = os.environ.get("PROD_POSTGRES_DSN", "")
            if not dsn:
                print("ERROR: PROD_POSTGRES_DSN not set in .env.local")
                sys.exit(1)
        else:
            dsn = POSTGRES_DSN

    if not dsn:
        print("ERROR: POSTGRES_DSN not set. Check .env.local")
        sys.exit(1)

    conn = psycopg2.connect(dsn)
    if autocommit:
        conn.autocommit = True
    return conn


@contextmanager
def get_conn(dsn: str | None = None, prod: bool = False, autocommit: bool = False):
    """Context manager for database connections. Auto-closes on exit.

    Usage:
        with get_conn() as conn:
            cur = conn.cursor()
            ...
    """
    conn = require_conn(dsn=dsn, prod=prod, autocommit=autocommit)
    try:
        yield conn
    finally:
        conn.close()


def get_supabase():
    """Get a Supabase Python client. Exits if credentials not available."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY not set. Check .env.local")
        sys.exit(1)
    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: supabase-py not installed. Run: pip install supabase")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_dict_cursor(conn):
    """Get a cursor that returns rows as dicts."""
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


def chunked_upsert(sb_client, table: str, rows: list[dict], conflict: str, chunk_size: int = 200):
    """Upsert rows to Supabase in chunks.

    Args:
        sb_client: Supabase client from get_supabase()
        table: Table name
        rows: List of row dicts
        conflict: ON CONFLICT column(s), e.g. "player_id,attribute,source"
        chunk_size: Rows per upsert call
    """
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i:i + chunk_size]
        sb_client.table(table).upsert(chunk, on_conflict=conflict).execute()
