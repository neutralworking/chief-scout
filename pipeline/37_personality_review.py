"""
37_personality_review.py — Automated personality QA review.

Replaces manual /admin/personality review for the bulk of players.
Runs cross-validation checks against multiple data sources and auto-fixes
clear contradictions. Flags ambiguous cases for human spot-check.

Three tiers:
  AUTO-FIX   — clear rule violations (applied automatically)
  FLAG       — likely issues needing human judgement (logged, not changed)
  PASS       — no issues detected

Checks:
  C1. Trait-dimension correlation (comp vs jp, coach vs discipline)
  C2. Career-personality alignment (loyalty/mobility vs sn)
  C3. Scouting note keyword analysis (text contradicts dimensions)
  C4. Attribute-dimension alignment (pressing/creativity vs ei)
  C5. Near-midpoint clustering (scores 46-54 without clear signal)
  C6. Position heuristics (GK/DM leader tendency, WF/CF soloist tendency)
  C7. Competitiveness-coachability range sanity (1-10 scale)

Usage:
    python 37_personality_review.py                  # run full review + auto-fix
    python 37_personality_review.py --dry-run        # preview only
    python 37_personality_review.py --report         # stats only
    python 37_personality_review.py --player "Guendouzi"
    python 37_personality_review.py --flagged-only   # show only flagged players
    python 37_personality_review.py --level 80       # min level filter
"""
from __future__ import annotations

import argparse
import re
from collections import Counter

from lib.db import require_conn, get_dict_cursor

parser = argparse.ArgumentParser(description="Automated personality QA review")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--player", default=None, help="Filter by player name (ilike)")
parser.add_argument("--report", action="store_true", help="Show stats only")
parser.add_argument("--flagged-only", action="store_true", help="Show only flagged players")
parser.add_argument("--level", type=int, default=0, help="Min level filter")
parser.add_argument("--force", action="store_true", help="Review all, including manually reviewed")
args = parser.parse_args()


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


# ── Scouting note keyword patterns ───────────────────────────────────────────
# Each pattern: (compiled regex, dimension, expected_direction, description)
# direction: "high" means dimension should be ≥55, "low" means ≤45

NOTE_PATTERNS = [
    # ei: Analytical vs Instinctive
    (re.compile(r"\b(reads the game|tactical[ly]? aware|position[al]? intelligence|game reader)\b", re.I),
     "ei", "high", "analytical keywords"),
    (re.compile(r"\b(disciplined|structured|organis[ez]|methodical)\b", re.I),
     "ei", "high", "structured play"),
    (re.compile(r"\b(instinct|flair|improvise?s?|unpredictable|maverick|unorthodox)\b", re.I),
     "ei", "low", "instinctive keywords"),
    (re.compile(r"\b(creative genius|plays? by feel|natural talent|raw ability)\b", re.I),
     "ei", "low", "raw instinct"),

    # sn: Extrinsic vs Intrinsic
    (re.compile(r"\b(big.?game|occasion|spotlight|showman|entertainer|loves?.the.crowd)\b", re.I),
     "sn", "high", "extrinsic motivation"),
    (re.compile(r"\b(quiet professionalism|humble|understated|low.?key|self.?motivated|inner drive)\b", re.I),
     "sn", "low", "intrinsic motivation"),
    (re.compile(r"\b(one.?club|loyal(ty)?|servant|dedicated|committed)\b", re.I),
     "sn", "low", "loyalty keywords"),
    (re.compile(r"\b(mercenary|journeyman|pay.?check|highest bidder)\b", re.I),
     "sn", "high", "mercenary keywords"),

    # tf: Soloist vs Leader
    (re.compile(r"\b(leader|captain|organis[ez]|marshall|vocal|commands?)\b", re.I),
     "tf", "low", "leadership keywords"),
    (re.compile(r"\b(quiet|silent|reserved|introvert|keeps? to himself)\b", re.I),
     "tf", "high", "soloist keywords"),
    (re.compile(r"\b(individual|lone|solo|selfish|does his own)\b", re.I),
     "tf", "high", "individualist keywords"),

    # jp: Competitor vs Composer
    (re.compile(r"\b(compet[ei]tive|warrior|fighter|never gives up|win at all costs|fierce)\b", re.I),
     "jp", "high", "competitor keywords"),
    (re.compile(r"\b(composed|calm|cool head|unfazed|serene|ice.?cold|metronomic)\b", re.I),
     "jp", "low", "composer keywords"),
    (re.compile(r"\b(hot.?head|temper|aggressive|red card|volatile|fiery)\b", re.I),
     "jp", "high", "aggression keywords"),
]

