"""
34_personality_rules.py — Rule-based personality corrections.

Fixes the most common systematic errors in the inferred personality data.
The original inference produced near-midpoint scores (around 50) for most
players, resulting in 66% AXSC and 86% clustering in just two types.

Rules target clear misclassifications using available signals:
  - Competitiveness scores vs motivation axis
  - Pressing/awareness attributes vs game reading axis
  - Career loyalty/mobility vs motivation axis
  - Position-based heuristics (strikers are rarely leaders, GKs rarely instinctive)

Only modifies is_inferred=true rows. Manually reviewed rows are untouched.
Confidence set to "Low" (still inferred, just less wrong).

Usage:
    python 34_personality_rules.py                  # apply corrections
    python 34_personality_rules.py --dry-run        # preview only
    python 34_personality_rules.py --player "Haaland"  # single player
    python 34_personality_rules.py --report         # just show stats
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import date

from lib.db import require_conn, get_dict_cursor

parser = argparse.ArgumentParser(description="Rule-based personality corrections")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--player", default=None, help="Filter by player name (ilike)")
parser.add_argument("--report", action="store_true", help="Show stats only, don't modify")
parser.add_argument("--force", action="store_true", help="Also correct non-inferred rows")
args = parser.parse_args()

DRY_RUN = args.dry_run

# ── Personality system ────────────────────────────────────────────────────────
# ei: Game Reading     — Analytical (A) ≥50 | Instinctive (I) <50
# sn: Motivation       — Extrinsic  (X) ≥50 | Intrinsic   (N) <50
# tf: Social Orient.   — Soloist    (S) ≥50 | Leader      (L) <50
# jp: Pressure Response — Competitor (C) ≥50 | Composer    (P) <50

def compute_code(ei, sn, tf, jp):
    return "".join([
        "A" if ei >= 50 else "I",
        "X" if sn >= 50 else "N",
        "S" if tf >= 50 else "L",
        "C" if jp >= 50 else "P",
    ])


def main():
    print("34 — Rule-Based Personality Corrections")

    conn = require_conn()
    conn.autocommit = False
    cur = get_dict_cursor(conn)

    # ── Load personality data with context ────────────────────────────────
    query = """
        SELECT
            pp.person_id, pp.ei, pp.sn, pp.tf, pp.jp,
            pp.competitiveness, pp.coachability, pp.is_inferred,
            pe.name, pe.date_of_birth,
            prof.position, prof.level, prof.archetype,
            cm.trajectory, cm.loyalty_score, cm.mobility_score, cm.clubs_count,
            ps.scouting_notes, ps.mental_tag
        FROM player_personality pp
        JOIN people pe ON pe.id = pp.person_id
        LEFT JOIN player_profiles prof ON prof.person_id = pp.person_id
        LEFT JOIN career_metrics cm ON cm.person_id = pp.person_id
        LEFT JOIN player_status ps ON ps.person_id = pp.person_id
        WHERE 1=1
    """
    params = []
    if not args.force:
        query += " AND pp.is_inferred = true"
    if args.player:
        query += " AND pe.name ILIKE %s"
        params.append(f"%{args.player}%")

    cur.execute(query, params)
    players = cur.fetchall()
    print(f"  Loaded {len(players)} personality rows")

    # ── Load attribute grades for rule heuristics ─────────────────────────
    cur.execute("""
        SELECT player_id,
               MAX(CASE WHEN attribute = 'pressing' THEN COALESCE(scout_grade, stat_score) END) as pressing,
               MAX(CASE WHEN attribute = 'awareness' THEN COALESCE(scout_grade, stat_score) END) as awareness,
               MAX(CASE WHEN attribute = 'positioning' THEN COALESCE(scout_grade, stat_score) END) as positioning,
               MAX(CASE WHEN attribute = 'creativity' THEN COALESCE(scout_grade, stat_score) END) as creativity,
               MAX(CASE WHEN attribute = 'discipline' THEN COALESCE(scout_grade, stat_score) END) as discipline,
               MAX(CASE WHEN attribute = 'composure' THEN COALESCE(scout_grade, stat_score) END) as composure,
               MAX(CASE WHEN attribute = 'leadership' THEN COALESCE(scout_grade, stat_score) END) as leadership,
               MAX(CASE WHEN attribute = 'communication' THEN COALESCE(scout_grade, stat_score) END) as communication,
               MAX(CASE WHEN attribute = 'take_ons' THEN COALESCE(scout_grade, stat_score) END) as take_ons,
               MAX(CASE WHEN attribute = 'skills' THEN COALESCE(scout_grade, stat_score) END) as skills,
               MAX(CASE WHEN attribute = 'pace' THEN COALESCE(scout_grade, stat_score) END) as pace,
               MAX(CASE WHEN attribute = 'aggression' THEN COALESCE(scout_grade, stat_score) END) as aggression,
               MAX(CASE WHEN attribute = 'heading' THEN COALESCE(scout_grade, stat_score) END) as heading,
               MAX(CASE WHEN attribute = 'duels' THEN COALESCE(scout_grade, stat_score) END) as duels,
               MAX(CASE WHEN attribute = 'stamina' THEN COALESCE(scout_grade, stat_score) END) as stamina
        FROM attribute_grades
        GROUP BY player_id
    """)
    attrs = {row["player_id"]: row for row in cur.fetchall()}
    print(f"  Loaded attribute grades for {len(attrs)} players")

    # ── Apply rules ───────────────────────────────────────────────────────

    corrections = []
    rule_counts = Counter()

    for p in players:
        pid = p["person_id"]
        ei, sn, tf, jp = p["ei"], p["sn"], p["tf"], p["jp"]
        comp = p["competitiveness"] or 5
        coach = p["coachability"] or 5
        pos = p.get("position") or ""
        archetype = p.get("archetype") or ""
        new_ei, new_sn, new_tf, new_jp = ei, sn, tf, jp
        reasons = []
        attr = attrs.get(pid, {})

        pressing = attr.get("pressing") or 0
        awareness = attr.get("awareness") or 0
        creativity = attr.get("creativity") or 0
        discipline = attr.get("discipline") or 0
        composure = attr.get("composure") or 0
        lead = attr.get("leadership") or 0
        comm = attr.get("communication") or 0
        take_ons = attr.get("take_ons") or 0
        skills = attr.get("skills") or 0
        aggression = attr.get("aggression") or 0
        heading = attr.get("heading") or 0
        duels = attr.get("duels") or 0
        stamina = attr.get("stamina") or 0
        pace = attr.get("pace") or 0

        # ── Rule 1: High competitiveness → Intrinsic (N)
        # Self-driven players with high comp are intrinsically motivated, not occasion-driven.
        if comp >= 8 and new_sn >= 50 and new_sn <= 65:
            new_sn = max(30, 100 - new_sn)
            reasons.append(f"R1:comp={comp}→N(sn:{sn}→{new_sn})")
            rule_counts["R1_comp_intrinsic"] += 1

        # ── Rule 2: Pressing intelligence → Analytical (A)
        if pressing >= 13 and awareness >= 12 and new_ei < 50:
            new_ei = max(55, new_ei + 15)
            reasons.append(f"R2:press={pressing},aware={awareness}→A(ei→{new_ei})")
            rule_counts["R2_pressing_analytical"] += 1

        # ── Rule 3: High creativity + low discipline → Instinctive (I)
        if creativity >= 13 and discipline <= 10 and new_ei >= 50:
            new_ei = min(40, new_ei - 15)
            reasons.append(f"R3:creat={creativity},disc={discipline}→I(ei→{new_ei})")
            rule_counts["R3_creative_instinctive"] += 1

        # ── Rule 4: Loyalty → Intrinsic (N)
        loyalty = p.get("loyalty_score") or 0
        trajectory = p.get("trajectory") or ""
        if (loyalty >= 14 or trajectory == "one-club") and new_sn >= 50:
            new_sn = min(35, new_sn - 20)
            reasons.append(f"R4:loyalty={loyalty},traj={trajectory}→N(sn→{new_sn})")
            rule_counts["R4_loyalty_intrinsic"] += 1

        # ── Rule 5: High mobility + many clubs → Extrinsic (X)
        mobility = p.get("mobility_score") or 0
        clubs = p.get("clubs_count") or 0
        if clubs >= 6 and mobility >= 14 and new_sn < 50 and comp < 7:
            new_sn = max(55, new_sn + 15)
            reasons.append(f"R5:clubs={clubs},mob={mobility}→X(sn→{new_sn})")
            rule_counts["R5_mobility_extrinsic"] += 1

        # ── Rule 6: Leadership + communication → Leader (L)
        if lead >= 13 and comm >= 12 and new_tf >= 50:
            new_tf = min(35, new_tf - 20)
            reasons.append(f"R6:lead={lead},comm={comm}→L(tf→{new_tf})")
            rule_counts["R6_leader"] += 1

        # ── Rule 7: High composure + low comp → Composer (P)
        if composure >= 14 and comp <= 6 and new_jp >= 50:
            new_jp = min(35, new_jp - 20)
            reasons.append(f"R7:composure={composure},compet={comp}→P(jp→{new_jp})")
            rule_counts["R7_composure_composer"] += 1

        # ── Rule 8: Very high competitiveness → Competitor (C)
        if comp >= 9 and new_jp < 50:
            new_jp = max(60, new_jp + 20)
            reasons.append(f"R8:compet={comp}→C(jp→{new_jp})")
            rule_counts["R8_competitive_competitor"] += 1

        # ── Rule 9: Flair attackers → Instinctive (I)
        # WF/AM with high take_ons + skills are instinct-driven, not analytical.
        # The heuristic over-credits awareness/positioning for these players.
        if pos in ("WF", "AM", "WM") and take_ons >= 12 and skills >= 11 and new_ei >= 50:
            push = min(15, take_ons - 8)  # scale by how strong the flair signal is
            new_ei = max(30, new_ei - push)
            reasons.append(f"R9:flair({pos},to={take_ons},sk={skills})→I(ei→{new_ei})")
            rule_counts["R9_flair_instinctive"] += 1

        # ── Rule 10: Physical/aerial forwards → Competitor (C)
        # Target men and physical CFs with high heading + aggression are competitors.
        if pos == "CF" and heading >= 14 and aggression >= 12 and new_jp < 50:
            new_jp = max(55, new_jp + 15)
            reasons.append(f"R10:aerial_cf(head={heading},agg={aggression})→C(jp→{new_jp})")
            rule_counts["R10_aerial_competitor"] += 1

        # ── Rule 11: Defensive position tf guard → Leader (L)
        # DMs, CDs, and GKs are almost never Soloists. If tf > 55, cap it.
        # These positions organise and communicate by nature.
        if pos in ("DM", "CD", "GK") and new_tf > 55:
            new_tf = min(45, 100 - new_tf)  # flip toward Leader
            reasons.append(f"R11:def_pos({pos})→L(tf→{new_tf})")
            rule_counts["R11_defensive_leader"] += 1

        # ── Rule 12: Composed goal-scorers → Intrinsic (N)
        # CFs with high composure who are borderline Extrinsic are likely self-driven.
        # Haaland, Kane, Lewandowski types — clinical finishers, not showmen.
        if pos == "CF" and composure >= 12 and new_sn >= 48 and new_sn <= 58:
            new_sn = max(35, new_sn - 15)
            reasons.append(f"R12:clinical_cf(comp={composure})→N(sn→{new_sn})")
            rule_counts["R12_clinical_intrinsic"] += 1

        # ── Rule 13: Engine/Commander archetypes → Leader (L)
        # Players whose primary model is Commander or Engine-Commander are vocal leaders.
        primary = archetype.split("-")[0] if archetype else ""
        if "Commander" in archetype and new_tf >= 50:
            new_tf = min(38, new_tf - 15)
            reasons.append(f"R13:commander({archetype})→L(tf→{new_tf})")
            rule_counts["R13_commander_leader"] += 1

        # ── Rule 14: Near-midpoint scores → push further from 50
        # Scores 48-52 are coin flips. Push 6 points in whichever direction.
        dims = [new_ei, new_sn, new_tf, new_jp]
        for i, v in enumerate(dims):
            if 48 <= v <= 52:
                if v >= 50:
                    dims[i] = min(58, v + 6)
                else:
                    dims[i] = max(42, v - 6)
        new_ei, new_sn, new_tf, new_jp = dims

        # ── Check if anything changed ────────────────────────────────────
        if new_ei != ei or new_sn != sn or new_tf != tf or new_jp != jp:
            old_code = compute_code(ei, sn, tf, jp)
            new_code = compute_code(new_ei, new_sn, new_tf, new_jp)
            corrections.append({
                "person_id": pid,
                "name": p["name"],
                "old": f"{old_code} ({ei}/{sn}/{tf}/{jp})",
                "new": f"{new_code} ({new_ei}/{new_sn}/{new_tf}/{new_jp})",
                "ei": new_ei, "sn": new_sn, "tf": new_tf, "jp": new_jp,
                "reasons": " | ".join(reasons),
                "code_changed": old_code != new_code,
            })

    # ── Report ────────────────────────────────────────────────────────────

    type_changed = sum(1 for c in corrections if c["code_changed"])
    print(f"\n  Corrections: {len(corrections)} players")
    print(f"  Type changed: {type_changed}")
    print(f"  Scores nudged (same type): {len(corrections) - type_changed}")
    print(f"\n  Rules triggered:")
    for rule, count in rule_counts.most_common():
        print(f"    {rule}: {count}")

    # Show sample corrections
    print(f"\n  Sample corrections (first 15):")
    for c in corrections[:15]:
        flag = " *TYPE CHANGE*" if c["code_changed"] else ""
        print(f"    {c['name']}: {c['old']} → {c['new']}{flag}")
        print(f"      {c['reasons']}")

    if args.report:
        # Distribution after corrections
        print(f"\n  ── Projected type distribution ──")
        type_counter = Counter()
        corrected_pids = {c["person_id"] for c in corrections}
        for p in players:
            if p["person_id"] in corrected_pids:
                c = next(c for c in corrections if c["person_id"] == p["person_id"])
                type_counter[compute_code(c["ei"], c["sn"], c["tf"], c["jp"])] += 1
            else:
                type_counter[compute_code(p["ei"], p["sn"], p["tf"], p["jp"])] += 1
        for code, count in type_counter.most_common():
            pct = count / len(players) * 100
            print(f"    {code}: {count} ({pct:.1f}%)")
        conn.close()
        return

    if DRY_RUN:
        print(f"\n  DRY RUN — no changes written")
        conn.close()
        return

    # ── Write corrections ─────────────────────────────────────────────────
    print(f"\n  Writing {len(corrections)} corrections...")
    updated = 0
    for c in corrections:
        try:
            cur.execute("""
                UPDATE player_personality
                SET ei = %s, sn = %s, tf = %s, jp = %s,
                    inference_notes = %s,
                    updated_at = NOW()
                WHERE person_id = %s AND is_inferred = true
            """, (c["ei"], c["sn"], c["tf"], c["jp"], c["reasons"], c["person_id"]))
            updated += cur.rowcount
        except Exception as e:
            print(f"    ERROR updating {c['name']}: {e}")

    conn.commit()
    print(f"  Updated {updated} rows")

    # ── Verify ────────────────────────────────────────────────────────────
    cur.execute("""
        SELECT
            CONCAT(
                CASE WHEN ei >= 50 THEN 'A' ELSE 'I' END,
                CASE WHEN sn >= 50 THEN 'X' ELSE 'N' END,
                CASE WHEN tf >= 50 THEN 'S' ELSE 'L' END,
                CASE WHEN jp >= 50 THEN 'C' ELSE 'P' END
            ) as code,
            COUNT(*) as cnt
        FROM player_personality
        GROUP BY 1
        ORDER BY cnt DESC
        LIMIT 10
    """)
    print(f"\n  ── Post-correction type distribution (top 10) ──")
    for row in cur.fetchall():
        print(f"    {row['code']}: {row['cnt']}")

    conn.close()
    print("\n  Done.")


if __name__ == "__main__":
    main()
