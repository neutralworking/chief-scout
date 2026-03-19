"""
33_gemini_profiles.py — Gemini-powered player profiling for top 5 leagues.

Uses Gemini Flash to assign realistic levels and write scouting bios for
players who don't have scout-assessed profiles.

Groups players by club, sends squad batches to Gemini with context,
gets back levels (1-99) and 1-2 sentence scouting bios.

--bio-only mode (auto-enabled with --prod-ready) sends rich structured
context (grades, archetype, personality) and asks for bio-only output,
producing higher-quality scouting prose at lower token cost.

Usage:
    python 33_gemini_profiles.py --dry-run              # preview without writing
    python 33_gemini_profiles.py --league "Premier League"  # single league
    python 33_gemini_profiles.py --club "Arsenal"       # single club
    python 33_gemini_profiles.py --limit 5              # max clubs to process
    python 33_gemini_profiles.py --force                # overwrite existing profiles
    python 33_gemini_profiles.py --skip-seed            # skip seed players (keep manual levels)
    python 33_gemini_profiles.py --prod-ready           # prod-ready players, bio-only
    python 33_gemini_profiles.py --bio-only             # write scouting_notes only, never touch level
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
parser.add_argument("--prod-ready", action="store_true", help="Only process players one step from prod-ready (have all data except notes)")
parser.add_argument("--bio-only", action="store_true", help="Write scouting_notes only, never touch level")
args = parser.parse_args()

# --prod-ready implies --bio-only (these players already have levels)
if args.prod_ready:
    args.bio_only = True

DRY_RUN = args.dry_run
FORCE = args.force
BIO_ONLY = args.bio_only

TOP5 = ("Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1")

# ── Personality type mapping ──────────────────────────────────────────────
PERSONALITY_TYPES = {
    "ANLC": "The General", "ANSC": "The Machine", "ANLP": "The Conductor",
    "ANSP": "The Professor", "INLC": "The Captain", "INSC": "The Mamba",
    "INSP": "The Maestro", "INLP": "The Guardian", "AXLC": "The Catalyst",
    "AXSC": "The Enforcer", "AXSP": "The Technician", "AXLP": "The Orchestrator",
    "IXSC": "The Maverick", "IXSP": "The Spark", "IXLC": "The Livewire",
    "IXLP": "The Playmaker",
}

# ── Prompts ───────────────────────────────────────────────────────────────

GEMINI_PROMPT = """You are a top-level football scout writing for a discerning audience. Think James Richardson's tone — warm but incisive, deeply knowledgeable, never bland. Your scouting notes should read like a football obsessive talking to another football obsessive.

Club: {club_name} ({league})

For each player, provide:
- **level**: Current ability rating 1-99. This is how good they are RIGHT NOW — current form and role, not reputation or age.

CALIBRATION ANCHORS (2025-26 season):
  95+ Generational peak (prime Messi/Ronaldo tier — almost nobody active)
  93-94 Best in the world at their position (Haaland, Mbappé, Vinicius Jr.)
  91-92 Ballon d'Or contender, top 10-15 globally (Salah, Rodri, Bellingham)
  89-90 World class — elite international starter, top-club cornerstone (Saka, Rice, Saliba, Pedri)
  87-88 Excellent — regular international, key player at a big club (Havertz, Madueke, Calafiori)
  84-86 Very good — nailed-on starter at a top-5 league club, or breakout young talent playing senior international football (Lewis-Skelly, Nwaneri if playing Europa League level)
  81-83 Good — solid top-5 league starter, dependable (Merino, Trossard)
  78-80 Decent — squad rotation at a big club, or starter at a mid/lower table side
  74-77 Functional — depth option, or lower-league quality starter
  70-73 Fringe — backup, young prospect not yet at senior level, or lower-league regular
  65-69 Developing — academy graduate getting minutes, lower-division
  60-64 Raw — youth player with potential but limited senior exposure
  Below 60 Youth/amateur — no meaningful senior football yet

KEY: If a young player is PLAYING regular senior football at a high level (international caps, European competition), rate them on what they're doing NOW, not their age. A teenager starting in the Europa League is not a 58.

