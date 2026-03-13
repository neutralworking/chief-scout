"""
33_gemini_profiles.py — Gemini-powered player profiling for top 5 leagues.

Uses Gemini Flash to assign realistic levels and write scouting bios for
players who don't have scout-assessed profiles.

Groups players by club, sends squad batches to Gemini with context,
gets back levels (1-99) and 1-2 sentence scouting bios.

Usage:
    python 33_gemini_profiles.py --dry-run              # preview without writing
    python 33_gemini_profiles.py --league "Premier League"  # single league
    python 33_gemini_profiles.py --club "Arsenal"       # single club
    python 33_gemini_profiles.py --limit 5              # max clubs to process
    python 33_gemini_profiles.py --force                # overwrite existing profiles
    python 33_gemini_profiles.py --skip-seed            # skip seed players (keep manual levels)
"""
from __future__ import annotations

import argparse
import time
from collections import defaultdict

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="LLM-powered player profiling")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--league", default=None, help="Single league to process")
parser.add_argument("--club", default=None, help="Single club to process")
parser.add_argument("--limit", type=int, default=None, help="Max clubs to process")
parser.add_argument("--force", action="store_true", help="Overwrite existing scout-assessed profiles")
parser.add_argument("--skip-seed", action="store_true", help="Skip manually seeded players")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force

TOP5 = ("Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1")

GEMINI_PROMPT = """You are a professional football scout. Rate each player in this squad.

Club: {club_name} ({league})

For each player, provide:
- **level**: Current ability rating 1-99 using this scale:
  - 93-99: Generational (Mbappé, Haaland tier)
  - 90-92: World class (top 30 players globally)
  - 87-89: Elite (international starter, top club key player)
  - 84-86: Very good (solid top-5 league starter)
  - 80-83: Good (regular starter at mid-table top-5 league club)
  - 75-79: Decent (squad player at top-5 league club, or lower-league starter)
  - 70-74: Below average for top-5 leagues (backup, young prospect, or lower-league)
  - 60-69: Developing / lower division quality
  - Below 60: Youth / amateur
- **bio**: 1-2 sentence scouting report. What makes this player distinctive? Playing style, strengths, weaknesses, trajectory. Be specific and opinionated — not generic.

Players to rate:
{player_list}

IMPORTANT:
- Use the FULL scale. Most top-5 league starters should be 80-86. Only genuinely elite players get 87+.
- Be honest about lower-division or women's league players who happen to be at these clubs — rate them appropriately, typically 60-75.
- Youth/reserve players should be 55-72 depending on potential.
- The bio should sound like a real scout, not a Wikipedia summary. Focus on what they DO on the pitch.

Respond with a JSON array, one object per player, in the same order:
[
  {{"name": "Player Name", "level": 85, "bio": "Scouting report here."}},
  ...
]

JSON only, no markdown fences, no extra text.
"""

BATCH_SIZE = 25  # Players per LLM call
INTER_CLUB_DELAY = 2  # Seconds between clubs (lower with router fallback)


def call_llm_squad(router, club_name: str, league: str, players: list[dict]) -> list[dict] | None:
    """Call LLM router to profile a squad batch. Returns list of dicts or None."""
    player_lines = []
    for p in players:
        parts = [f"- {p['name']}"]
        if p.get("position"):
            parts.append(f"({p['position']})")
        if p.get("age"):
            parts.append(f"age {p['age']}")
        if p.get("nation"):
            parts.append(f"from {p['nation']}")
        player_lines.append(" ".join(parts))

    prompt = GEMINI_PROMPT.format(
        club_name=club_name,
        league=league,
        player_list="\n".join(player_lines),
    )

    result = router.call(prompt, json_mode=True)
    if result is None:
        return None

    parsed = result.parsed
    if isinstance(parsed, list):
        return parsed
    # Groq json_mode wraps in an object — look for array inside
    if isinstance(parsed, dict):
        for v in parsed.values():
            if isinstance(v, list):
                return v
    return None


