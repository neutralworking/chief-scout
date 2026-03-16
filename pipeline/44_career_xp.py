"""
44_career_xp.py — Career Experience (XP) milestones → player_xp table + xp_modifier.

Detects career milestones (trophies, international caps, loyalty, instability)
from existing data and writes additive XP modifiers that adjust effective_score
in the valuation engine.

Usage:
    python 44_career_xp.py                  # all players with career data
    python 44_career_xp.py --player ID      # single player
    python 44_career_xp.py --limit 50       # first 50 players
    python 44_career_xp.py --dry-run        # preview without writing
    python 44_career_xp.py --force          # overwrite existing rows

Requires migration: 031_career_xp.sql
"""
import argparse
import json
import sys
from decimal import Decimal
from datetime import datetime, timezone, date

from supabase import create_client

from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Compute career XP milestones")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id to process")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to process")
parser.add_argument("--dry-run", action="store_true",
                    help="Print summaries without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing rows")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
CHUNK_SIZE = 200

# ── Connections ────────────────────────────────────────────────────────────────

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env")
    sys.exit(1)
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
sb_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ── Award classification (tiered) ─────────────────────────────────────────────

# Career-defining team trophies (+5)
ELITE_TROPHIES = {
    "UEFA Champions League", "FIFA World Cup",
}

# Major team trophies (+3)
MAJOR_TROPHIES = {
    "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1",
    "UEFA Europa League", "UEFA European Championship", "Copa América",
    "Africa Cup of Nations", "Copa Libertadores",
}

# Minor team trophies (+1)
MINOR_TROPHIES = {
    "FA Cup", "EFL Cup", "League Cup", "Copa del Rey", "Coppa Italia",
    "DFB-Pokal", "Coupe de France", "Trophée des Champions",
    "DFL-Supercup", "Supercoppa Italiana", "Supercopa de España",
    "FA Community Shield", "UEFA Europa Conference League",
    "UEFA Super Cup", "FIFA Club World Cup", "Intercontinental Cup",
    "AFC Asian Cup", "CONCACAF Gold Cup", "UEFA Nations League",
    "Eredivisie", "Primeira Liga", "Süper Lig", "Scottish Premiership",
    "MLS Cup", "Copa Sudamericana", "CAF Champions League",
    "English Football League Championship",
}

ALL_TROPHIES = ELITE_TROPHIES | MAJOR_TROPHIES | MINOR_TROPHIES

# Career-defining individual honours (+5)
ELITE_INDIVIDUAL = {
    "Ballon d'Or", "FIFA World Player of the Year", "The Best FIFA Men's Player",
    "FIFA World Cup Golden Ball",
}

# Major individual honours (+3)
MAJOR_INDIVIDUAL = {
    "European Golden Shoe", "Premier League Golden Boot",
    "Pichichi Trophy", "Capocannoniere",
    "UEFA Men's Player of the Year Award", "UEFA Best Player in Europe Award",
    "FIFA World Cup Golden Boot",
    "African Footballer of the Year",
}

# Notable individual honours (+1)
NOTABLE_INDIVIDUAL = {
    "PFA Players' Player of the Year", "PFA Young Player of the Year",
    "FWA Footballer of the Year",
    "Kopa Trophy", "Golden Boy",
    "FIFA Puskás Award",
}

ALL_INDIVIDUAL = ELITE_INDIVIDUAL | MAJOR_INDIVIDUAL | NOTABLE_INDIVIDUAL

# Top-5 leagues for promotion_climber / late_bloomer detection
TOP5_LEAGUES = {
    "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1",
}

# ── Milestone detection ───────────────────────────────────────────────────────

TODAY = date.today()


class _DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def _dumps(obj):
    return json.dumps(obj, cls=_DecimalEncoder)


def _infer_team_type(club_name: str) -> str:
    """Infer team type from club name (no team_type column in career_history)."""
    if not club_name:
        return "senior_club"
    lower = club_name.lower()
    if "national" in lower:
        return "national_team"
    # Youth/reserve patterns like "Club U21", "Club B", "Club II"
    if lower.endswith((" u21", " u20", " u19", " u18", " u17", " u16", " b", " ii", " reserves")):
        return "youth"
    return "senior_club"