- **bio**: 2-3 sentences of scouting insight. Be specific about what the player DOES — how they move, where they operate, what they offer that others don't. Name a weakness. Use proper football language (half-spaces, progressive carries, inverted runs, etc.). Avoid generic praise. Every sentence must end with proper punctuation. Write complete, grammatically correct sentences.

Players to rate:
{player_list}

CRITICAL RULES:
- Rate on CURRENT ability and form, not age or reputation. A 19-year-old England international is 84+, not 65.
- Do NOT be overly conservative. Use the full scale. A key player at a title-challenging club is 87+, not 84.
- Lower-division, women's league, or reserve players at these clubs: rate them honestly, typically 60-75.
- The bio must be OPINIONATED. Say what a player can't do, not just what they can. "Lovely on the ball but you wouldn't want him defending a set piece" is better than "talented midfielder with good passing."
- Proper punctuation throughout. Every sentence ends with a full stop.

Respond as a JSON array, one object per player, same order as input:
[
  {{"name": "Player Name", "level": 85, "bio": "Scouting report here."}},
  ...
]

JSON only, no markdown fences, no commentary.
"""

BIO_PROMPT = """You are a top-level football scout writing for a discerning audience. Think James Richardson — warm but incisive, never bland.

Club: {club_name} ({league})

For each player below, write a 2-3 sentence scouting bio based on the data provided.

RULES:
- Use the attribute grades to identify specific strengths and weaknesses
- Reference the archetype and playing style naturally
- Name at least one weakness per player
- Use proper football language (half-spaces, progressive carries, inverted runs)
- Be OPINIONATED — say what they can't do, not just what they can
- Do NOT assign or suggest levels — these are already set
- Proper punctuation throughout. Every sentence ends with a full stop.

Players:
{player_list}