# Position tendencies (soft — flag, don't auto-fix)
POSITION_LEADER_TENDENCY = {"GK", "CD", "DM"}  # tf typically <50
POSITION_SOLOIST_TENDENCY = {"WF", "CF", "AM"}  # tf typically ≥50

# Reliable sources for attribute-based checks (excludes EAFC which pollutes)
RELIABLE_SOURCES = ('scout_assessment', 'api_football', 'statsbomb', 'fbref', 'understat')


def analyze_notes(notes: str | None) -> list[dict]:
    """Scan scouting notes for personality-relevant keywords."""
    if not notes:
        return []
    hits = []
    for pattern, dim, direction, desc in NOTE_PATTERNS:
        if pattern.search(notes):
            hits.append({"dim": dim, "direction": direction, "desc": desc})
    return hits


def main():
    print("37 — Automated Personality Review")

    conn = require_conn()
    conn.autocommit = False
    cur = get_dict_cursor(conn)

    # ── Load personality data with full context ───────────────────────────
    query = """
        SELECT
            pp.person_id, pp.ei, pp.sn, pp.tf, pp.jp,
            pp.competitiveness, pp.coachability,
            pp.is_inferred, pp.confidence, pp.inference_notes,
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
    if args.level > 0:
        query += " AND COALESCE(prof.level, 0) >= %s"
        params.append(args.level)

    cur.execute(query, params)
    players = cur.fetchall()
    print(f"  Loaded {len(players)} personality rows")

    # ── Load attribute grades (reliable sources only) ──────────────────────
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
               MAX(CASE WHEN attribute = 'aggression' THEN COALESCE(scout_grade, stat_score) END) as aggression
        FROM attribute_grades
        WHERE source IN %s
        GROUP BY player_id
    """, (RELIABLE_SOURCES,))
    attrs = {row["player_id"]: row for row in cur.fetchall()}
    print(f"  Loaded attribute grades for {len(attrs)} players (reliable sources only)")

    # ── Run checks ────────────────────────────────────────────────────────

    auto_fixes = []     # clear contradictions → auto-correct
    flags = []          # likely issues → log for human review
    passes = 0
    check_counts = Counter()

    for p in players:
        pid = p["person_id"]
        ei, sn, tf, jp = p["ei"], p["sn"], p["tf"], p["jp"]
        comp = p["competitiveness"]
        coach = p["coachability"]
        position = p.get("position") or ""
        level = p.get("level") or 0
        notes = p.get("scouting_notes") or ""
        loyalty = p.get("loyalty_score") or 0
        mobility = p.get("mobility_score") or 0
        clubs = p.get("clubs_count") or 0
        trajectory = p.get("trajectory") or ""
        attr = attrs.get(pid, {})
        name = p["name"]

        issues = []  # (severity, check_id, message, fix?)
        dims = {"ei": ei, "sn": sn, "tf": tf, "jp": jp}

        # ── C1: Trait-dimension correlation ───────────────────────────
        # High competitiveness should correlate with Competitor (jp ≥ 50)
        if (comp or 0) >= 8 and jp < 40:
            gap = 50 - jp
            dims["jp"] = min(65, jp + int(gap * 0.6))
            issues.append(("FIX", "C1a", f"comp={comp} but jp={jp} (Composer) — should lean Competitor", True))
            check_counts["C1a_comp_jp_fix"] += 1

        # Low competitiveness shouldn't have very high Competitor
        if (comp or 0) <= 3 and jp >= 65:
            dims["jp"] = max(40, jp - int((jp - 50) * 0.5))
            issues.append(("FIX", "C1b", f"comp={comp} but jp={jp} (strong Competitor) — inconsistent", True))
            check_counts["C1b_low_comp_competitor"] += 1

        # High coachability + high discipline → shouldn't be extreme Soloist
        discipline = attr.get("discipline") or 0
        if (coach or 0) >= 8 and discipline >= 13 and tf >= 70:
            issues.append(("FLAG", "C1c", f"coach={coach},disc={discipline} but tf={tf} (strong Soloist) — unusual", False))
            check_counts["C1c_coach_soloist_flag"] += 1

        # ── C2: Career-personality alignment ──────────────────────────
        # Strong one-club loyalty → should be Intrinsic
        if (loyalty >= 16 or trajectory == "one-club") and sn >= 60:
            dims["sn"] = max(30, sn - int((sn - 45) * 0.5))
            issues.append(("FIX", "C2a", f"loyalty={loyalty},traj={trajectory} but sn={sn} (Extrinsic) — should be Intrinsic", True))
            check_counts["C2a_loyalty_extrinsic_fix"] += 1

        # High mobility + many clubs + low comp → likely Extrinsic
        if clubs >= 7 and mobility >= 16 and (comp or 0) <= 5 and sn < 40:
            dims["sn"] = min(60, sn + int((55 - sn) * 0.5))
            issues.append(("FIX", "C2b", f"clubs={clubs},mob={mobility} but sn={sn} (Intrinsic) — likely Extrinsic", True))
            check_counts["C2b_mobility_intrinsic_fix"] += 1

        # ── C3: Scouting note keyword analysis ────────────────────────
        note_hits = analyze_notes(notes)
        for hit in note_hits:
            dim = hit["dim"]
            val = dims[dim]
            expected_high = hit["direction"] == "high"

            # Check contradiction: notes say high but score is low, or vice versa
            if expected_high and val < 40:
                issues.append(("FLAG", "C3", f"notes say '{hit['desc']}' (expect {dim}≥55) but {dim}={val}", False))
                check_counts[f"C3_{dim}_note_contradiction"] += 1
            elif not expected_high and val > 60:
                issues.append(("FLAG", "C3", f"notes say '{hit['desc']}' (expect {dim}≤45) but {dim}={val}", False))
                check_counts[f"C3_{dim}_note_contradiction"] += 1

        # ── C4: Attribute-dimension alignment ─────────────────────────
        pressing = attr.get("pressing") or 0
        creativity = attr.get("creativity") or 0
        composure = attr.get("composure") or 0
        aggression = attr.get("aggression") or 0

        # Very high pressing + awareness but scored Instinctive
        if pressing >= 15 and (attr.get("awareness") or 0) >= 14 and dims["ei"] < 40:
            if level < 85:
                dims["ei"] = max(55, dims["ei"] + 20)
                issues.append(("FIX", "C4a", f"press={pressing},aware={(attr.get('awareness') or 0)} but ei={ei} (strong Instinctive) — should be Analytical", True))
                check_counts["C4a_press_instinctive_fix"] += 1
            else:
                issues.append(("FLAG", "C4a", f"press={pressing},aware={(attr.get('awareness') or 0)} but ei={ei} — check if Analytical fits", False))
                check_counts["C4a_press_instinctive_flag"] += 1

        # Very high creativity + low discipline but scored Analytical
        if creativity >= 16 and discipline <= 7 and dims["ei"] > 70:
            issues.append(("FLAG", "C4b", f"creat={creativity},disc={discipline} but ei={ei} (strong Analytical) — verify with scouting notes", False))
            check_counts["C4b_creative_analytical_flag"] += 1

        # High aggression should push toward Competitor
        if aggression >= 15 and dims["jp"] < 40:
            issues.append(("FLAG", "C4c", f"aggression={aggression} but jp={dims['jp']} (Composer) — may need Competitor push", False))
            check_counts["C4c_aggression_composer_flag"] += 1

        # High composure + low aggression should push toward Composer
        if composure >= 15 and aggression <= 8 and dims["jp"] > 65:
            issues.append(("FLAG", "C4d", f"composure={composure},aggr={aggression} but jp={dims['jp']} (strong Competitor) — may need Composer push", False))
            check_counts["C4d_composure_competitor_flag"] += 1

        # ── C5: Near-midpoint clustering (multi-signal resolution) ───
        midpoint_dims = []
        for dim_name in ("ei", "sn", "tf", "jp"):
            if 45 <= dims[dim_name] <= 55:
                midpoint_dims.append(dim_name)
        if len(midpoint_dims) >= 2:
            issues.append(("FLAG", "C5", f"multiple near-midpoint: {','.join(midpoint_dims)} — type is a coin flip", False))
            check_counts["C5_multi_midpoint_flag"] += 1

        # Per-dimension: accumulate signal score from ALL evidence, then push
        for dim_name in ("ei", "sn", "tf", "jp"):
            val = dims[dim_name]
            if not (46 <= val <= 54):
                continue

            signals = 0  # positive = push up, negative = push down
            signal_count = 0

            if dim_name == "ei":
                if pressing >= 13:
                    signals += 1; signal_count += 1
                if (attr.get("awareness") or 0) >= 13:
                    signals += 1; signal_count += 1
                if creativity >= 13:
                    signals -= 1; signal_count += 1
                if discipline >= 13:
                    signals += 1; signal_count += 1
                # Note keywords
                for hit in note_hits:
                    if hit["dim"] == "ei":
                        signals += 1 if hit["direction"] == "high" else -1
                        signal_count += 1

            elif dim_name == "sn":
                if loyalty >= 12:
                    signals -= 1; signal_count += 1
                if mobility >= 12:
                    signals += 1; signal_count += 1
                if clubs >= 5:
                    signals += 1; signal_count += 1
                if trajectory == "one-club":
                    signals -= 1; signal_count += 1
                for hit in note_hits:
                    if hit["dim"] == "sn":
                        signals += 1 if hit["direction"] == "high" else -1
                        signal_count += 1

            elif dim_name == "tf":
                if position in POSITION_LEADER_TENDENCY:
                    signals -= 1; signal_count += 1
                if position in POSITION_SOLOIST_TENDENCY:
                    signals += 1; signal_count += 1
                if (attr.get("leadership") or 0) >= 13:
                    signals -= 1; signal_count += 1
                if (attr.get("communication") or 0) >= 13:
                    signals -= 1; signal_count += 1
                for hit in note_hits:
                    if hit["dim"] == "tf":
                        signals += 1 if hit["direction"] == "high" else -1
                        signal_count += 1

            elif dim_name == "jp":
                if (comp or 0) >= 7:
                    signals += 1; signal_count += 1
                if (comp or 0) <= 3:
                    signals -= 1; signal_count += 1
                if composure >= 13:
                    signals -= 1; signal_count += 1
                if aggression >= 13:
                    signals += 1; signal_count += 1
                for hit in note_hits:
                    if hit["dim"] == "jp":
                        signals += 1 if hit["direction"] == "high" else -1
                        signal_count += 1

            if signals == 0:
                continue

            # Push strength scales with consensus (net signals), not volume
            net = abs(signals)
            if net >= 3:
                push_strength = 8
            elif net >= 2:
                push_strength = 6
            else:
                push_strength = 4

            push = push_strength if signals > 0 else -push_strength
            new_val = max(38, min(62, val + push))
            dims[dim_name] = new_val
            direction = "up" if push > 0 else "down"
            issues.append(("FIX", "C5fix", f"{dim_name}={val} (midpoint) → pushed {direction} to {new_val} ({signal_count} signal{'s' if signal_count > 1 else ''})", True))
            check_counts["C5_midpoint_push_fix"] += 1

        new_ei, new_sn, new_tf, new_jp = dims["ei"], dims["sn"], dims["tf"], dims["jp"]

        # ── C6: Position heuristics (flag only) ──────────────────────
        if position in POSITION_LEADER_TENDENCY and new_tf >= 70:
            issues.append(("FLAG", "C6", f"{position} typically Leader (tf<50) but tf={new_tf} — strong Soloist is unusual", False))
            check_counts["C6_position_leader_flag"] += 1
        if position in POSITION_SOLOIST_TENDENCY and new_tf <= 30:
            issues.append(("FLAG", "C6", f"{position} typically Soloist (tf≥50) but tf={new_tf} — strong Leader is unusual", False))
            check_counts["C6_position_soloist_flag"] += 1

        # ── C7: Trait range sanity ────────────────────────────────────
        if comp is not None and (comp < 1 or comp > 10):
            issues.append(("FLAG", "C7", f"competitiveness={comp} out of 1-10 range", False))
            check_counts["C7_comp_range"] += 1
        if coach is not None and (coach < 1 or coach > 10):
            issues.append(("FLAG", "C7", f"coachability={coach} out of 1-10 range", False))
            check_counts["C7_coach_range"] += 1

        # ── Classify result ───────────────────────────────────────────
        has_fix = any(sev == "FIX" for sev, _, _, _ in issues)
        has_flag = any(sev == "FLAG" for sev, _, _, _ in issues)

        if has_fix:
            old_code = compute_code(ei, sn, tf, jp)
            new_code = compute_code(new_ei, new_sn, new_tf, new_jp)
            auto_fixes.append({
                "person_id": pid,
                "name": name,
                "level": level,
                "position": position,
                "old_code": old_code,
                "new_code": new_code,
                "old_scores": f"{ei}/{sn}/{tf}/{jp}",
                "new_scores": f"{new_ei}/{new_sn}/{new_tf}/{new_jp}",
                "ei": new_ei, "sn": new_sn, "tf": new_tf, "jp": new_jp,
                "issues": issues,
                "code_changed": old_code != new_code,
            })
        elif has_flag:
            flags.append({
                "person_id": pid,
                "name": name,
                "level": level,
                "position": position,
                "code": compute_code(ei, sn, tf, jp),
                "scores": f"{ei}/{sn}/{tf}/{jp}",
                "issues": issues,
            })
        else:
            passes += 1

    # ── Report ────────────────────────────────────────────────────────────

    print(f"\n  ── Review Results ──")
    print(f"  Total reviewed:  {len(players)}")
    print(f"  PASS (clean):    {passes}")
    print(f"  AUTO-FIX:        {len(auto_fixes)} ({sum(1 for f in auto_fixes if f['code_changed'])} type changes)")
    print(f"  FLAG (human QA): {len(flags)}")

    print(f"\n  ── Checks triggered ──")
    for check, count in check_counts.most_common():
        print(f"    {check}: {count}")

    # Show auto-fixes
    if auto_fixes:
        print(f"\n  ── Auto-fixes (top 20) ──")
        for f in sorted(auto_fixes, key=lambda x: -(x["level"] or 0))[:20]:
            flag = " *TYPE*" if f["code_changed"] else ""
            print(f"    [{f['level'] or '?':>3}] {f['name']:<25} {f['old_code']} ({f['old_scores']}) → {f['new_code']} ({f['new_scores']}){flag}")
            for sev, cid, msg, _ in f["issues"]:
                print(f"          [{sev}] {cid}: {msg}")

    # Show flags
    if flags and not args.flagged_only:
        print(f"\n  ── Flagged for human review (top 20) ──")
        for f in sorted(flags, key=lambda x: -(x["level"] or 0))[:20]:
            print(f"    [{f['level'] or '?':>3}] {f['name']:<25} {f['code']} ({f['scores']})")
            for sev, cid, msg, _ in f["issues"]:
                print(f"          [{sev}] {cid}: {msg}")
    elif args.flagged_only and flags:
        print(f"\n  ── All flagged players ──")
        for f in sorted(flags, key=lambda x: -(x["level"] or 0)):
            print(f"    [{f['level'] or '?':>3}] {f['name']:<25} {f['code']} ({f['scores']})")
            for sev, cid, msg, _ in f["issues"]:
                print(f"          [{sev}] {cid}: {msg}")

    if args.report:
        conn.close()
        return

    if args.dry_run:
        print(f"\n  DRY RUN — no changes written")
        conn.close()
        return

    if not auto_fixes:
        print(f"\n  No auto-fixes needed — all clean or flagged only.")
        conn.close()
        return

    # ── Write auto-fixes (batched) ─────────────────────────────────────────
    print(f"\n  Writing {len(auto_fixes)} auto-fixes...")
    batch_params = []
    for f in auto_fixes:
        reasons = " | ".join(f"{cid}: {msg}" for _, cid, msg, _ in f["issues"])
        batch_params.append((f["ei"], f["sn"], f["tf"], f["jp"], reasons, f["person_id"]))

    try:
        cur.executemany("""
            UPDATE player_personality
            SET ei = %s, sn = %s, tf = %s, jp = %s,
                inference_notes = COALESCE(inference_notes, '') || ' | QA37: ' || %s,
                confidence = CASE
                    WHEN confidence = 'Low' THEN 'Low'
                    ELSE confidence
                END,
                updated_at = NOW()
            WHERE person_id = %s
        """, batch_params)
        conn.commit()
        print(f"  Updated {len(auto_fixes)} rows")
    except Exception as e:
        print(f"    ERROR in batch update: {e}")
        conn.rollback()
        conn.close()
        return

    # ── Post-fix distribution ─────────────────────────────────────────────
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
    """)
    print(f"\n  ── Post-review type distribution ──")
    for row in cur.fetchall():
        pct = row["cnt"] / len(players) * 100 if players else 0
        print(f"    {row['code']}: {row['cnt']} ({pct:.1f}%)")

    # ── Summary for flagged ───────────────────────────────────────────────
    if flags:
        print(f"\n  ⚠ {len(flags)} players flagged for manual review at /admin/personality")
        high_level_flags = [f for f in flags if (f["level"] or 0) >= 80]
        if high_level_flags:
            print(f"    Including {len(high_level_flags)} with level ≥ 80:")
            for f in high_level_flags[:10]:
                print(f"      {f['name']} (L{f['level']})")

    conn.close()
    print("\n  Done.")


if __name__ == "__main__":
    main()