def main():
    import psycopg2
    import psycopg2.extras
    from datetime import date
    from lib.llm_router import LLMRouter

    print("33 — LLM Player Profiling (via router)")

    router = LLMRouter(verbose=True)
    if not router.available_providers():
        print("  ERROR: No LLM providers configured. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY")
        return
    print(f"  Providers: {', '.join(router.available_providers())}")

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Load seed player IDs (to optionally skip) ────────────────────────
    seed_ids = set()
    if args.skip_seed:
        # Players with scouting_notes are considered manually profiled
        cur.execute("""
            SELECT person_id FROM player_status
            WHERE scouting_notes IS NOT NULL AND scouting_notes != ''
        """)
        seed_ids = {row["person_id"] for row in cur.fetchall()}
        print(f"  Skipping {len(seed_ids)} seed/profiled players")

    # ── Load top 5 league players grouped by club ────────────────────────
    league_filter = (args.league,) if args.league else TOP5
    club_filter = args.club

    query = """
        SELECT pe.id, pe.name, pp.position, pp.level, pp.archetype,
               pe.date_of_birth, c.clubname, c.league_name,
               n.name as nation_name,
               ps.scouting_notes
        FROM people pe
        JOIN clubs c ON c.id = pe.club_id
        LEFT JOIN player_profiles pp ON pp.person_id = pe.id
        LEFT JOIN player_status ps ON ps.person_id = pe.id
        LEFT JOIN nations n ON n.id = pe.nation_id
        WHERE c.league_name IN %s AND pe.active = true
    """
    params: list = [league_filter]
    if club_filter:
        query += " AND c.clubname = %s"
        params.append(club_filter)
    query += " ORDER BY c.league_name, c.clubname, pe.name"

    cur.execute(query, params)
    all_players = cur.fetchall()
    print(f"  {len(all_players):,} players in scope")

    # Group by club
    clubs: dict[str, list[dict]] = defaultdict(list)
    for p in all_players:
        clubs[(p["clubname"], p["league_name"])].append(p)

    print(f"  {len(clubs)} clubs")

    # Filter: skip players who already have good profiles (unless --force)
    clubs_to_process = {}
    for (club, league), players in sorted(clubs.items()):
        needs_work = []
        for p in players:
            pid = p["id"]
            if pid in seed_ids:
                continue
            if not FORCE:
                # Skip if already has a bio
                if p["scouting_notes"] and len(p["scouting_notes"]) > 20:
                    continue
            needs_work.append(p)
        if needs_work:
            clubs_to_process[(club, league)] = needs_work

    total_players = sum(len(ps) for ps in clubs_to_process.values())
    print(f"  {len(clubs_to_process)} clubs need profiling ({total_players:,} players)")

    if args.limit:
        items = list(clubs_to_process.items())[:args.limit]
        clubs_to_process = dict(items)
        total_players = sum(len(ps) for ps in clubs_to_process.values())
        print(f"  Limited to {len(clubs_to_process)} clubs ({total_players:,} players)")

    if not clubs_to_process:
        print("  Nothing to do.")
        conn.close()
        return

    # ── Process clubs ────────────────────────────────────────────────────
    today = date.today()
    total_updated = 0
    total_errors = 0

    for (club_name, league), players in sorted(clubs_to_process.items()):
        print(f"\n  {club_name} ({league}) — {len(players)} players")

        # Prepare player data for Gemini
        player_data = []
        for p in players:
            age = None
            if p["date_of_birth"]:
                try:
                    dob = p["date_of_birth"]
                    if hasattr(dob, 'year'):
                        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                    else:
                        from datetime import date as d
                        dob = d.fromisoformat(str(dob)[:10])
                        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
                except (ValueError, TypeError):
                    pass
            player_data.append({
                "id": p["id"],
                "name": p["name"],
                "position": p["position"],
                "age": age,
                "nation": p["nation_name"],
                "current_level": p["level"],
            })

        # Process in batches if large squad
        all_results = []
        for i in range(0, len(player_data), BATCH_SIZE):
            batch = player_data[i:i + BATCH_SIZE]
            if i > 0:
                time.sleep(1)  # Small delay between batches

            results = call_llm_squad(router, club_name, league, batch)
            if not results:
                print(f"    ERROR: Gemini returned nothing for batch {i//BATCH_SIZE + 1}")
                total_errors += len(batch)
                continue

            if len(results) != len(batch):
                print(f"    WARN: Expected {len(batch)} results, got {len(results)}")
                # Try to match by name
                result_map = {r.get("name", "").lower(): r for r in results}
                matched = []
                for pd in batch:
                    key = pd["name"].lower()
                    if key in result_map:
                        matched.append(result_map[key])
                    else:
                        # Try partial match
                        found = False
                        for rname, r in result_map.items():
                            if key in rname or rname in key:
                                matched.append(r)
                                found = True
                                break
                        if not found:
                            matched.append(None)
                results = matched

            all_results.extend(zip(batch, results))

        # ── Apply results ────────────────────────────────────────────
        for player_info, result in all_results:
            if not result:
                continue

            pid = player_info["id"]
            new_level = result.get("level")
            bio = result.get("bio", "")

            if not isinstance(new_level, (int, float)) or new_level < 1 or new_level > 99:
                print(f"    SKIP {player_info['name']}: bad level {new_level}")
                continue

            new_level = int(new_level)

            if DRY_RUN:
                old = player_info["current_level"] or "?"
                print(f"    {player_info['name']:30} L={old}→{new_level}  {bio[:60]}...")
                total_updated += 1
                continue

            # Upsert player_profiles (level)
            cur.execute("""
                INSERT INTO player_profiles (person_id, level)
                VALUES (%s, %s)
                ON CONFLICT (person_id) DO UPDATE SET level = %s, updated_at = NOW()
            """, (pid, new_level, new_level))

            # Upsert player_status (scouting_notes)
            if bio:
                cur.execute("""
                    INSERT INTO player_status (person_id, scouting_notes)
                    VALUES (%s, %s)
                    ON CONFLICT (person_id) DO UPDATE SET scouting_notes = %s
                """, (pid, bio, bio))

            total_updated += 1

        if not DRY_RUN and all_results:
            conn.commit()
            print(f"    Committed {len([r for _, r in all_results if r])} updates")

        # Rate limit between clubs
        time.sleep(INTER_CLUB_DELAY)

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n  Total updated: {total_updated:,}")
    if total_errors:
        print(f"  Errors/skipped: {total_errors:,}")
    if DRY_RUN:
        print("  --dry-run: no writes.")

    router.print_stats()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
