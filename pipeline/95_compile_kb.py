"""
95_compile_kb.py — Compile the Knowledge Base from Supabase + raw docs.

Reads structured data from the database and raw research documents,
then compiles kb/ articles for players, archetypes, clubs, and tactics.

Usage:
    python 95_compile_kb.py --dry-run                    # preview without writing
    python 95_compile_kb.py --category players --top 20  # compile 20 players
    python 95_compile_kb.py --player "Bukayo Saka"       # single player
    python 95_compile_kb.py --category archetypes        # compile all 13 archetypes
    python 95_compile_kb.py --category tactics           # compile from docs/formations/
    python 95_compile_kb.py --category clubs             # compile clubs with 5+ players
    python 95_compile_kb.py --force                      # recompile all (ignore incremental)
    python 95_compile_kb.py --with-llm                   # use LLM for synthesis paragraphs
"""
from __future__ import annotations

import argparse
import time

import psycopg2
import psycopg2.extras

from config import POSTGRES_DSN
from lib.kb import (
    KB_ROOT, VAULT_MEN, VAULT_WOMEN, SCOUTING_DIR, FORMATIONS_DIR,
    slug, write_article, render_player_article, render_archetype_article,
    render_club_article, render_tactic_article,
)
from lib.models import MODEL_ATTRIBUTES, MODEL_LABELS

# ── CLI ────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Compile Knowledge Base articles")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing files")
parser.add_argument("--force", action="store_true", help="Recompile all (ignore incremental)")
parser.add_argument("--player", default=None, help="Compile single player by name")
parser.add_argument("--category", default=None, choices=["players", "archetypes", "tactics", "clubs", "concepts"],
                    help="Only compile one category")
parser.add_argument("--top", type=int, default=None, help="Limit to N players (for testing)")
parser.add_argument("--with-llm", action="store_true", help="Use LLM for synthesis sections")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
WITH_LLM = args.with_llm
BATCH_SIZE = 50
INTER_BATCH_DELAY = 1  # seconds (only relevant with --with-llm)

# ── DB connection ──────────────────────────────────────────────────────────────
def get_conn():
    if not POSTGRES_DSN:
        print("  ⚠ POSTGRES_DSN not set — skipping DB-based compilation")
        return None
    return psycopg2.connect(POSTGRES_DSN)


def get_dict_cursor(conn):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)


# ── Phase A: Players ─────────────────────────────────────────────────────────

def fetch_players(cur, player_name: str | None = None, top: int | None = None) -> list[dict]:
    """Fetch player data for KB compilation."""
    where = "WHERE pp.position IS NOT NULL"
    params = []
    if player_name:
        where += " AND p.name ILIKE %s"
        params.append(f"%{player_name}%")
    limit = f"LIMIT {top}" if top else ""

    cur.execute(f"""
        SELECT p.id, p.name,
               EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS age,
               pp.position, c.clubname AS club_name, n.name AS nation_name,
               pp.archetype, pp.model_id, pp.level, pp.overall,
               pp.best_role, pp.best_role_score,
               pp.technical_score, pp.tactical_score,
               pp.mental_score, pp.physical_score,
               ps.pursuit_status, ps.scouting_notes,
               pm.market_value_tier, pm.true_mvt,
               p.preferred_foot, p.height_cm
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        LEFT JOIN player_status ps ON ps.person_id = p.id
        LEFT JOIN player_market pm ON pm.person_id = p.id
        LEFT JOIN clubs c ON c.id = p.club_id
        LEFT JOIN nations n ON n.id = p.nation_id
        {where}
        ORDER BY pp.best_role_score DESC NULLS LAST
        {limit}
    """, params)
    return [dict(row) for row in cur.fetchall()]


def fetch_grades(cur, player_id: int) -> list[dict]:
    """Fetch top attribute grades for a player (best source per attribute)."""
    cur.execute("""
        SELECT DISTINCT ON (attribute)
               attribute, scout_grade, stat_score
        FROM attribute_grades
        WHERE player_id = %s
        ORDER BY attribute,
                 CASE source
                     WHEN 'scout_assessment' THEN 5
                     WHEN 'api_football' THEN 3
                     WHEN 'kaggle_pl' THEN 2
                     WHEN 'understat' THEN 2
                     WHEN 'statsbomb' THEN 1
                     ELSE 0
                 END DESC
    """, (player_id,))
    return [dict(row) for row in cur.fetchall()]