def detect_milestones(pid, career_entries, career_metric, person_data,
                      nationalities_count, club_leagues):
    """Detect all applicable milestones for a player. Returns list of milestone dicts."""
    milestones = []
    dob = person_data.get("date_of_birth")

    # Infer team types
    for e in career_entries:
        if "team_type" not in e or e["team_type"] is None:
            e["team_type"] = _infer_team_type(e.get("club_name", ""))

    senior_entries = [
        e for e in career_entries
        if e.get("team_type") == "senior_club" and e.get("start_date")
    ]
    youth_entries = [
        e for e in career_entries
        if e.get("team_type") == "youth" and e.get("club_name")
    ]
    national_entries = [e for e in career_entries if e.get("team_type") == "national_team"]

    def _club_root(name):
        """Extract club root for matching youth → senior (e.g. 'FC Barcelona B' → 'fc barcelona')."""
        if not name:
            return ""
        lower = name.lower().strip()
        for suffix in (" b", " ii", " u21", " u20", " u19", " u18", " u17", " u16", " reserves"):
            if lower.endswith(suffix):
                lower = lower[:-len(suffix)].strip()
        return lower

    def _club_league(entry):
        """Get league for a career entry via club_id lookup."""
        cid = entry.get("club_id")
        if cid and cid in club_leagues:
            return club_leagues[cid]
        return None

    def _is_top5(league):
        return league in TOP5_LEAGUES if league else False

    # ── Senior debut (+1) ────────────────────────────────────────────────
    if senior_entries:
        earliest = min(senior_entries, key=lambda e: e["start_date"])
        milestones.append({
            "milestone_key": "senior_debut",
            "milestone_label": "Senior Debut",
            "xp_value": 1,
            "milestone_date": earliest["start_date"],
            "source": "career_history",
            "details": _dumps({"club": earliest.get("club_name")}),
        })

        # ── Early starter (+2) — senior debut before age 18 ──────────────
        if dob and earliest["start_date"]:
            debut_age = (earliest["start_date"] - dob).days / 365.25
            if debut_age < 18:
                milestones.append({
                    "milestone_key": "early_starter",
                    "milestone_label": "Early Starter",
                    "xp_value": 2,
                    "milestone_date": earliest["start_date"],
                    "source": "career_history",
                    "details": _dumps({"debut_age": round(debut_age, 1), "club": earliest.get("club_name")}),
                })

    # ── Youth academy graduate (+2) — youth at club then senior at same ──
    if youth_entries and senior_entries:
        youth_roots = {_club_root(e["club_name"]) for e in youth_entries}
        for e in senior_entries:
            if _club_root(e.get("club_name")) in youth_roots and not e.get("is_loan"):
                milestones.append({
                    "milestone_key": "youth_academy_grad",
                    "milestone_label": "Academy Graduate",
                    "xp_value": 2,
                    "milestone_date": e.get("start_date"),
                    "source": "career_history",
                    "details": _dumps({"club": e.get("club_name")}),
                })
                break

    # ── International career (+2) ────────────────────────────────────────
    if national_entries:
        teams = list({e["club_name"] for e in national_entries if e.get("club_name")})
        milestones.append({
            "milestone_key": "international_career",
            "milestone_label": "International Career",
            "xp_value": 2,
            "milestone_date": min(
                (e["start_date"] for e in national_entries if e.get("start_date")),
                default=None,
            ),
            "source": "career_history",
            "details": _dumps({"teams": teams}),
        })

    # ── Tiered trophies ──────────────────────────────────────────────────
    awards = person_data.get("awards")
    if awards:
        if isinstance(awards, str):
            try:
                awards = json.loads(awards)
            except (json.JSONDecodeError, TypeError):
                awards = []
        if isinstance(awards, list):
            elite_trophies = []
            major_trophies = []
            minor_trophies = []
            elite_indiv = []
            major_indiv = []
            notable_indiv = []

            for award in awards:
                label = award if isinstance(award, str) else (award.get("label") or award.get("name") or "")
                if label in ELITE_TROPHIES:
                    elite_trophies.append(label)
                elif label in MAJOR_TROPHIES:
                    major_trophies.append(label)
                elif label in MINOR_TROPHIES:
                    minor_trophies.append(label)
                elif label in ELITE_INDIVIDUAL:
                    elite_indiv.append(label)
                elif label in MAJOR_INDIVIDUAL:
                    major_indiv.append(label)
                elif label in NOTABLE_INDIVIDUAL:
                    notable_indiv.append(label)

            # Elite trophies — Champions League / World Cup (+5)
            if elite_trophies:
                milestones.append({
                    "milestone_key": "elite_trophy",
                    "milestone_label": "Elite Trophy Winner",
                    "xp_value": 5,
                    "milestone_date": None,
                    "source": "awards",
                    "details": _dumps({"trophies": elite_trophies[:10]}),
                })
            # Major trophies — top-5 leagues, Europa League, international (+3)
            if major_trophies:
                milestones.append({
                    "milestone_key": "major_trophy",
                    "milestone_label": "Major Trophy Winner",
                    "xp_value": 3,
                    "milestone_date": None,
                    "source": "awards",
                    "details": _dumps({"trophies": major_trophies[:10]}),
                })
            # Minor trophies — domestic cups, super cups, secondary (+1)
            if minor_trophies:
                milestones.append({
                    "milestone_key": "cup_winner",
                    "milestone_label": "Cup Winner",
                    "xp_value": 1,
                    "milestone_date": None,
                    "source": "awards",
                    "details": _dumps({"trophies": minor_trophies[:10]}),
                })

            # Elite individual — Ballon d'Or tier (+5)
            if elite_indiv:
                milestones.append({
                    "milestone_key": "ballon_dor",
                    "milestone_label": "Ballon d'Or Winner",
                    "xp_value": 5,
                    "milestone_date": None,
                    "source": "awards",
                    "details": _dumps({"honours": elite_indiv[:5]}),
                })
            # Major individual — Golden Shoe, UEFA POTY tier (+3)
            if major_indiv:
                milestones.append({
                    "milestone_key": "elite_individual",
                    "milestone_label": "Elite Individual Award",
                    "xp_value": 3,
                    "milestone_date": None,
                    "source": "awards",
                    "details": _dumps({"honours": major_indiv[:5]}),
                })
            # Notable individual — PFA, Golden Boy tier (+1)
            if notable_indiv:
                milestones.append({
                    "milestone_key": "notable_individual",
                    "milestone_label": "Notable Individual Award",
                    "xp_value": 1,
                    "milestone_date": None,
                    "source": "awards",
                    "details": _dumps({"honours": notable_indiv[:5]}),
                })

    # ── Long service (+2) — any single non-loan spell >= 7 years ─────────
    for e in senior_entries:
        if e.get("is_loan"):
            continue
        start = e.get("start_date")
        end = e.get("end_date") or TODAY
        if start:
            years = (end - start).days / 365.25
            if years >= 7:
                milestones.append({
                    "milestone_key": "long_service",
                    "milestone_label": "Long Service",
                    "xp_value": 2,
                    "milestone_date": None,
                    "source": "career_history",
                    "details": _dumps({"club": e.get("club_name"), "years": round(years, 1)}),
                })
                break

    # ── Consecutive seasons (+1) — 5+ years at one club, not one-club ────
    has_one_club = False
    for e in senior_entries:
        if e.get("is_loan"):
            continue
        start = e.get("start_date")
        end = e.get("end_date") or TODAY
        if start:
            years = (end - start).days / 365.25
            if years >= 5:
                # Only award if not already a one-club player (avoid double-counting)
                trajectory = career_metric.get("trajectory") if career_metric else None
                if trajectory == "one-club":
                    has_one_club = True
                elif not has_one_club:
                    milestones.append({
                        "milestone_key": "consecutive_seasons",
                        "milestone_label": "Consecutive Seasons",
                        "xp_value": 1,
                        "milestone_date": None,
                        "source": "career_history",
                        "details": _dumps({"club": e.get("club_name"), "years": round(years, 1)}),
                    })
                break

    # ── Promotion climber (+3) — lower league to top-5 within 5 years ────
    if senior_entries and club_leagues:
        non_top5_entries = [e for e in senior_entries if not _is_top5(_club_league(e))]
        top5_entries = [e for e in senior_entries if _is_top5(_club_league(e))]
        if non_top5_entries and top5_entries:
            first_lower = min(non_top5_entries, key=lambda e: e["start_date"])
            first_top5 = min(top5_entries, key=lambda e: e["start_date"])
            if first_lower["start_date"] < first_top5["start_date"]:
                gap_years = (first_top5["start_date"] - first_lower["start_date"]).days / 365.25
                if gap_years <= 5:
                    milestones.append({
                        "milestone_key": "promotion_climber",
                        "milestone_label": "Promotion Climber",
                        "xp_value": 3,
                        "milestone_date": first_top5["start_date"],
                        "source": "career_history",
                        "details": _dumps({
                            "from_club": first_lower.get("club_name"),
                            "to_club": first_top5.get("club_name"),
                            "years": round(gap_years, 1),
                        }),
                    })

    # ── Late bloomer (+1) — first top-5 league move after age 25 ─────────
    if dob and senior_entries and club_leagues:
        top5_entries = [e for e in senior_entries if _is_top5(_club_league(e))]
        if top5_entries:
            first_top5 = min(top5_entries, key=lambda e: e["start_date"])
            age_at_top5 = (first_top5["start_date"] - dob).days / 365.25
            if age_at_top5 >= 25:
                milestones.append({
                    "milestone_key": "late_bloomer",
                    "milestone_label": "Late Bloomer",
                    "xp_value": 1,
                    "milestone_date": first_top5["start_date"],
                    "source": "career_history",
                    "details": _dumps({"age": round(age_at_top5, 1), "club": first_top5.get("club_name")}),
                })

    # ── Loan success (+1) — loan then permanent move to equal/higher league
    loan_entries = [e for e in senior_entries if e.get("is_loan")]
    if loan_entries and club_leagues:
        for loan in loan_entries:
            loan_end = loan.get("end_date")
            if not loan_end:
                continue
            # Find next permanent move after this loan
            next_perm = [
                e for e in senior_entries
                if not e.get("is_loan") and e.get("start_date")
                and e["start_date"] >= loan_end
                and (e["start_date"] - loan_end).days <= 180  # within 6 months
            ]
            if next_perm:
                next_move = min(next_perm, key=lambda e: e["start_date"])
                loan_league = _club_league(loan)
                next_league = _club_league(next_move)
                if loan_league and next_league and _is_top5(next_league):
                    milestones.append({
                        "milestone_key": "loan_success",
                        "milestone_label": "Loan Success",
                        "xp_value": 1,
                        "milestone_date": next_move["start_date"],
                        "source": "career_history",
                        "details": _dumps({
                            "loan_club": loan.get("club_name"),
                            "signed_by": next_move.get("club_name"),
                        }),
                    })
                    break  # only count once

    # ── Career-metrics-based milestones ───────────────────────────────────
    if career_metric:
        trajectory = career_metric.get("trajectory")
        career_years = career_metric.get("career_years") or 0
        clubs_count = career_metric.get("clubs_count") or 0
        loan_count = career_metric.get("loan_count") or 0
        avg_tenure = career_metric.get("avg_tenure_yrs") or 0

        # One-club loyalty (+1)
        if trajectory == "one-club" and career_years >= 5:
            milestones.append({
                "milestone_key": "one_club_loyalty",
                "milestone_label": "One-Club Loyalty",
                "xp_value": 1,
                "milestone_date": None,
                "source": "career_metrics",
                "details": _dumps({"career_years": career_years}),
            })

        # Multi-league (+1) — 3+ distinct leagues
        leagues_count = career_metric.get("leagues_count") or 0
        if leagues_count >= 3:
            milestones.append({
                "milestone_key": "multi_league",
                "milestone_label": "Multi-League Experience",
                "xp_value": 1,
                "milestone_date": None,
                "source": "career_metrics",
                "details": _dumps({"leagues_count": leagues_count}),
            })

        # Unstable loans (-1)
        if loan_count >= 3:
            milestones.append({
                "milestone_key": "unstable_loans",
                "milestone_label": "Unstable Loan History",
                "xp_value": -1,
                "milestone_date": None,
                "source": "career_metrics",
                "details": _dumps({"loan_count": loan_count}),
            })

        # Excessive moves (-2)
        if clubs_count >= 6 and career_years <= 8:
            milestones.append({
                "milestone_key": "excessive_moves",
                "milestone_label": "Excessive Moves",
                "xp_value": -2,
                "milestone_date": None,
                "source": "career_metrics",
                "details": _dumps({"clubs_count": clubs_count, "career_years": career_years}),
            })

        # Journeyman (-1)
        if trajectory == "journeyman" and avg_tenure < 1.5:
            milestones.append({
                "milestone_key": "journeyman",
                "milestone_label": "Journeyman",
                "xp_value": -1,
                "milestone_date": None,
                "source": "career_metrics",
                "details": _dumps({"avg_tenure_yrs": avg_tenure}),
            })

    # ── Goal scoring milestones ──────────────────────────────────────────
    total_goals = person_data.get("total_goals")
    if total_goals is not None:
        if total_goals >= 100:
            milestones.append({
                "milestone_key": "prolific_scorer",
                "milestone_label": "Prolific Scorer",
                "xp_value": 2,
                "milestone_date": None,
                "source": "people",
                "details": _dumps({"total_goals": total_goals}),
            })
        elif total_goals >= 30:
            milestones.append({
                "milestone_key": "goal_scorer",
                "milestone_label": "Goal Scorer",
                "xp_value": 1,
                "milestone_date": None,
                "source": "people",
                "details": _dumps({"total_goals": total_goals}),
            })

    # ── Dual nationality (+1) ────────────────────────────────────────────
    if nationalities_count >= 2:
        milestones.append({
            "milestone_key": "dual_nationality",
            "milestone_label": "Dual Nationality",
            "xp_value": 1,
            "milestone_date": None,
            "source": "nationalities",
            "details": _dumps({"count": nationalities_count}),
        })

    return milestones


