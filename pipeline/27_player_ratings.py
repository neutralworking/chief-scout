"""
27_player_ratings.py — Compute composite player ratings from multi-source data.

Combines:
  - attribute_grades (fbref, statsbomb, understat, eafc_inferred, scout_assessment)
  - 13 playing models → 4 compound scores (Technical, Tactical, Physical, Mental)
  - career_metrics (trajectory, loyalty)
  - news_sentiment_agg (buzz, sentiment)
  - player_profiles (existing level, peak)

Outputs:
  - Updates player_profiles.overall with computed technical rating
  - Writes per-model scores to attribute_grades with source='computed'

Usage:
    python 27_player_ratings.py                    # all players with attribute data
    python 27_player_ratings.py --player 123       # single player
    python 27_player_ratings.py --limit 100        # first 100 players
    python 27_player_ratings.py --dry-run           # preview without writing
    python 27_player_ratings.py --force             # overwrite existing ratings
"""
import argparse
import math
import sys
from datetime import datetime, timezone

from supabase import create_client

from config import POSTGRES_DSN, SUPABASE_URL, SUPABASE_SERVICE_KEY

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Compute composite player ratings")
parser.add_argument("--player", type=str, default=None,
                    help="Single person_id to process")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to process")
parser.add_argument("--dry-run", action="store_true",
                    help="Print summaries without writing to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing ratings")
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


# ── Model Definitions (matches radar route.ts) ───────────────────────────────

MODEL_ATTRIBUTES = {
    "Controller":  ["anticipation", "composure", "decisions", "tempo"],
    "Commander":   ["communication", "concentration", "drive", "leadership"],
    "Creator":     ["creativity", "unpredictability", "vision", "guile"],
    "Target":      ["aerial_duels", "heading", "jumping", "volleys"],
    "Sprinter":    ["acceleration", "balance", "movement", "pace"],
    "Powerhouse":  ["aggression", "duels", "shielding", "stamina"],
    "Cover":       ["awareness", "discipline", "interceptions", "positioning"],
    "Engine":      ["intensity", "pressing", "stamina", "versatility"],
    "Destroyer":   ["blocking", "clearances", "marking", "tackling"],
    "Dribbler":    ["carries", "first_touch", "skills", "take_ons"],
    "Passer":      ["pass_accuracy", "crossing", "pass_range", "through_balls"],
    "Striker":     ["close_range", "mid_range", "long_range", "penalties"],
    "GK":          ["positioning", "awareness", "pass_range", "throwing"],
}

# Fallback aliases: when the primary attribute is missing, try these instead.
# Only used if the primary has zero data. Keeps models functional with sparse data.
# IMPORTANT: aliases must not map to another attribute already in the same model,
# or the model will double-count. Each alias should be a distinct proxy.
ATTRIBUTE_ALIASES = {
    "unpredictability": "take_ons",     # flair proxy (skills is in Dribbler, avoid double-count)
    "guile":            "through_balls", # cunning ≈ incisive passing
    "decisions":        "positioning",  # decision-making ≈ reading the game
    "communication":    "leadership",   # vocal ≈ captain material
    "concentration":    "discipline",   # focus ≈ discipline (not awareness — already in Cover)
    "drive":            "intensity",    # motivation ≈ work rate
    "versatility":      "stamina",      # engine coverage ≈ fitness
    "blocking":         "tackling",     # defensive action proxy
    "clearances":       "heading",      # aerial clearances ≈ heading
    "duels":            "aggression",   # physical contests ≈ aggression
}

# 4 compound groupings
COMPOUND_MODELS = {
    "Technical": ["Dribbler", "Passer", "Striker", "GK"],
    "Tactical":  ["Cover", "Destroyer", "Engine"],
    "Physical":  ["Sprinter", "Powerhouse", "Target"],
    "Mental":    ["Controller", "Commander", "Creator"],
}