def fetch_traits(cur, player_id: int) -> list[dict]:
    """Fetch trait scores for a player."""
    cur.execute("""
        SELECT trait, category, severity
        FROM player_trait_scores
        WHERE player_id = %s
        ORDER BY severity DESC
    """, (player_id,))
    return [dict(row) for row in cur.fetchall()]


def fetch_personality(cur, player_id: int) -> dict | None:
    """Fetch personality data for a player."""
    cur.execute("""
        SELECT ei, sn, tf, jp, competitiveness, coachability
        FROM player_personality
        WHERE person_id = %s
    """, (player_id,))
    row = cur.fetchone()
    return dict(row) if row else None


def load_vault_narrative(name: str) -> str | None:
    """Load raw narrative from docs/research/rsg.db/main/men/ or women/."""
    for vault_dir in [VAULT_MEN, VAULT_WOMEN]:
        path = vault_dir / f"{name}.md"
        if path.exists():
            return path.read_text(encoding="utf-8")
    return None


def load_scouting_note(name: str) -> str | None:
    """Load structured scouting note from docs/Scouting/."""
    path = SCOUTING_DIR / f"{name}.md"
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def compile_players(conn, router=None):
    """Compile player articles."""
    cur = get_dict_cursor(conn)

    # Incremental check
    changed_ids = None
    if not FORCE and not args.player:
        try:
            from lib.incremental import get_changed_player_ids
            changed_ids = get_changed_player_ids(
                conn, "kb_compile",
                tables=["people", "player_profiles", "player_personality", "attribute_grades"]
            )
            if changed_ids is not None and not changed_ids:
                print("  No changes since last compile — skipping players")
                return 0
        except Exception:
            pass  # First run or no cron_log table

    players = fetch_players(cur, player_name=args.player, top=args.top)
    print(f"  {len(players)} players in scope")

    # Filter to changed IDs if incremental
    if changed_ids is not None:
        players = [p for p in players if p["id"] in changed_ids]
        print(f"  {len(players)} changed since last run")

    compiled = 0
    for i, player in enumerate(players):
        pid = player["id"]
        name = player["name"]

        # Skip if article exists and not forcing
        if not FORCE and not args.player:
            existing = KB_ROOT / "players" / f"{slug(name)}.md"
            if existing.exists() and changed_ids is None:
                continue

        grades = fetch_grades(cur, pid)
        traits = fetch_traits(cur, pid)
        personality = fetch_personality(cur, pid)
        narrative = load_vault_narrative(name)
        scouting_note = player.get("scouting_notes") or load_scouting_note(name)

        # Optional LLM synthesis
        synthesis = None
        if WITH_LLM and router and grades:
            synthesis = _synthesize_player(router, player, grades, traits, personality)

        content = render_player_article(
            player=player,
            grades=grades,
            traits=traits,
            personality=personality,
            narrative=narrative,
            scouting_note=scouting_note,
            synthesis=synthesis,
        )

        path = write_article("players", name, content, dry_run=DRY_RUN)
        compiled += 1

        if DRY_RUN and compiled <= 3:
            print(f"\n  --- Preview: {path} ---")
            print(content[:500])
            print("  ...")

        if (i + 1) % 100 == 0:
            print(f"  ... {i + 1}/{len(players)} compiled")

    return compiled


def _synthesize_player(router, player: dict, grades: list, traits: list, personality: dict | None) -> str | None:
    """Use LLM to generate a 3-sentence synthesis for a player."""
    top_attrs = sorted(grades, key=lambda g: g.get("scout_grade") or g.get("stat_score") or 0, reverse=True)[:5]
    attr_str = ", ".join(f"{g['attribute']}={g.get('scout_grade') or g.get('stat_score')}" for g in top_attrs)
    trait_str = ", ".join(t["trait"] for t in traits[:5]) if traits else "none"

    prompt = f"""Write a 3-sentence scouting summary for {player['name']} ({player.get('position', '?')}, {player.get('club_name', '?')}).
Archetype: {player.get('archetype', '?')}. Top attributes: {attr_str}. Key traits: {trait_str}.
Be concise and analytical. Focus on what makes this player distinctive."""

    try:
        result = router.call(prompt, preference="fast")
        return result.text.strip() if result else None
    except Exception:
        return None