Respond as JSON array:
[{{"name": "Player Name", "bio": "Scouting report here."}}, ...]
JSON only, no markdown fences.
"""

BATCH_SIZE = 25  # Players per LLM call
INTER_CLUB_DELAY = 4  # Seconds between clubs (Groq free tier: 30 RPM)


def fetch_player_grades(cur, player_ids: list[int]) -> dict[int, list[tuple]]:
    """Fetch grades per player. Returns {pid: [(attr, score), ...]} sorted desc."""
    if not player_ids:
        return {}

    cur.execute("""
        SELECT ag.player_id, ag.attribute,
               COALESCE(ag.scout_grade, ag.stat_score) as score
        FROM attribute_grades ag
        WHERE ag.player_id = ANY(%s)
          AND COALESCE(ag.scout_grade, ag.stat_score) IS NOT NULL
        ORDER BY ag.player_id, COALESCE(ag.scout_grade, ag.stat_score) DESC
    """, (player_ids,))

    grades: dict[int, list[tuple]] = defaultdict(list)
    seen: dict[int, set] = defaultdict(set)
    for row in cur.fetchall():
        pid = row["player_id"]
        attr = row["attribute"]
        # Keep best score per attribute per player
        if attr not in seen[pid]:
            seen[pid].add(attr)
            grades[pid].append((attr, round(row["score"])))

    return dict(grades)


def call_llm_squad(router, club_name: str, league: str, players: list[dict],
                   bio_only: bool = False, grades_map: dict | None = None) -> list[dict] | None:
    """Call LLM router to profile a squad batch. Returns list of dicts or None."""
    player_lines = []
    for p in players:
        if bio_only and grades_map is not None:
            # Enriched format with grades + personality + archetype
            line = f"- {p['name']} ({p.get('position', '?')}) age {p.get('age', '?')} from {p.get('nation', '?')}"
            line += f" | Club: {club_name}"
            line += f"\n  L{p.get('current_level', '?')} OVR{p.get('overall', '?')}"
            if p.get("archetype"):
                line += f" | Archetype: {p['archetype']}"
            if p.get("blueprint"):
                line += f" | Blueprint: {p['blueprint']}"
            if p.get("best_role"):
                line += f" | Best role: {p['best_role']}"
            # Personality
            if p.get("personality_code"):
                ptype = PERSONALITY_TYPES.get(p["personality_code"], p["personality_code"])
                line += f"\n  Personality: {ptype} ({p['personality_code']})"
                if p.get("competitiveness") is not None:
                    line += f" | Comp: {p['competitiveness']}/10"
                if p.get("coachability") is not None:
                    line += f" | Coach: {p['coachability']}/10"
            # Grades
            pid = p["id"]
            player_grades = grades_map.get(pid, [])
            if player_grades:
                top = player_grades[:5]
                bottom = [g for g in player_grades if g[1] <= 4][:3]
                if not bottom:
                    bottom = player_grades[-3:] if len(player_grades) >= 3 else player_grades[-len(player_grades):]
                strengths = ", ".join(f"{a}={s}" for a, s in top)
                line += f"\n  Strengths: {strengths}"
                weaknesses = ", ".join(f"{a}={s}" for a, s in bottom)
                line += f"\n  Weaknesses: {weaknesses}"
            player_lines.append(line)
        else:
            # Legacy format
            parts = [f"- {p['name']}"]
            if p.get("position"):
                parts.append(f"({p['position']})")
            if p.get("age"):
                parts.append(f"age {p['age']}")
            if p.get("nation"):
                parts.append(f"from {p['nation']}")
            player_lines.append(" ".join(parts))

    prompt_template = BIO_PROMPT if bio_only else GEMINI_PROMPT
    prompt = prompt_template.format(
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
    if isinstance(parsed, dict):
        # Groq json_mode wraps in an object — look for array inside
        for v in parsed.values():
            if isinstance(v, list):
                return v
        # Single player returned as a flat dict with name/bio (or name/level/bio)
        if "name" in parsed and ("bio" in parsed or "level" in parsed):
            return [parsed]
    return None


def main():
    import psycopg2
    import psycopg2.extras
    from datetime import date
    from lib.llm_router import LLMRouter

    mode_label = "bio-only" if BIO_ONLY else "level+bio"
    print(f"33 — LLM Player Profiling (via router) [{mode_label}]")

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

    # ── Load players grouped by club ────────────────────────────────────
    all_leagues = args.league and args.league.lower() == "all"
    prod_ready_mode = args.prod_ready
    league_filter = None if (all_leagues or prod_ready_mode) else ((args.league,) if args.league else TOP5)
    club_filter = args.club

    if prod_ready_mode:
        # Only fetch players that have ALL prod data except scouting_notes
        # Extended to include personality + best_role for enriched prompts
        query = """
            SELECT pe.id, pe.name, pp.position, pp.level, pp.archetype,
                   pp.blueprint, pp.best_role, pp.overall,
                   pe.date_of_birth, c.clubname, c.league_name,
                   n.name as nation_name,
                   ps.scouting_notes,
                   pn.ei_score, pn.sn_score, pn.tf_score, pn.jp_score,
                   pn.competitiveness, pn.coachability
            FROM people pe
            JOIN clubs c ON c.id = pe.club_id
            JOIN player_profiles pp ON pp.person_id = pe.id
            LEFT JOIN player_status ps ON ps.person_id = pe.id
            LEFT JOIN nations n ON n.id = pe.nation_id
            JOIN player_personality pn ON pn.person_id = pe.id
            JOIN player_market pm ON pm.person_id = pe.id
            WHERE pe.active = true
            AND pe.name IS NOT NULL AND pe.date_of_birth IS NOT NULL
            AND pp.position IS NOT NULL AND pp.archetype IS NOT NULL
            AND pp.blueprint IS NOT NULL AND pp.level IS NOT NULL AND pp.overall IS NOT NULL
            AND pm.market_value_tier IS NOT NULL
            AND (ps.scouting_notes IS NULL OR LENGTH(ps.scouting_notes) <= 20)
        """
        params: list = []
    else:
        query = """
            SELECT pe.id, pe.name, pp.position, pp.level, pp.archetype,
                   pp.blueprint, pp.best_role, pp.overall,
                   pe.date_of_birth, c.clubname, c.league_name,
                   n.name as nation_name,
                   ps.scouting_notes,
                   pn.ei_score, pn.sn_score, pn.tf_score, pn.jp_score,
                   pn.competitiveness, pn.coachability
            FROM people pe
            JOIN clubs c ON c.id = pe.club_id
            LEFT JOIN player_profiles pp ON pp.person_id = pe.id
            LEFT JOIN player_status ps ON ps.person_id = pe.id
            LEFT JOIN nations n ON n.id = pe.nation_id
            LEFT JOIN player_personality pn ON pn.person_id = pe.id
            WHERE pe.active = true
        """
        params: list = []
        if not all_leagues:
            query += " AND c.league_name IN %s"
            params.append(league_filter)
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

    # ── Batch-fetch grades for all players (bio-only mode) ────────────
    grades_map: dict[int, list[tuple]] = {}
    if BIO_ONLY:
        all_pids = [p["id"] for ps in clubs_to_process.values() for p in ps]
        grades_map = fetch_player_grades(cur, all_pids)
        graded = sum(1 for pid in all_pids if pid in grades_map)
        print(f"  Grades loaded for {graded:,}/{len(all_pids):,} players")

    # ── Process clubs ────────────────────────────────────────────────────
    today = date.today()
    total_updated = 0
    total_errors = 0

    for club_idx, ((club_name, league), players) in enumerate(sorted(clubs_to_process.items())):
        print(f"\n  [{club_idx+1}/{len(clubs_to_process)}] {club_name} ({league}) — {len(players)} players")
        router.reset_disabled()  # re-enable providers that hit rate limits on previous club

        # Prepare player data
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

            entry = {
                "id": p["id"],
                "name": p["name"],
                "position": p["position"],
                "age": age,
                "nation": p["nation_name"],
                "current_level": p["level"],
            }

            # Add enriched fields for bio-only mode
            if BIO_ONLY:
                entry["archetype"] = p.get("archetype")
                entry["blueprint"] = p.get("blueprint")
                entry["best_role"] = p.get("best_role")
                entry["overall"] = p.get("overall")
                entry["competitiveness"] = p.get("competitiveness")
                entry["coachability"] = p.get("coachability")
                # Derive personality code from MBTI scores
                ei = p.get("ei_score")
                sn = p.get("sn_score")
                tf = p.get("tf_score")
                jp = p.get("jp_score")
                if all(v is not None for v in [ei, sn, tf, jp]):
                    code = ""
                    code += "A" if ei >= 6 else ("I" if ei <= 4 else "X" if ei == 5 else "I")
                    code += "N" if sn >= 6 else "X" if sn == 5 else "S"
                    code += "L" if tf >= 6 else "S" if tf <= 4 else "X" if tf == 5 else "S"
                    code += "C" if jp >= 6 else "P" if jp <= 4 else "P"
                    entry["personality_code"] = code

            player_data.append(entry)

        # Process in batches if large squad
        all_results = []
        for i in range(0, len(player_data), BATCH_SIZE):
            batch = player_data[i:i + BATCH_SIZE]
            if i > 0:
                time.sleep(1)  # Small delay between batches

            results = call_llm_squad(router, club_name, league, batch,
                                     bio_only=BIO_ONLY, grades_map=grades_map)
            if not results:
                print(f"    WARN: No results for batch {i//BATCH_SIZE + 1} — waiting 30s before retry")
                time.sleep(30)
                router.reset_disabled()
                results = call_llm_squad(router, club_name, league, batch,
                                         bio_only=BIO_ONLY, grades_map=grades_map)
            if not results:
                print(f"    ERROR: Still no results for batch {i//BATCH_SIZE + 1}, skipping")
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
            bio = result.get("bio", "")

            if BIO_ONLY:
                # Bio-only mode: skip level validation/upsert entirely
                if not bio or len(bio) < 10:
                    print(f"    SKIP {player_info['name']}: empty/short bio")
                    continue

                if DRY_RUN:
                    print(f"    {player_info['name']:30} {bio[:80]}...")
                    total_updated += 1
                    continue

                # Upsert player_status (scouting_notes only)
                cur.execute("""
                    INSERT INTO player_status (person_id, scouting_notes)
                    VALUES (%s, %s)
                    ON CONFLICT (person_id) DO UPDATE SET scouting_notes = %s
                """, (pid, bio, bio))
                total_updated += 1

            else:
                # Legacy mode: level + bio
                new_level = result.get("level")

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
