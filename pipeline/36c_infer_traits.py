"""
36c_infer_traits.py — Infer tactical/behavioral/style traits from stats.

Fills the trait gap that makes the four-pillar tactical score flat.
Sources: API-Football stats, attribute_grades, player_personality.

Traits inferred:
  Style:     flamboyant, direct, patient, elegant
  Physical:  aerial_threat, endurance
  Tactical:  press_resistant, progressive_carrier, set_piece_specialist,
             positional_discipline, high_press, counter_attack_threat, build_up_contributor
  Behavioral: big_game_player, inconsistent, clutch, hot_headed, quiet_leader

Usage:
    python 36c_infer_traits.py              # infer traits
    python 36c_infer_traits.py --dry-run    # preview
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from lib.db import require_conn, get_dict_cursor

parser = argparse.ArgumentParser(description="Infer player traits from stats")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run


def main():
    conn = require_conn()
    cur = get_dict_cursor(conn)

    print("36c — Trait Inference from Stats")
    print(f"  Dry run: {DRY_RUN}")

    # ── Load data ─────────────────────────────────────────────────────────────

    # API-Football aggregate stats (most recent season per player)
    print("  Loading AF stats...")
    cur.execute("""
        SELECT DISTINCT ON (person_id)
            person_id, minutes, goals, assists,
            shots_total, shots_on, passes_key, passes_accuracy,
            tackles_total, interceptions, blocks,
            duels_total, duels_won,
            dribbles_attempted, dribbles_success,
            fouls_drawn, fouls_committed,
            cards_yellow, cards_red,
            rating
        FROM api_football_player_stats
        WHERE person_id IS NOT NULL AND minutes >= 450
        ORDER BY person_id, season DESC
    """)
    af = {r["person_id"]: r for r in cur.fetchall()}
    print(f"  {len(af)} players with AF stats")

    # Positions
    cur.execute("SELECT person_id, position FROM player_profiles WHERE position IS NOT NULL")
    positions = {r["person_id"]: r["position"] for r in cur.fetchall()}

    # Attribute grades (best per attribute)
    print("  Loading attribute grades...")
    cur.execute("""
        SELECT player_id, attribute,
               COALESCE(scout_grade, stat_score) as score, source
        FROM attribute_grades
        WHERE COALESCE(scout_grade, stat_score) > 0
    """)
    grades = {}
    for r in cur.fetchall():
        pid = r["player_id"]
        if pid not in grades:
            grades[pid] = {}
        attr = r["attribute"]
        if attr not in grades[pid] or r["source"] == "scout_assessment":
            grades[pid][attr] = r["score"]
    print(f"  {len(grades)} players with attribute grades")

    # Personality
    cur.execute("SELECT person_id, competitiveness, coachability, ei, sn, tf, jp FROM player_personality")
    personality = {r["person_id"]: r for r in cur.fetchall()}

    # ── Compute traits ────────────────────────────────────────────────────────

    print("  Computing traits...")
    all_traits = []  # (player_id, trait, category, severity)

    for pid, s in af.items():
        mins = float(s["minutes"])
        if mins <= 0:
            continue

        pos = positions.get(pid)
        g = grades.get(pid, {})
        pers = personality.get(pid, {})
        traits = []

        # Per-90 helpers
        def p90(v):
            return float(v or 0) / mins * 90

        goals_p90 = p90(s["goals"])
        assists_p90 = p90(s["assists"])
        dribbles_att = s["dribbles_attempted"] or 0
        dribbles_succ = s["dribbles_success"] or 0
        dribble_pct = dribbles_succ / max(dribbles_att, 1) * 100 if dribbles_att >= 5 else None
        tackles_p90 = p90(s["tackles_total"])
        intercepts_p90 = p90(s["interceptions"])
        key_passes_p90 = p90(s["passes_key"])
        fouls_committed_p90 = p90(s["fouls_committed"])
        cards_p90 = p90((s["cards_yellow"] or 0) + (s["cards_red"] or 0) * 2)
        duels_total = s["duels_total"] or 0
        duels_won = s["duels_won"] or 0
        duel_pct = duels_won / max(duels_total, 1) * 100 if duels_total >= 20 else None
        rating = float(s["rating"]) if s["rating"] else None
        pass_acc = s["passes_accuracy"]

        # ── Style traits ──────────────────────────────────────────────────

        # Flamboyant: high dribble attempts + goals + assists (flair indicator)
        if dribbles_att >= 15 and dribble_pct and dribble_pct >= 50:
            sev = min(10, int(dribbles_att / 5) + (3 if goals_p90 > 0.3 else 0))
            if sev >= 4:
                traits.append(("flamboyant", "style", min(10, sev)))

        # Direct: high shots + goals, low pass accuracy (takes shots, doesn't dwell)
        if goals_p90 > 0.2 and p90(s["shots_total"]) > 2.0:
            sev = min(10, int(p90(s["shots_total"]) * 2) + (2 if goals_p90 > 0.4 else 0))
            if sev >= 4:
                traits.append(("direct", "style", min(10, sev)))

        # Patient: high pass accuracy + key passes, low shots (possession player)
        if pass_acc and float(pass_acc) >= 85 and key_passes_p90 >= 1.0:
            sev = min(10, int((float(pass_acc) - 80) / 2) + (2 if key_passes_p90 >= 2.0 else 0))
            if sev >= 4:
                traits.append(("patient", "style", min(10, sev)))

        # Elegant: high pass accuracy + dribble success + low cards (clean player)
        if pass_acc and float(pass_acc) >= 83 and dribble_pct and dribble_pct >= 55 and cards_p90 < 0.15:
            sev = min(10, int((dribble_pct - 50) / 5) + int((float(pass_acc) - 80) / 3))
            if sev >= 4:
                traits.append(("elegant", "style", min(10, sev)))

        # ── Physical traits ───────────────────────────────────────────────

        # Aerial threat: high aerial duels won
        aerial = g.get("aerial_duels")
        if aerial and aerial >= 7:
            traits.append(("aerial_threat", "physical", min(10, aerial)))
        elif duel_pct and duel_pct >= 60 and pos in ("CD", "CF"):
            traits.append(("aerial_threat", "physical", min(10, int(duel_pct / 10))))

        # Endurance: high minutes + tackles + pressing indicators
        if mins >= 2500 and (tackles_p90 + intercepts_p90) >= 2.0:
            sev = min(10, int(mins / 500) + (2 if tackles_p90 >= 2.0 else 0))
            if sev >= 4:
                traits.append(("endurance", "physical", min(10, sev)))

        # ── Tactical traits ───────────────────────────────────────────────

        # Press resistant: high pass accuracy under pressure (proxy: pass acc + rating)
        if pass_acc and float(pass_acc) >= 87 and rating and rating >= 7.0:
            sev = min(10, int((float(pass_acc) - 84) / 1.5) + (2 if rating >= 7.3 else 0))
            if sev >= 4:
                traits.append(("press_resistant", "tactical", min(10, sev)))

        # Progressive carrier: high dribble success + progressive carrying
        carries = g.get("carries")
        if dribble_pct and dribble_pct >= 50 and (carries and carries >= 5):
            sev = min(10, int(dribble_pct / 10) + (2 if carries >= 8 else 0))
            if sev >= 4:
                traits.append(("progressive_carrier", "tactical", min(10, sev)))

        # Set piece specialist: high assists + key passes (proxy)
        if assists_p90 >= 0.3 and key_passes_p90 >= 2.0:
            sev = min(10, int(key_passes_p90 * 2) + (2 if assists_p90 >= 0.5 else 0))
            if sev >= 4:
                traits.append(("set_piece_specialist", "tactical", min(10, sev)))

        # Positional discipline: low fouls + high pass accuracy + defender/DM (proxy)
        if fouls_committed_p90 < 0.8 and pos in ("CD", "DM", "CM") and pass_acc and float(pass_acc) >= 82:
            sev = min(10, 5 + (2 if fouls_committed_p90 < 0.3 else 0) + (1 if float(pass_acc) >= 88 else 0))
            if sev >= 4:
                traits.append(("positional_discipline", "tactical", min(10, sev)))

        # High press: high tackles + interceptions per 90
        if tackles_p90 >= 2.5 or (tackles_p90 + intercepts_p90) >= 3.5:
            sev = min(10, int((tackles_p90 + intercepts_p90) * 1.5))
            if sev >= 4:
                traits.append(("high_press", "tactical", min(10, sev)))

        # Counter attack threat: high pace + goals (attacker/winger)
        pace = g.get("pace") or g.get("acceleration")
        if pos in ("WF", "CF", "AM") and goals_p90 >= 0.3 and pace and pace >= 6:
            sev = min(10, int(goals_p90 * 10) + (2 if pace >= 8 else 0))
            if sev >= 4:
                traits.append(("counter_attack_threat", "tactical", min(10, sev)))

        # Build-up contributor: high passes + progressive passing (CM/DM/CD)
        if pos in ("CD", "DM", "CM") and pass_acc and float(pass_acc) >= 85:
            prog = g.get("pass_range")
            sev = 5 + (2 if float(pass_acc) >= 90 else 0) + (2 if prog and prog >= 7 else 0)
            if sev >= 5:
                traits.append(("build_up_contributor", "tactical", min(10, sev)))

        # ── Behavioral traits ─────────────────────────────────────────────

        # Hot headed: high cards
        if cards_p90 >= 0.35:
            sev = min(10, int(cards_p90 * 12))
            if sev >= 4:
                traits.append(("hot_headed", "behavioral", min(10, sev)))

        # Big game player: high rating + goals (proxy: top performers)
        if rating and rating >= 7.3 and (goals_p90 >= 0.3 or assists_p90 >= 0.3):
            sev = min(10, int(rating * 1.2 - 5))
            if sev >= 4:
                traits.append(("big_game_player", "behavioral", min(10, sev)))

        # Inconsistent: medium rating with high variance proxy (low rating despite goals)
        if rating and rating < 6.8 and mins >= 900:
            sev = min(10, int((7.0 - rating) * 8))
            if sev >= 4:
                traits.append(("inconsistent", "behavioral", min(10, sev)))

        # Quiet leader: high comp/coach, low cards, defender/DM
        comp = pers.get("competitiveness")
        coach = pers.get("coachability")
        if comp and coach and comp >= 7 and coach >= 6 and cards_p90 < 0.2 and pos in ("CD", "DM", "GK"):
            sev = min(10, comp + (1 if coach >= 8 else 0))
            if sev >= 5:
                traits.append(("quiet_leader", "behavioral", min(10, sev)))

        for trait, cat, sev in traits:
            all_traits.append((pid, trait, cat, sev, "inferred"))

    # ── Summary ───────────────────────────────────────────────────────────────

    trait_counts = {}
    for _, trait, cat, _, _ in all_traits:
        trait_counts[trait] = trait_counts.get(trait, 0) + 1

    players_with_traits = len(set(t[0] for t in all_traits))
    print(f"\n  {len(all_traits)} trait assignments for {players_with_traits} players")
    print(f"  Avg traits per player: {len(all_traits) / max(players_with_traits, 1):.1f}")
    print(f"\n  Trait distribution:")
    for trait, n in sorted(trait_counts.items(), key=lambda x: -x[1]):
        print(f"    {trait:25s} {n:>5}")

    if DRY_RUN:
        print("\n  Key player spot-checks:")
        for pid in [10772, 13705, 18386, 9266, 13466]:
            cur.execute("SELECT name FROM people WHERE id = %s", (pid,))
            name = cur.fetchone()["name"]
            player_traits = [(t, c, s) for p, t, c, s, _ in all_traits if p == pid]
            trait_str = ", ".join(f"{t}({s})" for t, c, s in player_traits) or "none"
            print(f"    {name:25s} {trait_str}")
        print(f"\n  [dry-run] Would write {len(all_traits)} trait_scores")
        conn.close()
        return

    # ── Write ─────────────────────────────────────────────────────────────────

    print(f"\n  Clearing old inferred traits (keeping 'availability' + 'durability')...")
    write_cur = conn.cursor()
    write_cur.execute("""
        DELETE FROM player_trait_scores
        WHERE source = 'inferred'
    """)
    deleted = write_cur.rowcount
    print(f"  Deleted {deleted} old inferred traits")

    print(f"  Writing {len(all_traits)} new trait scores...")
    from psycopg2.extras import execute_values
    BATCH = 500
    for i in range(0, len(all_traits), BATCH):
        batch = all_traits[i:i + BATCH]
        execute_values(write_cur, """
            INSERT INTO player_trait_scores (player_id, trait, category, severity, source)
            VALUES %s
            ON CONFLICT (player_id, trait, source) DO UPDATE SET
                category = EXCLUDED.category,
                severity = EXCLUDED.severity
        """, batch)

    conn.commit()
    conn.close()
    print(f"  Done. {len(all_traits)} traits written.")


if __name__ == "__main__":
    main()