# Position weights for role fit (mirrors radar route.ts)
POSITION_WEIGHTS = {
    "GK":  {"GK": 1.0, "Cover": 0.6, "Commander": 0.5, "Controller": 0.3},
    "CD":  {"Destroyer": 1.0, "Cover": 0.9, "Commander": 0.7, "Target": 0.5, "Powerhouse": 0.4, "Passer": 0.3},
    "WD":  {"Engine": 0.9, "Dribbler": 0.7, "Passer": 0.7, "Sprinter": 0.6, "Cover": 0.6, "Destroyer": 0.3},
    "DM":  {"Cover": 1.0, "Destroyer": 0.9, "Controller": 0.8, "Passer": 0.5, "Commander": 0.4, "Powerhouse": 0.3},
    "CM":  {"Controller": 1.0, "Passer": 0.9, "Engine": 0.8, "Cover": 0.5, "Creator": 0.4},
    "WM":  {"Dribbler": 0.9, "Passer": 0.8, "Engine": 0.7, "Sprinter": 0.6, "Creator": 0.5},
    "AM":  {"Creator": 1.0, "Dribbler": 0.8, "Passer": 0.7, "Controller": 0.5, "Striker": 0.4, "Sprinter": 0.3},
    "WF":  {"Dribbler": 1.0, "Sprinter": 0.9, "Striker": 0.7, "Creator": 0.5, "Engine": 0.5},
    "CF":  {"Striker": 1.0, "Target": 0.7, "Sprinter": 0.6, "Powerhouse": 0.5, "Dribbler": 0.4, "Creator": 0.3},
}

# Tactical roles — each name is the term the football world actually uses.
# If the word came from Italian, Spanish, Portuguese, German, French, or
# Argentine football culture and became THE word for that role, we use it.
# No FIFA/FM generic compound names.
#
# Lineage in SACROSANCT System 4.
TACTICAL_ROLES = {
    "GK": [
        ("GK", "Cover",   "Torwart"),             # German: the traditional keeper. Kahn, Buffon, Courtois
        ("GK", "Passer",  "Sweeper Keeper"),       # Neuer: high line, sweeps behind, commands area
        ("GK", "Controller", "Ball-Playing GK"),   # Ederson, Ter Stegen: distribution as a weapon
    ],
    "CD": [
        ("Cover", "Passer",     "Libero"),         # Beckenbauer → Stones: builds from back, reads danger
        ("Destroyer", "Powerhouse", "Vorstopper"), # German: "front stopper" — Baresi, Chiellini, Konaté
        ("Cover", "Controller",  "Sweeper"),        # Sammer → Hummels → Marquinhos: last man, reads play
        ("Destroyer", "Commander", "Zagueiro"),     # Brazilian: the commanding CB — Lúcio, Thiago Silva
    ],
    "WD": [
        ("Engine", "Dribbler",  "Lateral"),        # Portuguese/Spanish: the attacking fullback. Cafu, TAA
        ("Controller", "Passer","Invertido"),       # Spanish: inverted FB. Lahm 2013 → Cancelo → Rico Lewis
        ("Engine", "Sprinter",  "Carrilero"),       # Spanish: "lane runner" — Facchetti, Zanetti, Hakimi
    ],
    "DM": [
        ("Cover", "Destroyer",  "Sentinelle"),     # French: the sentinel. Makélélé → Casemiro. Guards the gate
        ("Controller", "Passer","Regista"),         # Gerson → Pirlo → Jorginho: tempo dictator from deep
        ("Destroyer", "Engine", "Volante"),         # Brazilian: "steering wheel" — Gattuso, Kanté, Caicedo
    ],
    "CM": [
        ("Controller", "Passer","Metodista"),       # Italian: "the methodist" — Xavi, Kroos, Pedri
        ("Engine", "Cover",     "Tuttocampista"),   # Italian: "all-pitch player" — Lampard, Gerrard, Bellingham
        ("Passer", "Creator",   "Mezzala"),         # Italian: "half-winger" — Barella. Half-space creator
        ("Engine", "Destroyer", "Relayeur"),        # French: "relay" — Valverde. Links phases, tireless shuttle
    ],
    "WM": [
        ("Creator", "Passer",   "Fantasista"),      # Italian: the wide creator. Silva, Bernardo, Foden
        ("Sprinter", "Passer",  "Winger"),          # Garrincha, Figo, Saka. The oldest attacking role
        ("Dribbler", "Striker", "Raumdeuter"),      # German: "space interpreter" — Müller coined it himself
    ],
    "AM": [
        ("Creator", "Dribbler", "Trequartista"),    # Baggio → Zidane → Messi: the free-roaming 10
        ("Controller", "Creator","Enganche"),        # Argentine: the hook. Riquelme → Dybala. Sees everything
        ("Dribbler", "Striker", "Seconda Punta"),    # Italian: "second striker" — Del Piero, Havertz
    ],
    "WF": [
        ("Dribbler", "Sprinter","Inside Forward"),   # Robben → Salah → Yamal. Historical English term from W-M era
        ("Sprinter", "Striker", "Extremo"),           # Portuguese: the wide attacker — Henry, Mbappé
        ("Creator", "Dribbler", "Inventor"),          # the creator who makes something from nothing — Grealish
    ],
    "CF": [
        ("Target", "Powerhouse","Prima Punta"),      # Italian: "first striker" — Toni, Giroud. Holds up, aerial
        ("Striker", "Sprinter", "Poacher"),           # Gerd Müller → Inzaghi → Haaland. Goals, movement, instinct
        ("Striker", "Creator",   "Complete Forward"), # R9, Van Basten, Benzema. Scores AND creates — the total striker
        ("Creator", "Controller","Falso Nove"),       # Hidegkuti 1953 → Messi 2009 → Firmino
        ("Dribbler", "Striker", "Seconda Punta"),     # Totti → Griezmann. Between the lines
    ],
}