# ── Phase B: Archetypes ──────────────────────────────────────────────────────

def compile_archetypes(conn=None):
    """Compile archetype articles (13 models). Works with or without DB."""
    compiled = 0

    for model, attributes in MODEL_ATTRIBUTES.items():
        exemplars = []

        # Try DB for real exemplars
        if conn:
            cur = get_dict_cursor(conn)
            cur.execute("""
                SELECT p.name, pp.position, c.clubname AS club_name, pp.overall
                FROM people p
                JOIN player_profiles pp ON pp.person_id = p.id
                LEFT JOIN clubs c ON c.id = p.club_id
                WHERE pp.archetype LIKE %s
                  AND pp.overall IS NOT NULL
                  AND p.active = true
                ORDER BY pp.overall DESC NULLS LAST
                LIMIT 10
            """, (f"{model}%",))
            exemplars = [dict(row) for row in cur.fetchall()]

        # Fallback: extract canonical exemplars from MODEL_LABELS comments
        if not exemplars:
            exemplars = _canonical_exemplars(model)

        # Gather compound archetypes for this model
        compounds = {k: v for k, v in MODEL_LABELS.items() if k.startswith(f"{model}-")}

        content = render_archetype_article(
            archetype=model,
            attributes=attributes,
            exemplars=exemplars,
            compounds=compounds,
        )

        path = write_article("archetypes", model, content, dry_run=DRY_RUN)
        compiled += 1

        if DRY_RUN:
            print(f"  {model}: {len(exemplars)} exemplars → {path}")

    return compiled


# Canonical exemplar players for each model (from MODEL_LABELS comments)
_CANONICAL_EXEMPLARS = {
    "Controller":  [("Rodri", "DM"), ("Pedri", "CM"), ("Frenkie de Jong", "CM"), ("Kroos", "CM"), ("Berbatov", "CF")],
    "Commander":   [("Maldini", "CD"), ("Roy Keane", "CM"), ("Henderson", "CM"), ("Vieira", "DM"), ("Gerrard", "CM")],
    "Creator":     [("Ronaldinho", "AM"), ("Bruno Fernandes", "AM"), ("Özil", "AM"), ("Messi", "WF"), ("Kaká", "AM")],
    "Target":      [("Souček", "CM"), ("Ibrahimović", "CF"), ("Ronaldo", "CF"), ("Crouch", "CF"), ("Godín", "CD")],
    "Sprinter":    [("Mbappé", "CF"), ("Pedro Neto", "WF"), ("Robertson", "WD"), ("Adama Traoré", "WF"), ("Overmars", "WF")],
    "Powerhouse":  [("Yaya Touré", "CM"), ("Pogba", "CM"), ("Drogba", "CF"), ("Essien", "CM"), ("Morgan Rogers", "AM")],
    "Cover":       [("Van Dijk", "CD"), ("John Stones", "CD"), ("Baresi", "CD"), ("Pau Torres", "CD"), ("Marcelo", "WD")],
    "Engine":      [("Nedved", "WM"), ("Gattuso", "DM"), ("Bale", "WF"), ("Zanetti", "WD"), ("Brozović", "DM")],
    "Destroyer":   [("Makélélé", "DM"), ("Gattuso", "DM"), ("Roy Keane", "CM"), ("Redondo", "DM"), ("Camavinga", "CM")],
    "Dribbler":    [("Ribéry", "WF"), ("Son", "WF"), ("Robben", "WF"), ("Leão", "WF"), ("Isco", "AM")],
    "Passer":      [("Thiago", "CM"), ("Laudrup", "AM"), ("Platini", "AM"), ("Xabi Alonso", "DM"), ("Pirlo", "DM")],
    "Striker":     [("Bergkamp", "CF"), ("Totti", "CF"), ("Batistuta", "CF"), ("Cantona", "CF"), ("Bale", "WF")],
    "GK":          [("Neuer", "GK"), ("Alisson", "GK"), ("De Gea", "GK"), ("Buffon", "GK"), ("Ederson", "GK")],
}

