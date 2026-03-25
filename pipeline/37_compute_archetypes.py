"""
37_compute_archetypes.py — Compute earned archetypes from stats + personality + career data.

Archetypes are earned identity labels (Hitman, Maestro, Rock, etc.) that require
statistical proof + personality fit. Most players don't earn one.

Writes to: player_profiles.earned_archetype, archetype_tier, legacy_tag, behavioral_tag

Architecture:
  - 27 positional archetypes (position-gated stat thresholds)
  - 4 legacy tags (career-gated): Icon, Legendary, Wonderkid, Veteran
  - Tiers: elite (top 3-5%), established (10-15%), aspiring (within 80% of threshold)

Usage:
    python 37_compute_archetypes.py              # compute all
    python 37_compute_archetypes.py --dry-run    # preview
    python 37_compute_archetypes.py --player 10772  # single player debug
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor

parser = argparse.ArgumentParser(description="Compute earned archetypes")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--player", type=int, help="Debug single player")
args = parser.parse_args()

DRY_RUN = args.dry_run

# ── Personality helpers ───────────────────────────────────────────────────────

def pers_matches(pers_type, patterns):
    """Check if personality type matches any pattern.
    Pattern: 4-char with _ as wildcard. E.g. 'AN_C' matches ANSC, ANLC."""
    if not pers_type or len(pers_type) != 4:
        return False
    for pat in patterns:
        if len(pat) != 4:
            continue
        if all(p == '_' or p == c for p, c in zip(pat, pers_type)):
            return True
    return False


# ── Archetype definitions ────────────────────────────────────────────────────

POSITIONAL_ARCHETYPES = {
    # ── ELITE ATTACKING ──────────────────────────────────────────
    "Marksman": {
        "positions": {"CF"},  # pure goalscorer — CF only
        "check": lambda s, p: (s.get("goals", 0) >= 20 or s.get("gp90", 0) >= 0.55),
        "personality": None,
        "tier_elite": lambda s: s.get("goals", 0) >= 25 or s.get("gp90", 0) >= 0.65,
    },
    "Conjurer": {
        "positions": {"WD", "CM", "WM", "WF", "AM", "CF"},  # elite dribble-creator
        "check": lambda s, p: (s.get("ap90", 0) >= 0.3 and s.get("drib_att_p90", 0) >= 3 and s.get("drib_pct", 0) >= 50),
        "personality": None,
        "tier_elite": lambda s: s.get("ap90", 0) >= 0.4 and s.get("drib_att_p90", 0) >= 4,
    },
    "Virtuoso": {
        "positions": {"WD", "CM", "WM", "WF", "AM", "CF"},  # goals + assists + dribbles, the complete attacker
        "check": lambda s, p: (s.get("gp90", 0) >= 0.25 and s.get("ap90", 0) >= 0.15 and s.get("drib_att_p90", 0) >= 2.0),
        "personality": None,
    },
    "Fulcrum": {
        "positions": {"CD", "DM"},  # deep players — everything goes through them
        "check": lambda s, p: (s.get("intercepts_p90", 0) >= 1.5 and s.get("kp90", 0) >= 1.0 and s.get("pass_acc", 0) >= 85),
        "personality": None,
    },

    # ── CREATIVE ─────────────────────────────────────────────────
    "Architect": {
        "positions": {"WD", "CM", "WM", "WF", "AM", "CF"},  # elite creator, high assists + pass quality
        "check": lambda s, p: ((s.get("assists", 0) >= 10 or s.get("ap90", 0) >= 0.25) and s.get("pass_acc", 0) >= 87),
        "personality": None,
        "tier_elite": lambda s: s.get("assists", 0) >= 15 or s.get("ap90", 0) >= 0.35,
    },
    "Artisan": {
        "positions": {"WD", "CM", "WM", "WF", "AM", "CF"},  # intelligent creator with end product
        "check": lambda s, p: (s.get("kp90", 0) >= 2.0 and (s.get("gp90", 0) >= 0.15 or s.get("ap90", 0) >= 0.15)),
        "personality": None,
    },
    "Pulse": {
        "positions": {"DM", "CM", "AM"},  # midfielders — tempo-setter, dictates play
        "check": lambda s, p: (s.get("pass_acc", 0) >= 89 and s.get("passes_p90", 0) >= 45),
        "personality": None,
        "tier_elite": lambda s: s.get("pass_acc", 0) >= 92,
    },

    # ── PHYSICAL / COMBATIVE ─────────────────────────────────────
    "Goliath": {
        "positions": None,  # any — dominant physical presence, wins aerial/ground duels
        "check": lambda s, p: (s.get("duel_pct", 0) >= 60 and s.get("height", 0) >= 185),
        "personality": None,
        "tier_elite": lambda s: s.get("duel_pct", 0) >= 70 and s.get("height", 0) >= 190,
    },
    "Warrior": {
        "positions": None,  # any — combative, wins tackles, imposes physically
        "check": lambda s, p: (s.get("tackles_p90", 0) >= 3 and s.get("duel_pct", 0) >= 55),
        "personality": None,
    },
    "Sentinel": {
        "positions": {"CD", "DM", "WD"},  # shield, wins duels + intercepts, protects the back line
        "check": lambda s, p: (s.get("duel_pct", 0) >= 60 and s.get("def_actions_p90", 0) >= 2.5),
        "personality": None,
    },
    "Terrier": {
        "positions": {"DM", "CM", "WD", "CD"},  # ball-winner, high energy, never stops pressing
        "check": lambda s, p: (s.get("def_actions_p90", 0) >= 4.0 and s.get("tackles_p90", 0) >= 2.0),
        "personality": None,
    },

    # ── DIRECT / WIDE ────────────────────────────────────────────
    "Outlet": {
        "positions": {"WM", "WF", "AM", "CF"},  # direct runner, takes on defenders
        "check": lambda s, p: (s.get("drib_att_p90", 0) >= 3.5 and s.get("drib_pct", 0) >= 45),
        "personality": None,
    },
    "Hunter": {
        "positions": {"CF", "WF"},  # clinical finisher, high conversion
        "check": lambda s, p: (s.get("gp90", 0) >= 0.45 and s.get("shot_conv", 0) >= 20),
        "personality": None,
    },
    "Fox": {
        "positions": {"CF"},  # poacher — scores without dribbling
        "check": lambda s, p: (s.get("gp90", 0) >= 0.35 and s.get("drib_att_p90", 0) < 2),
        "personality": None,
    },

    # ── DEFENSIVE ────────────────────────────────────────────────
    "Fortress": {
        "positions": {"CD", "DM"},  # centre-backs and holding midfielders
        "check": lambda s, p: (s.get("duel_pct", 0) >= 65 and s.get("def_actions_p90", 0) >= 2),
        "personality": None,
        "tier_elite": lambda s: s.get("duel_pct", 0) >= 70,
    },
    "Reader": {
        "positions": {"CD", "DM", "WD"},  # anticipation, intercepts everything
        "check": lambda s, p: (s.get("intercepts_p90", 0) >= 3.0 and s.get("def_actions_p90", 0) >= 1.5),
        "personality": None,
    },
    "Lockdown": {
        "positions": {"WD", "CD"},  # defenders — tackles and marks
        "check": lambda s, p: s.get("def_actions_p90", 0) >= 3.0,
        "personality": None,
    },

    # ── ROLE PLAYERS ─────────────────────────────────────────────
    "Marshal": {
        "positions": None,  # any — imposes on the game, tackles and scores with authority
        "check": lambda s, p: (s.get("tackles_p90", 0) >= 2.5 and s.get("gp90", 0) >= 0.15 and s.get("duel_pct", 0) >= 50),
        "personality": None,
        "tier_elite": lambda s: s.get("tackles_p90", 0) >= 3 and s.get("gp90", 0) >= 0.15,
    },
    "Utility": {
        "positions": {"WD"},  # fullback who does everything
        "check": lambda s, p: (s.get("tackles_p90", 0) >= 1.5 and s.get("drib_att_p90", 0) >= 1.0 and (s.get("assists", 0) >= 3 or s.get("ap90", 0) >= 0.1)),
        "personality": None,
    },
    "Support": {
        "positions": {"WD"},  # reliable, steady — Gary Neville type
        "check": lambda s, p: (s.get("pass_acc", 0) >= 83 and s.get("rating", 0) >= 6.7),
        "personality": None,
    },

    # ── MID-TIER / CATCH-ALL ────────────────────────────────────
    "Connector": {
        "positions": {"CM", "DM", "AM"},  # midfielders — links play, keeps possession moving
        "check": lambda s, p: (s.get("pass_acc", 0) >= 85 and s.get("passes_p90", 0) >= 35),
        "personality": None,
    },
    "Battering Ram": {
        "positions": {"CF"},  # physical striker, holds up play, wins aerials
        "check": lambda s, p: (s.get("height", 0) >= 185 and s.get("duel_pct", 0) >= 55),
        "personality": None,
    },
    "Drifter": {
        "positions": {"CF", "AM"},  # false 9, drops deep, combines and creates space
        "check": lambda s, p: (s.get("ap90", 0) >= 0.1 and s.get("kp90", 0) >= 1.0 and s.get("gp90", 0) < 0.35),
        "personality": None,
    },
    "Sentry": {
        "positions": {"CD", "DM"},  # no-frills defender, positionally sound
        "check": lambda s, p: (s.get("def_actions_p90", 0) >= 2 and s.get("duel_pct", 0) >= 50),
        "personality": None,
    },
    "Safety": {
        "positions": {"CD", "WD"},  # last man back, recovery pace, sweeps up behind
        "check": lambda s, p: (s.get("pace_grade", 0) >= 10 and s.get("def_actions_p90", 0) >= 1.5),
        "personality": None,
    },

    # ── GOALKEEPERS ──────────────────────────────────────────────
    "Wall": {
        "positions": {"GK"},
        "check": lambda s, p: (s.get("rating", 0) >= 6.95 and s.get("minutes", 0) >= 1500),
        "personality": None,
    },
    "Sweeper": {
        "positions": {"GK"},
        "check": lambda s, p: (s.get("pass_acc", 0) >= 60 and s.get("rating", 0) >= 6.7 and s.get("minutes", 0) >= 1500),
        "personality": None,
    },
}

# Priority order: first match wins (elite archetypes first)
ARCHETYPE_PRIORITY = [
    # Elite (rare, prestigious)
    "Marksman", "Conjurer", "Virtuoso", "Hunter",
    # Creative / Authority
    "Architect", "Marshal", "Fulcrum", "Artisan",
    # Tempo / Control
    "Pulse", "Fortress",
    # Physical / Combative
    "Goliath", "Warrior", "Sentinel", "Terrier",
    # Direct
    "Outlet", "Fox",
    # Defensive
    "Lockdown", "Reader",
    # Role players
    "Utility", "Support",
    # Mid-tier / catch-all
    "Battering Ram", "Drifter", "Connector", "Sentry", "Safety",
    # Goalkeepers
    "Wall", "Sweeper",
]


def compute_stats(af, grades, age, height):
    """Build a stat dict from API-Football row + attribute grades."""
    if not af:
        return {}
    mins = float(af.get("minutes") or 0)
    if mins <= 0:
        return {}

    def p90(v):
        return float(v or 0) / mins * 90

    goals = af.get("goals") or 0
    assists = af.get("assists") or 0
    shots = af.get("shots_total") or 0
    shots_on = af.get("shots_on") or 0
    tackles = af.get("tackles_total") or 0
    interceptions = af.get("interceptions") or 0
    blocks = af.get("blocks") or 0
    duels_total = af.get("duels_total") or 0
    duels_won = af.get("duels_won") or 0
    drib_att = af.get("dribbles_attempted") or 0
    drib_succ = af.get("dribbles_success") or 0
    passes_key = af.get("passes_key") or 0
    passes_total = af.get("passes_total") or 0
    passes_acc = af.get("passes_accuracy")
    rating = float(af.get("rating") or 0)
    fouls_drawn = af.get("fouls_drawn") or 0
    cards_y = af.get("cards_yellow") or 0
    cards_r = af.get("cards_red") or 0
    crosses = 0  # not in AF schema
    saves = 0  # not in AF schema
    goals_conceded = 0  # not in AF schema

    return {
        "minutes": mins,
        "goals": goals,
        "assists": assists,
        "gp90": p90(goals),
        "ap90": p90(assists),
        "kp90": p90(passes_key),
        "tackles_p90": p90(tackles),
        "intercepts_p90": p90(interceptions),
        "def_actions_p90": p90(tackles + interceptions),
        "clearances_p90": p90(blocks),  # blocks as proxy for clearances
        "drib_att_p90": p90(drib_att),
        "drib_pct": (drib_succ / drib_att * 100) if drib_att >= 10 else 0,
        "duel_pct": (duels_won / duels_total * 100) if duels_total >= 20 else 0,
        "pass_acc": float(passes_acc) if passes_acc else 0,
        "passes_p90": p90(passes_total),
        "prog_pass_p90": p90(passes_key),  # key passes as prog pass proxy
        "crosses_p90": p90(crosses),
        "shot_conv": (goals / shots * 100) if shots >= 10 else 0,
        "rating": rating,
        "cards_r_career": cards_r,
        "cards_y": cards_y,
        "cards_r": cards_r,
        "cards_p90": p90(cards_y + cards_r * 2),
        "height": height or 0,
        "age": age or 0,
        "save_pct": (saves / max(saves + goals_conceded, 1) * 100) if saves > 0 else 0,
        "pace_grade": grades.get("pace") or grades.get("acceleration") or 0,
    }


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print("37 — Compute Earned Archetypes")
    print(f"  Dry run: {DRY_RUN}")

    # ── Load data ─────────────────────────────────────────────────────────

    # AF stats (most recent season per player)
    print("  Loading AF stats...")
    player_filter = f"AND s.person_id = {args.player}" if args.player else ""
    cur.execute(f"""
        SELECT DISTINCT ON (s.person_id)
            s.person_id, s.minutes, s.goals, s.assists,
            s.shots_total, s.shots_on, s.passes_key, s.passes_total, s.passes_accuracy,
            s.tackles_total, s.interceptions, s.blocks,
            s.duels_total, s.duels_won,
            s.dribbles_attempted, s.dribbles_success,
            s.fouls_drawn, s.cards_yellow, s.cards_red,
            s.rating, s.penalties_scored, s.penalties_missed
        FROM api_football_player_stats s
        WHERE s.person_id IS NOT NULL AND s.minutes >= 450 {player_filter}
        ORDER BY s.person_id, s.season DESC
    """)
    af_stats = {r["person_id"]: r for r in cur.fetchall()}
    print(f"  {len(af_stats)} players with AF stats")

    # Profiles
    cur.execute(f"""
        SELECT person_id, position, level, peak, archetype
        FROM player_profiles
        WHERE position IS NOT NULL {player_filter.replace('s.person_id', 'person_id')}
    """)
    profiles = {r["person_id"]: r for r in cur.fetchall()}

    # Personality
    cur.execute("SELECT person_id, competitiveness, coachability, ei, sn, tf, jp FROM player_personality")
    personalities = {}
    for r in cur.fetchall():
        pid = r["person_id"]
        # Compute personality type
        if all(r.get(d) is not None for d in ["ei", "sn", "tf", "jp"]):
            pt = ("A" if r["ei"] >= 50 else "I") + \
                 ("X" if r["sn"] >= 50 else "N") + \
                 ("S" if r["tf"] >= 50 else "L") + \
                 ("C" if r["jp"] >= 50 else "P")
        else:
            pt = None
        personalities[pid] = {
            "type": pt,
            "competitiveness": r.get("competitiveness"),
            "coachability": r.get("coachability"),
        }

    # Career metrics for legacy
    cur.execute("SELECT person_id, career_years, clubs_count, leagues_count, loyalty_score FROM career_metrics")
    careers = {r["person_id"]: r for r in cur.fetchall()}

    # XP totals
    cur.execute("SELECT person_id, sum(xp_value) as total_xp FROM player_xp GROUP BY person_id")
    xp = {r["person_id"]: int(r["total_xp"]) for r in cur.fetchall()}

    # Heights + ages
    cur.execute("SELECT id, height_cm, date_of_birth FROM people WHERE id IN (SELECT person_id FROM player_profiles)")
    people_data = {}
    from datetime import date
    for r in cur.fetchall():
        age = None
        if r["date_of_birth"]:
            today = date.today()
            dob = r["date_of_birth"]
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        people_data[r["id"]] = {"height": r["height_cm"], "age": age}

    # Attribute grades (best per attribute for pace/accel)
    cur.execute("""
        SELECT player_id, attribute, COALESCE(scout_grade, stat_score) as score
        FROM attribute_grades
        WHERE attribute IN ('pace', 'acceleration', 'movement')
          AND COALESCE(scout_grade, stat_score) > 0
    """)
    player_grades = {}
    for r in cur.fetchall():
        player_grades.setdefault(r["player_id"], {})[r["attribute"]] = r["score"]


    print(f"  {len(profiles)} profiles, {len(personalities)} personalities, {len(careers)} careers, {len(xp)} with XP")

    # ── Compute ───────────────────────────────────────────────────────────

    print("  Computing archetypes...")
    results = []  # (pid, earned_archetype, archetype_tier, legacy_tag, behavioral_tag)
    arch_counts = {}
    tier_counts = {"elite": 0, "established": 0, "aspiring": 0, "unclassified": 0}
    legacy_counts = {}
    behavioral_counts = {}

    all_pids = set(profiles.keys())
    if args.player:
        all_pids = {args.player}

    for pid in all_pids:
        prof = profiles.get(pid, {})
        pos = prof.get("position")
        if not pos:
            continue

        pd = people_data.get(pid, {})
        af = af_stats.get(pid)
        grades = player_grades.get(pid, {})
        pers = personalities.get(pid, {})
        pers_type = pers.get("type")

        stats = compute_stats(af, grades, pd.get("age"), pd.get("height"))

        # ── Positional archetype ──────────────────────────────────────
        earned = None
        tier = "unclassified"
        best_aspiring = None
        best_aspiring_score = 0

        for arch_name in ARCHETYPE_PRIORITY:
            defn = POSITIONAL_ARCHETYPES[arch_name]
            if defn["positions"] is not None and pos not in defn["positions"]:
                continue

            # Check personality gate
            if defn["personality"] is not None:
                if not pers_type or not pers_matches(pers_type, defn["personality"]):
                    continue

            # Check stat threshold
            if defn["check"](stats, pers):
                earned = arch_name
                # Check if elite
                elite_fn = defn.get("tier_elite")
                if elite_fn and elite_fn(stats):
                    tier = "elite"
                else:
                    tier = "established"
                break

        # If no archetype earned, check for aspiring (within 80% of thresholds)
        if not earned and stats:
            # Simple aspiring: scale thresholds by 0.8 and re-check
            for arch_name in ARCHETYPE_PRIORITY:
                defn = POSITIONAL_ARCHETYPES[arch_name]
                if defn["positions"] is not None and pos not in defn["positions"]:
                    continue
                if defn["personality"] is not None:
                    if not pers_type or not pers_matches(pers_type, defn["personality"]):
                        continue
                # Create relaxed stats (multiply numeric thresholds by 0.8)
                relaxed = {k: v * 1.25 if isinstance(v, (int, float)) else v for k, v in stats.items()}
                if defn["check"](relaxed, pers):
                    earned = arch_name
                    tier = "aspiring"
                    break

        # ── Legacy tag ────────────────────────────────────────────────
        legacy = None
        career = careers.get(pid, {})
        player_xp = xp.get(pid, 0)
        level = prof.get("level") or 0
        peak = prof.get("peak") or 0
        age = pd.get("age") or 0
        career_years = float(career.get("career_years") or 0)

        # Icon
        if player_xp >= 85 and peak >= 92 and career_years >= 15:
            legacy = "Icon"
        # Legendary
        elif player_xp >= 70 and peak >= 90:
            legacy = "Legendary"
        # Wonderkid
        elif age and age <= 21 and level >= 85:
            legacy = "Wonderkid"
        # Veteran
        elif age and age >= 33 and level >= 83:
            legacy = "Veteran"

        # ── Behavioral tag ────────────────────────────────────────────
        behavioral = None

        results.append((pid, earned, tier, legacy, behavioral))

        if earned:
            arch_counts[earned] = arch_counts.get(earned, 0) + 1
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        if legacy:
            legacy_counts[legacy] = legacy_counts.get(legacy, 0) + 1
        if behavioral:
            behavioral_counts[behavioral] = behavioral_counts.get(behavioral, 0) + 1

    # ── Summary ───────────────────────────────────────────────────────────

    total = len(results)
    print(f"\n  Processed {total} players")
    print(f"\n  Tier distribution:")
    for t in ["elite", "established", "aspiring", "unclassified"]:
        n = tier_counts[t]
        pct = n / max(total, 1) * 100
        bar = "#" * int(pct / 2)
        print(f"    {t:15s} {n:>6}  ({pct:5.1f}%)  {bar}")

    print(f"\n  Top archetypes:")
    for arch, n in sorted(arch_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"    {arch:20s} {n:>5}")

    if legacy_counts:
        print(f"\n  Legacy tags:")
        for tag, n in sorted(legacy_counts.items(), key=lambda x: -x[1]):
            print(f"    {tag:20s} {n:>5}")

    if behavioral_counts:
        print(f"\n  Behavioral tags:")
        for tag, n in sorted(behavioral_counts.items(), key=lambda x: -x[1]):
            print(f"    {tag:20s} {n:>5}")

    # Debug single player
    if args.player:
        for pid, earned, tier, legacy, behav in results:
            if pid == args.player:
                badge_parts = [x for x in [legacy, behav, earned] if x]
                badge = " ".join(badge_parts) if badge_parts else f"Aspiring {earned}" if tier == "aspiring" else "Unclassified"
                print(f"\n  Player {pid}: earned={earned} tier={tier} legacy={legacy} behavioral={behav}")
                print(f"  Badge: {badge}")
                cur.execute("SELECT name FROM people WHERE id = %s", (pid,))
                name = cur.fetchone()["name"]
                print(f"  Name: {name}")
        conn.close()
        return

    if DRY_RUN:
        # Show samples
        print("\n  Samples:")
        shown_tiers = set()
        for pid, earned, tier, legacy, behav in results:
            if tier not in shown_tiers and earned:
                shown_tiers.add(tier)
                cur.execute("SELECT name FROM people WHERE id = %s", (pid,))
                name = cur.fetchone()["name"]
                badge_parts = [x for x in [legacy, behav, earned] if x]
                badge = " ".join(badge_parts)
                pos = profiles.get(pid, {}).get("position", "?")
                print(f"    {name:25s} {pos:>3}  {badge:30s}  tier={tier}")
            if len(shown_tiers) >= 4:
                break
        print(f"\n  [dry-run] Would update {total} players")
        conn.close()
        return

    # ── Write ─────────────────────────────────────────────────────────────

    print(f"\n  Writing {total} archetype assignments...")
    write_cur = conn.cursor()
    from psycopg2.extras import execute_batch
    BATCH = 500
    for i in range(0, len(results), BATCH):
        batch = results[i:i + BATCH]
        execute_batch(write_cur, """
            UPDATE player_profiles
            SET earned_archetype = %s, archetype_tier = %s, legacy_tag = %s, behavioral_tag = %s
            WHERE person_id = %s
        """, [(ea, at, lt, bt, pid) for pid, ea, at, lt, bt in batch])

    conn.commit()
    conn.close()
    print(f"  Done. {total} players updated.")


if __name__ == "__main__":
    main()
