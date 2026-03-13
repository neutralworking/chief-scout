"""
34_fix_levels.py — Fix obviously wrong player levels using heuristics.

Corrects levels that are clearly wrong without needing LLM:
  - Players at L=10-20 who are at top clubs (pipeline bug)
  - Youth/reserve/women's players incorrectly rated 80+
  - Known world-class players with too-low levels
  - Lower-league players with too-high levels

Does NOT write scouting bios — that's 33_gemini_profiles.py.

Usage:
    python 34_fix_levels.py --dry-run    # preview
    python 34_fix_levels.py              # apply fixes
"""
from __future__ import annotations

import argparse
from collections import defaultdict

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Fix obviously wrong player levels")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run

# ── Club tier mapping ────────────────────────────────────────────────────────
# Used to sanity-check levels — a starter at Man City should not be L=14
CLUB_TIERS = {
    # Tier 1: Elite (starters typically 85-93)
    1: {
        "Arsenal", "Liverpool", "Manchester City", "Chelsea", "Real Madrid",
        "Barcelona", "Bayern Munich", "Paris Saint-Germain", "Inter Milan",
        "Manchester United",
    },
    # Tier 2: Strong (starters typically 82-88)
    2: {
        "Tottenham Hotspur", "Aston Villa", "Newcastle United", "Borussia Dortmund",
        "Bayer Leverkusen", "Atlético Madrid", "Juventus", "AC Milan", "Napoli",
        "Atalanta", "AS Monaco", "RB Leipzig",
    },
    # Tier 3: Good (starters typically 78-84)
    3: {
        "Brighton", "Nottingham Forest", "Bournemouth", "Fulham", "West Ham United",
        "Crystal Palace", "Brentford", "Wolverhampton Wanderers", "Everton",
        "Athletic Bilbao", "Real Sociedad", "Villarreal", "Real Betis", "Sevilla",
        "Freiburg", "Stuttgart", "Wolfsburg", "Eintracht Frankfurt", "Mainz 05",
        "Roma", "Lazio", "Fiorentina", "Bologna", "Lille", "Lyon", "Marseille",
        "Lens", "Rennes", "Girona", "Celta Vigo",
    },
    # Tier 4: Mid-table (starters typically 74-80)
    4: {
        "Ipswich Town", "Leicester City", "Southampton", "Leeds United",
        "Sunderland", "Middlesbrough", "Norwich City", "Burnley", "Sheffield United",
        "Alavés", "Leganes", "Valladolid", "Getafe", "Osasuna", "Mallorca",
        "Rayo Vallecano", "Espanyol", "Las Palmas", "Valencia",
        "Augsburg", "TSG Hoffenheim", "Werder Bremen", "Bochum", "Heidenheim",
        "Darmstadt", "Schalke", "1. FC Köln", "Borussia Mönchengladbach",
        "Monza", "Cagliari", "Empoli", "Parma", "Lecce", "Venezia FC",
        "Hellas Verona", "Como", "Udinese", "Genoa", "Torino",
        "Nantes", "Montpellier", "Strasbourg", "Toulouse", "Nice",
        "Brest", "Reims", "Angers", "Le Havre", "Auxerre", "Saint-Etienne",
    },
}

# Invert to club → tier
CLUB_TO_TIER = {}
for tier, clubs in CLUB_TIERS.items():
    for club in clubs:
        CLUB_TO_TIER[club] = tier

# Level floor by club tier (a starter at this tier should be AT LEAST this level)
TIER_FLOOR = {1: 78, 2: 75, 3: 72, 4: 70}
# Level ceiling for non-elite players at lower tiers
TIER_CEILING = {3: 87, 4: 84}

# Women's team indicators
WOMENS_INDICATORS = {"Women", "WFC", "Femení", "Féminin", "Frauen"}


def is_womens_team(club_name: str) -> bool:
    return any(ind in club_name for ind in WOMENS_INDICATORS)