def _canonical_exemplars(model: str) -> list[dict]:
    """Return canonical exemplar dicts for offline archetype compilation."""
    return [
        {"name": name, "position": pos, "club_name": "—", "overall": "—"}
        for name, pos in _CANONICAL_EXEMPLARS.get(model, [])
    ]


# ── Phase C: Clubs ───────────────────────────────────────────────────────────

def compile_clubs(conn):
    """Compile club articles for clubs with 5+ players."""
    cur = get_dict_cursor(conn)

    # Find clubs with enough players
    cur.execute("""
        SELECT c.id, c.clubname AS name, c.league,
               n.name AS nation,
               COUNT(*) AS player_count
        FROM people p
        JOIN clubs c ON c.id = p.club_id
        LEFT JOIN nations n ON n.id = c.nation_id
        WHERE p.active = true
        GROUP BY c.id, c.clubname, c.league, n.name
        HAVING COUNT(*) >= 5
        ORDER BY COUNT(*) DESC
    """)
    clubs = [dict(row) for row in cur.fetchall()]
    print(f"  {len(clubs)} clubs with 5+ players")

    compiled = 0
    for club in clubs:
        # Fetch squad
        cur.execute("""
            SELECT p.name, pp.position, pp.archetype, pp.overall
            FROM people p
            JOIN player_profiles pp ON pp.person_id = p.id
            WHERE p.club_id = %s AND p.active = true
            ORDER BY pp.position, p.name
        """, (club["id"],))
        squad = [dict(row) for row in cur.fetchall()]

        content = render_club_article(club, squad)
        path = write_article("clubs", club["name"], content, dry_run=DRY_RUN)
        compiled += 1

    return compiled


# ── Phase D: Tactics ─────────────────────────────────────────────────────────

def compile_tactics():
    """Compile tactic articles from docs/formations/."""
    if not FORMATIONS_DIR.exists():
        print("  ⚠ docs/formations/ not found — skipping tactics")
        return 0

    compiled = 0
    for path in sorted(FORMATIONS_DIR.glob("*.md")):
        raw = path.read_text(encoding="utf-8")
        title = path.stem  # e.g. "4-3-3"
        content = render_tactic_article(title, raw)
        write_article("tactics", title, content, dry_run=DRY_RUN)
        compiled += 1

    return compiled


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("── 95  Compile Knowledge Base ──────────────────────────")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}")
    print(f"  Force: {FORCE}")
    print(f"  LLM: {WITH_LLM}")
    if args.category:
        print(f"  Category: {args.category}")
    if args.player:
        print(f"  Player: {args.player}")
    if args.top:
        print(f"  Top: {args.top}")
    print()

    # Optional LLM router
    router = None
    if WITH_LLM:
        try:
            from lib.llm_router import LLMRouter
            router = LLMRouter(verbose=True)
            print("  LLM router initialized\n")
        except Exception as e:
            print(f"  ⚠ LLM router failed: {e} — falling back to template-only\n")

    conn = get_conn()
    results = {}

    categories = [args.category] if args.category else ["players", "archetypes", "clubs", "tactics"]

    for cat in categories:
        print(f"── Phase: {cat.title()} ─────────────────────────")

        if cat == "players" and conn:
            results[cat] = compile_players(conn, router)
        elif cat == "archetypes":
            results[cat] = compile_archetypes(conn)  # works without DB
        elif cat == "clubs" and conn:
            results[cat] = compile_clubs(conn)
        elif cat == "tactics":
            results[cat] = compile_tactics()
        else:
            if not conn and cat not in ("tactics", "archetypes"):
                print(f"  ⚠ Skipping {cat} — no DB connection")
            results[cat] = 0

        print(f"  → {results.get(cat, 0)} articles compiled\n")

    # Mark step complete
    if conn and not DRY_RUN:
        try:
            from lib.incremental import mark_step_complete
            total = sum(results.values())
            mark_step_complete(conn, "kb_compile", total)
        except Exception:
            pass

    if conn:
        conn.close()

    # Summary
    print("── Summary ────────────────────────────────────────────")
    for cat, count in results.items():
        print(f"  {cat}: {count} articles")
    total = sum(results.values())
    print(f"  Total: {total} articles {'(dry run)' if DRY_RUN else 'compiled'}")

    if WITH_LLM and router:
        router.print_stats()


if __name__ == "__main__":
    main()