# ── Upsert helpers ─────────────────────────────────────────────────────────────

def chunked_upsert_xp(rows):
    if not rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would upsert {len(rows)} rows into player_xp")
        return len(rows)
    total = 0
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        sb_client.table("player_xp").upsert(
            chunk, on_conflict="person_id,milestone_key"
        ).execute()
        total += len(chunk)
    return total


def update_xp_modifiers(modifier_rows):
    """Update xp_modifier on player_profiles."""
    if not modifier_rows:
        return 0
    if DRY_RUN:
        print(f"  [dry-run] would update {len(modifier_rows)} xp_modifier values")
        return len(modifier_rows)
    total = 0
    for i in range(0, len(modifier_rows), CHUNK_SIZE):
        chunk = modifier_rows[i:i + CHUNK_SIZE]
        for row in chunk:
            sb_client.table("player_profiles").update(
                {"xp_modifier": row["xp_modifier"]}
            ).eq("person_id", row["person_id"]).execute()
            total += 1
    return total


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Career XP Builder")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    cur = conn.cursor()

    # ── Fetch career history ───────────────────────────────────────────────
    where_clauses = []
    params = []

    if args.player:
        where_clauses.append("ch.person_id = %s")
        params.append(int(args.player))

    if not FORCE:
        where_clauses.append("""
            ch.person_id NOT IN (SELECT DISTINCT person_id FROM player_xp)
        """)

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    cur.execute(f"""
        SELECT
            ch.person_id, ch.club_name, ch.club_id, ch.start_date, ch.end_date,
            ch.is_loan, ch.sort_order
        FROM player_career_history ch
        {where_sql}
        ORDER BY ch.person_id, ch.sort_order, ch.start_date
    """, params)
    career_rows = cur.fetchall()
    career_cols = [d[0] for d in cur.description]

    # Group career by player
    career_by_player = {}
    for row in career_rows:
        d = dict(zip(career_cols, row))
        career_by_player.setdefault(d["person_id"], []).append(d)

    # ── Determine player set ──────────────────────────────────────────────
    # Also include players without career history (for goals/awards/nationality)
    if args.player:
        player_ids = [int(args.player)]
    else:
        # All players with career history or with awards/goals
        cur.execute("""
            SELECT DISTINCT id FROM (
                SELECT person_id AS id FROM player_career_history
                UNION
                SELECT id FROM people WHERE awards IS NOT NULL OR total_goals IS NOT NULL
            ) sub
        """)
        player_ids = [r[0] for r in cur.fetchall()]

    if not FORCE and not args.player:
        cur.execute("SELECT DISTINCT person_id FROM player_xp")
        existing = {r[0] for r in cur.fetchall()}
        player_ids = [pid for pid in player_ids if pid not in existing]

    if args.limit:
        player_ids = player_ids[:args.limit]

    if not player_ids:
        print("  No players to process.")
        cur.close()
        conn.close()
        return

    print(f"  Players to process: {len(player_ids)}")

    # ── Batch-load supporting data ─────────────────────────────────────────

    # People data (awards, total_goals, date_of_birth)
    placeholders = ",".join(["%s"] * len(player_ids))
    cur.execute(f"""
        SELECT id, awards, total_goals, date_of_birth
        FROM people
        WHERE id IN ({placeholders})
    """, player_ids)
    people_cols = [d[0] for d in cur.description]
    people_data = {r[0]: dict(zip(people_cols, r)) for r in cur.fetchall()}

    # Career metrics
    cur.execute(f"""
        SELECT person_id, trajectory, career_years, clubs_count, loan_count,
               avg_tenure_yrs, leagues_count
        FROM career_metrics
        WHERE person_id IN ({placeholders})
    """, player_ids)
    metrics_cols = [d[0] for d in cur.description]
    metrics_data = {r[0]: dict(zip(metrics_cols, r)) for r in cur.fetchall()}

    # Nationality counts
    cur.execute(f"""
        SELECT person_id, COUNT(*) as cnt
        FROM player_nationalities
        WHERE person_id IN ({placeholders})
        GROUP BY person_id
    """, player_ids)
    nationality_counts = {r[0]: r[1] for r in cur.fetchall()}

    # Club leagues (for promotion_climber / late_bloomer detection)
    cur.execute("SELECT id, league_name FROM clubs WHERE league_name IS NOT NULL")
    club_leagues = {r[0]: r[1] for r in cur.fetchall()}
    print(f"  Club league mappings: {len(club_leagues)}")

    # ── Process each player ────────────────────────────────────────────────

    all_xp_rows = []
    modifier_rows = []
    stats = {"processed": 0, "milestones": 0, "positive": 0, "negative": 0}
    xp_distribution = {}

    for pid in player_ids:
        career_entries = career_by_player.get(pid, [])
        career_metric = metrics_data.get(pid)
        person = people_data.get(pid, {})
        nat_count = nationality_counts.get(pid, 0)

        milestones = detect_milestones(pid, career_entries, career_metric, person, nat_count, club_leagues)

        if not milestones:
            continue

        # Build XP rows
        for m in milestones:
            row = {
                "person_id": pid,
                "milestone_key": m["milestone_key"],
                "milestone_label": m["milestone_label"],
                "xp_value": m["xp_value"],
                "source": m["source"],
                "details": m["details"],
            }
            if m.get("milestone_date"):
                row["milestone_date"] = str(m["milestone_date"])
            all_xp_rows.append(row)

        # Compute clamped total
        total_xp = sum(m["xp_value"] for m in milestones)
        clamped_xp = max(-5, min(12, total_xp))

        modifier_rows.append({
            "person_id": pid,
            "xp_modifier": clamped_xp,
        })

        stats["processed"] += 1
        stats["milestones"] += len(milestones)
        stats["positive"] += sum(1 for m in milestones if m["xp_value"] > 0)
        stats["negative"] += sum(1 for m in milestones if m["xp_value"] < 0)
        xp_distribution[clamped_xp] = xp_distribution.get(clamped_xp, 0) + 1

    # ── Sample output ──────────────────────────────────────────────────────

    if all_xp_rows:
        sample_pid = all_xp_rows[0]["person_id"]
        sample_milestones = [r for r in all_xp_rows if r["person_id"] == sample_pid]
        print(f"\n  Sample (person_id={sample_pid}):")
        for m in sample_milestones:
            sign = "+" if m["xp_value"] > 0 else ""
            print(f"    {sign}{m['xp_value']:+d}  {m['milestone_label']:30s}  [{m['source']}]")
        sample_mod = next((r for r in modifier_rows if r["person_id"] == sample_pid), None)
        if sample_mod:
            print(f"    → xp_modifier = {sample_mod['xp_modifier']}")

    # ── XP distribution ───────────────────────────────────────────────────

    print(f"\n  XP modifier distribution:")
    for xp in sorted(xp_distribution.keys()):
        bar = "#" * min(xp_distribution[xp], 50)
        print(f"    {xp:+3d}  {xp_distribution[xp]:5d}  {bar}")

    # ── Write ──────────────────────────────────────────────────────────────

    n_xp = chunked_upsert_xp(all_xp_rows)
    n_mod = update_xp_modifiers(modifier_rows)

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  Players processed:  {stats['processed']}")
    print(f"  Milestones found:   {stats['milestones']} (+{stats['positive']} / -{stats['negative']})")
    print(f"  XP rows upserted:   {n_xp}")
    print(f"  Modifiers updated:  {n_mod}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