def main():
    import psycopg2
    import psycopg2.extras

    print("34 — Fix Player Levels")

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # ── Load all players with levels ─────────────────────────────────────
    cur.execute("""
        SELECT pe.id, pe.name, pp.level, pp.peak, pp.overall, pp.position, pp.archetype,
               c.clubname, c.league_name, pe.date_of_birth,
               ps.scouting_notes
        FROM people pe
        JOIN clubs c ON c.id = pe.club_id
        LEFT JOIN player_profiles pp ON pp.person_id = pe.id
        LEFT JOIN player_status ps ON ps.person_id = pe.id
        WHERE pe.active = true
    """)
    players = cur.fetchall()
    print(f"  {len(players):,} active players with clubs")

    # ── Load seed player IDs (manually curated — don't touch) ────────────
    cur.execute("""
        SELECT person_id FROM player_status
        WHERE scouting_notes IS NOT NULL AND scouting_notes != ''
          AND scouting_notes NOT LIKE '```%'
          AND scouting_notes NOT LIKE '%Tactical Attributes%'
          AND LENGTH(scouting_notes) > 30
    """)
    good_bio_ids = {row["person_id"] for row in cur.fetchall()}
    print(f"  {len(good_bio_ids)} players with good bios (protected)")

    fixes: list[tuple[int, int, str]] = []  # (pid, new_level, reason)
    nulls: list[tuple[int, str]] = []  # (pid, reason) — set level to NULL

    for p in players:
        pid = p["id"]
        level = p["level"]
        club = p["clubname"]
        league = p["league_name"]
        name = p["name"]
        peak = p.get("peak")

        tier = CLUB_TO_TIER.get(club)

        # ── Fix 0: Garbage levels — year suffixes from RSG import ────────
        # Levels < 30 are year suffixes (2014→14), not real levels.
        # Null these out so 33_gemini_profiles.py can re-infer via LLM.
        if level and level < 30:
            nulls.append((pid, f"{name} at {club}: L={level}→NULL (year-suffix)"))
            continue

        # Skip players with good bios for remaining heuristic fixes
        if pid in good_bio_ids:
            continue

        # ── Fix 1: Women's team players rated as men's ────────────
        if is_womens_team(club) and level and level > 75:
            # Women's players shouldn't be in the same scale as men's
            # NULL them out — they need separate handling
            nulls.append((pid, f"women's team ({club}) L={level}→NULL"))
            continue

        # ── Fix 3: Lower-league/reserve players rated too high ───
        # DISABLED — too aggressive, catches world-class players at Saudi/Turkish clubs
        # and clubs with wrong league_name data (e.g. Celtic → Cabo Verde)
        # TODO: re-enable with smarter logic once league data is cleaned
        # if level and level >= 85 and not tier:
        #     if league and league not in ("Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1"):
        #         fixes.append((pid, 72, f"{name} at {club} ({league}): L={level}→72 (non-top-5)"))
        #         continue

        # ── Fix 4: Known lower-division English clubs rated too high ──
        LOWER_ENGLISH = {
            "Accrington Stanley", "Burton Albion", "Chesterfield", "Cheltenham Town",
            "Colchester United", "Crewe Alexandra", "Crawley Town", "Doncaster Rovers",
            "Exeter City", "Fleetwood Town", "Forest Green Rovers", "Gillingham",
            "Harrogate Town", "Leyton Orient", "Morecambe", "Milton Keynes Dons",
            "Northampton Town", "Peterborough United", "Port Vale", "Salford City",
            "Shrewsbury Town", "Stevenage", "Stockport County", "Tranmere Rovers",
            "Walsall", "Bradford City", "Cambridge United", "Carlisle United",
            "Charlton Athletic", "Rotherham", "Blackpool",
        }
        if club in LOWER_ENGLISH and level and level > 75:
            fixes.append((pid, 70, f"{name} at {club}: L={level}→70 (lower division)"))
            continue

        # ── Fix 5: Tier 4 clubs with L=85+ ───────────────────────
        if tier == 4 and level and level >= 85:
            fixes.append((pid, 78, f"{name} at {club}: L={level}→78 (tier 4 club cap)"))
            continue

        # ── Fix 6: Tier 3 clubs with L=88+ ───────────────────────
        if tier == 3 and level and level >= 88:
            fixes.append((pid, 82, f"{name} at {club}: L={level}→82 (tier 3 club cap)"))
            continue

    # ── Summary ──────────────────────────────────────────────────────────
    print(f"\n  Level fixes: {len(fixes):,}")
    print(f"  Level nulls (women's): {len(nulls):,}")

    if DRY_RUN:
        print("\n  Sample fixes:")
        for pid, new_level, reason in fixes[:40]:
            print(f"    {reason}")
        if nulls:
            print(f"\n  Sample nulls:")
            for pid, reason in nulls[:10]:
                print(f"    {reason}")
        print("\n  --dry-run: no writes.")
        conn.close()
        return

    # ── Apply fixes ──────────────────────────────────────────────────────
    for pid, new_level, reason in fixes:
        cur.execute("""
            UPDATE player_profiles SET level = %s, updated_at = NOW()
            WHERE person_id = %s
        """, (new_level, pid))

    for pid, reason in nulls:
        cur.execute("""
            UPDATE player_profiles SET level = NULL, updated_at = NOW()
            WHERE person_id = %s
        """, (pid,))

    conn.commit()
    print(f"\n  Applied {len(fixes) + len(nulls):,} fixes")

    # ── Also clean up garbage bios ───────────────────────────────────────
    cur.execute("""
        UPDATE player_status SET scouting_notes = NULL
        WHERE scouting_notes LIKE '```%'
           OR scouting_notes LIKE '%Tactical Attributes%'
           OR scouting_notes LIKE '%Position%:%Age%:%Height%'
    """)
    cleaned_bios = cur.rowcount
    if cleaned_bios:
        conn.commit()
        print(f"  Cleaned {cleaned_bios} garbage bios")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