# Position weights for overall calculation (which compounds matter per position)
POSITION_COMPOUND_WEIGHTS = {
    "GK":  {"Technical": 0.5, "Tactical": 0.2, "Physical": 0.1, "Mental": 0.2},
    "CD":  {"Technical": 0.1, "Tactical": 0.4, "Physical": 0.3, "Mental": 0.2},
    "WD":  {"Technical": 0.2, "Tactical": 0.3, "Physical": 0.3, "Mental": 0.2},
    "DM":  {"Technical": 0.2, "Tactical": 0.4, "Physical": 0.2, "Mental": 0.2},
    "CM":  {"Technical": 0.3, "Tactical": 0.2, "Physical": 0.2, "Mental": 0.3},
    "WM":  {"Technical": 0.3, "Tactical": 0.2, "Physical": 0.3, "Mental": 0.2},
    "AM":  {"Technical": 0.4, "Tactical": 0.1, "Physical": 0.2, "Mental": 0.3},
    "WF":  {"Technical": 0.3, "Tactical": 0.1, "Physical": 0.3, "Mental": 0.3},
    "CF":  {"Technical": 0.3, "Tactical": 0.1, "Physical": 0.3, "Mental": 0.3},
}

# Source priority (higher = preferred)
SOURCE_PRIORITY = {
    "scout_assessment": 5,
    "fbref": 4,
    "statsbomb": 3,
    "understat": 2,
    "computed": 1,
    "eafc_inferred": 0,
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _safe(val):
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def compute_model_scores(grades, level=None):
    """Compute model scores (0-100) from best-source attribute grades.

    scout_grade uses a 1-20 scale; stat_score uses a 1-10 scale.
    Both are normalised to 0-20 before averaging.

    Returns (anchored_scores, raw_scores):
      - anchored_scores: blended with level when data is thin — used for
        compound/overall calculations where we want to avoid penalising
        players with incomplete data.
      - raw_scores: pure data-driven scores — used for role selection where
        inflated thin-data models would distort role fit.
    """
    # Build best-grade-per-attribute map (prefer highest-priority source)
    best = {}  # attr -> (normalised_score_0_20, priority)
    for g in grades:
        source = g.get("source", "")
        attr = g["attribute"].lower().replace(" ", "_")
        # Normalise to 0-20 scale regardless of source
        # scout_grade: already 1-20
        # stat_score scale varies by source:
        #   - scout_assessment: scout_grade 1-20
        #   - understat/computed: stat_score 1-10
        #   - statsbomb: stat_score 1-20
        #   - eafc_inferred: stat_score 1-20 (re-imported from EA FC 25)
        if g["scout_grade"] is not None and g["scout_grade"] > 0:
            score_20 = min(g["scout_grade"], 20)  # clamp to 1-20
        elif g.get("stat_score") is not None and g["stat_score"] > 0:
            if source in ("statsbomb", "eafc_inferred"):
                score_20 = min(g["stat_score"], 20)  # already 1-20
            elif source == "understat":
                # Understat clusters high (9-10 for any decent player).
                # Compress: 10→17, 8→14, 5→9. Prevents understat-only
                # players from scoring as if they had elite scout grades.
                score_20 = min(g["stat_score"] * 1.7, 17)
            else:
                score_20 = min(g["stat_score"] * 2, 20)  # 1-10 → 2-20
        else:
            continue
        priority = SOURCE_PRIORITY.get(source, 0)
        existing = best.get(attr)
        if existing is None or priority > existing[1]:
            best[attr] = (score_20, priority)

    # Level-derived anchor: what a player of this level "should" score
    # Conservative: level itself, not inflated. A level 85 player anchors at 85.
    level_anchor = min(level, 95) if level else None

    # Compute each model score — both raw and anchored variants
    #
    # Coverage confidence: with fewer attributes, we're less certain of the
    # model score. Light penalty for 3/4 (trustworthy), moderate for 2/4,
    # heavy for 1/4 (single data point).
    #
    # Confidence map: 4/4 → 1.0, 3/4 → 0.95, 2/4 → 0.85, 1/4 → 0.70
    COVERAGE_CONFIDENCE = {4: 1.0, 3: 0.95, 2: 0.85, 1: 0.70}

    anchored_scores = {}
    raw_scores = {}
    for model, attrs in MODEL_ATTRIBUTES.items():
        # Try each attribute, falling back to alias if primary is missing
        # Track which underlying attrs we've used to prevent double-counting
        values = []
        used_attrs = set()
        for a in attrs:
            if a in best:
                values.append(best[a][0])
                used_attrs.add(a)
            else:
                alias = ATTRIBUTE_ALIASES.get(a)
                if alias and alias in best and alias not in used_attrs:
                    values.append(best[alias][0])
                    used_attrs.add(alias)
        if values:
            avg = sum(values) / len(values)
            full_score = min(avg * 5, 99)

            # Light coverage penalty — trust the data we have
            confidence = COVERAGE_CONFIDENCE.get(len(values), 0.70)
            raw_score = full_score * confidence
            raw_scores[model] = round(raw_score)

            # Anchored version: blend with level when data is thin (<3 of 4 attrs)
            anchored = raw_score
            if level_anchor and len(values) < 3:
                data_weight = len(values) / len(attrs)
                anchored = raw_score * data_weight + level_anchor * (1 - data_weight)
            anchored_scores[model] = round(anchored)

    return anchored_scores, raw_scores


def compute_compound_scores(model_scores):
    """Compute compound scores from model scores."""
    compounds = {}
    for compound, models in COMPOUND_MODELS.items():
        values = [model_scores[m] for m in models if m in model_scores]
        if values:
            compounds[compound] = round(sum(values) / len(values))
    return compounds


def compute_overall(compound_scores, position, level=None, peak=None):
    """
    Compute overall rating as a position-weighted compound average.

    The overall blends:
    - 70% technical compound score (position-weighted attribute average)
    - 15% level (editorial assessment, if available)
    - 15% peak (career ceiling, if available)

    If level/peak unavailable, 100% from compound scores.
    """
    weights = POSITION_COMPOUND_WEIGHTS.get(position, {
        "Technical": 0.25, "Tactical": 0.25, "Physical": 0.25, "Mental": 0.25,
    })

    weighted_sum = 0
    total_weight = 0
    for compound, weight in weights.items():
        if compound in compound_scores:
            weighted_sum += compound_scores[compound] * weight
            total_weight += weight

    if total_weight <= 0:
        return None

    technical_overall = weighted_sum / total_weight

    # Blend with level if available — level is the stronger signal
    # since compound scores suffer from incomplete attribute data
    if level is not None:
        overall = technical_overall * 0.35 + level * 0.65
    else:
        overall = technical_overall

    return round(min(max(overall, 1), 99))


def compute_best_role(model_scores, position):
    """Compute the best tactical role and its score for a player.

    Returns (role_name, role_score) where role_score is 0-100.
    When a required model has no data, we skip that role entirely rather
    than letting a zero drag the score down.
    """
    roles = TACTICAL_ROLES.get(position, [])
    if not roles:
        return None, 0

    best_role = None
    best_score = -1
    for primary, secondary, name in roles:
        p_score = model_scores.get(primary)
        s_score = model_scores.get(secondary)
        # Skip roles where the primary model has no data at all
        if p_score is None:
            continue
        # If secondary is missing, score based on primary alone
        if s_score is None:
            score = p_score * 0.85  # slight penalty for incomplete role fit
        else:
            score = p_score * 0.6 + s_score * 0.4
        if score > best_score:
            best_score = score
            best_role = name

    if best_role is None:
        return None, 0
    return best_role, round(best_score)


def has_differentiated_data(model_scores):
    """Check if data has real variation (not all flat eafc defaults)."""
    values = list(model_scores.values())
    if len(values) < 3:
        return False
    return len(set(values)) > 2


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Player Rating Calculator")
    print(f"  Dry run: {DRY_RUN}")
    print(f"  Force:   {FORCE}")

    cur = conn.cursor()

    # ── Step 1: Fetch all attribute grades ────────────────────────────────────

    where_clauses = []
    params = []

    if args.player:
        where_clauses.append("ag.player_id = %s")
        params.append(int(args.player))

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    print("\n  Loading attribute grades...")
    cur.execute(f"""
        SELECT ag.player_id, ag.attribute, ag.scout_grade, ag.stat_score, ag.source
        FROM attribute_grades ag
        {where_sql}
        ORDER BY ag.player_id
    """, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    if not rows:
        print("  No attribute grades found.")
        cur.close()
        conn.close()
        return

    # Group by player
    player_grades = {}
    for row in rows:
        d = dict(zip(cols, row))
        pid = d["player_id"]
        player_grades.setdefault(pid, []).append(d)

    print(f"  Players with attribute data: {len(player_grades)}")

    # ── Step 2: Fetch existing profiles (level, peak, position) ──────────────

    print("  Loading player profiles...")
    cur.execute("""
        SELECT person_id, position, level, peak, overall
        FROM player_profiles
        WHERE position IS NOT NULL
    """)
    profiles = {}
    for row in cur.fetchall():
        profiles[row[0]] = {
            "position": row[1],
            "level": row[2],
            "peak": row[3],
            "old_overall": row[4],
        }
    print(f"  Profiles with position: {len(profiles)}")

    # ── Step 3: Compute ratings ──────────────────────────────────────────────

    player_ids = list(player_grades.keys())
    if args.limit:
        player_ids = player_ids[:args.limit]

    results = []
    stats = {
        "computed": 0,
        "skipped_flat": 0,
        "skipped_no_position": 0,
        "updated_overall": 0,
    }
    compound_distribution = {"Technical": [], "Tactical": [], "Physical": [], "Mental": []}
    overall_distribution = []

    for pid in player_ids:
        grades = player_grades[pid]
        profile = profiles.get(pid)

        if not profile:
            stats["skipped_no_position"] += 1
            continue

        anchored_scores, raw_scores = compute_model_scores(grades, level=profile.get("level"))

        if not has_differentiated_data(anchored_scores):
            stats["skipped_flat"] += 1
            continue

        # Anchored scores for compound/overall (tolerant of thin data)
        compound_scores = compute_compound_scores(anchored_scores)

        position = profile["position"]
        level = profile.get("level")
        peak = profile.get("peak")

        overall = compute_overall(compound_scores, position, level, peak)

        if overall is None:
            continue

        stats["computed"] += 1
        overall_distribution.append(overall)

        for comp, score in compound_scores.items():
            compound_distribution[comp].append(score)

        # Raw scores for role selection (no level inflation distorting role fit)
        best_role, best_role_score = compute_best_role(raw_scores, position)

        # Level floor: role score can't drop too far below level.
        # Tighter floor for elite players (they have proven role fit),
        # looser for lower levels where data gaps are more real.
        if level and best_role_score:
            gap = 6 if level >= 80 else 15
            level_floor = max(level - gap, 50)
            best_role_score = max(best_role_score, level_floor)

        results.append({
            "person_id": pid,
            "overall": overall,
            "model_scores": anchored_scores,
            "compound_scores": compound_scores,
            "position": position,
            "level": level,
            "best_role": best_role,
            "best_role_score": best_role_score,
            "technical_score": compound_scores.get("Technical"),
            "physical_score": compound_scores.get("Physical"),
        })

    print(f"\n  Computed ratings: {stats['computed']}")
    print(f"  Skipped (flat data): {stats['skipped_flat']}")
    print(f"  Skipped (no position): {stats['skipped_no_position']}")

    # ── Step 4: Distribution stats ───────────────────────────────────────────

    if overall_distribution:
        print(f"\n  Overall distribution:")
        print(f"    Min: {min(overall_distribution)}  Max: {max(overall_distribution)}  "
              f"Avg: {sum(overall_distribution) / len(overall_distribution):.1f}  "
              f"Median: {sorted(overall_distribution)[len(overall_distribution) // 2]}")

        for comp, vals in compound_distribution.items():
            if vals:
                print(f"    {comp:10s}  avg={sum(vals)/len(vals):.1f}  "
                      f"min={min(vals)}  max={max(vals)}  n={len(vals)}")

    # ── Step 5: Show samples ─────────────────────────────────────────────────

    if results:
        # Show top 5 by overall
        top = sorted(results, key=lambda r: -r["overall"])[:5]
        print(f"\n  Top 5 rated players:")
        for r in top:
            name_q = cur.execute("SELECT name FROM people WHERE id = %s", (r["person_id"],))
            name_row = cur.fetchone()
            name = name_row[0] if name_row else f"#{r['person_id']}"
            compounds = ", ".join(f"{k}={v}" for k, v in r["compound_scores"].items())
            level_str = f" lvl={r['level']}" if r['level'] else ""
            role_str = f" role={r['best_role']}({r['best_role_score']})" if r.get('best_role') else ""
            print(f"    {name:25s} {r['position']:3s}  overall={r['overall']:2d}"
                  f"{level_str}{role_str}  [{compounds}]")

    # ── Step 6: Write results ────────────────────────────────────────────────

    if not DRY_RUN and results:
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update player_profiles: overall + compound scores + best_role
        profile_updates = []
        for r in results:
            update = {
                "person_id": r["person_id"],
                "overall": float(r["overall"]),
            }
            if r.get("technical_score") is not None:
                update["technical_score"] = r["technical_score"]
            if r.get("physical_score") is not None:
                update["physical_score"] = r["physical_score"]
            if r.get("best_role"):
                update["best_role"] = r["best_role"]
            if r.get("best_role_score"):
                update["best_role_score"] = r["best_role_score"]
            profile_updates.append(update)

        for i in range(0, len(profile_updates), CHUNK_SIZE):
            chunk = profile_updates[i:i + CHUNK_SIZE]
            sb_client.table("player_profiles").upsert(
                chunk, on_conflict="person_id"
            ).execute()
            stats["updated_overall"] += len(chunk)

        print(f"\n  Updated player_profiles.overall: {stats['updated_overall']}")

        # Clear stale best_role_score for players that were skipped (flat/no data)
        # These keep old inflated scores from previous runs
        processed_ids = [r["person_id"] for r in results]
        if processed_ids:
            cur.execute("""
                UPDATE player_profiles
                SET best_role_score = NULL, best_role = NULL
                WHERE best_role_score IS NOT NULL
                AND person_id NOT IN %s
            """, (tuple(processed_ids),))
            stale_cleared = cur.rowcount
            if stale_cleared:
                print(f"  Cleared stale best_role_score: {stale_cleared} players")

        # Write compound scores as attribute_grades (source='computed')
        # stat_score is 0-20 scale, so convert from 0-100
        compound_rows = []
        for r in results:
            for compound, score in r["compound_scores"].items():
                compound_rows.append({
                    "player_id": r["person_id"],
                    "attribute": compound.lower(),
                    "stat_score": max(1, min(10, round(score / 10))),
                    "source": "computed",
                    "is_inferred": True,
                    "updated_at": now_iso,
                })

        if compound_rows:
            for i in range(0, len(compound_rows), CHUNK_SIZE):
                chunk = compound_rows[i:i + CHUNK_SIZE]
                sb_client.table("attribute_grades").upsert(
                    chunk, on_conflict="player_id,attribute,source"
                ).execute()
            print(f"  Wrote compound scores: {len(compound_rows)} rows")

    elif DRY_RUN:
        print(f"\n  [dry-run] would update {len(results)} player_profiles.overall values")
        print(f"  [dry-run] would write {len(results) * 4} compound score rows")

    # ── Summary ──────────────────────────────────────────────────────────────

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  Players processed:   {stats['computed']}")
    print(f"  Overall ratings:     {stats.get('updated_overall', 0)} written")
    print(f"  Skipped (flat):      {stats['skipped_flat']}")
    print(f"  Skipped (no pos):    {stats['skipped_no_position']}")
    if DRY_RUN:
        print("  (dry-run — no data was written)")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
