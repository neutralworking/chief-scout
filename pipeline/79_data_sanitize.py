"""
37_data_sanitize.py — Comprehensive data sanitation: audit, validate, fix, and report enrichment gaps.

Three modes:
  --audit     Report all issues without fixing (default)
  --fix       Auto-fix what can be fixed safely
  --enrich    Report enrichment gaps (what's missing for Tier 1 promotion)

Combines:
  1. Identity sanitation (people): duplicates, invalid DOB/height/foot, missing fields
  2. Profile sanitation (player_profiles): invalid positions, out-of-range levels, bad archetypes
  3. Personality sanitation (player_personality): out-of-range scores, invalid codes
  4. Market sanitation (player_market): negative values, inconsistent tiers
  5. Attribute sanitation (attribute_grades): out-of-range grades, orphaned records
  6. Status sanitation (player_status): invalid enums, garbage bios
  7. Cross-table integrity: orphaned records, missing FKs
  8. Enrichment gaps: what's missing for production promotion

Usage:
    python 37_data_sanitize.py --audit                  # full audit report
    python 37_data_sanitize.py --fix --dry-run           # preview fixes
    python 37_data_sanitize.py --fix                     # apply fixes
    python 37_data_sanitize.py --enrich                  # enrichment gap report
    python 37_data_sanitize.py --audit --fix --enrich    # everything
"""
from __future__ import annotations

import argparse
import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime

from config import POSTGRES_DSN
from validation import (
    VALID_POSITIONS, VALID_MODELS, VALID_PERSONALITY_CODES,
    VALID_PURSUIT_STATUS, VALID_FEET, VALID_FITNESS_TAGS, VALID_MENTAL_TAGS,
    VALID_DISCIPLINARY_TAGS, VALID_TACTICAL_TAGS, VALID_CONTRACT_TAGS, VALID_MVT,
)

parser = argparse.ArgumentParser(description="Comprehensive data sanitation")
parser.add_argument("--audit", action="store_true", help="Report all issues")
parser.add_argument("--fix", action="store_true", help="Auto-fix safe issues")
parser.add_argument("--enrich", action="store_true", help="Report enrichment gaps")
parser.add_argument("--dry-run", action="store_true", help="Preview fixes without writing")
parser.add_argument("--verbose", action="store_true", help="Show every issue detail")
parser.add_argument("--limit", type=int, default=0, help="Limit examples per category")
args = parser.parse_args()

# Default to audit if nothing specified
if not args.audit and not args.fix and not args.enrich:
    args.audit = True

DRY_RUN = args.dry_run
VERBOSE = args.verbose
LIMIT = args.limit or 20


def strip_accents(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn').lower()


def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def subsection(title: str):
    print(f"\n  ── {title} ──")


def issue(msg: str, severity: str = "ERROR"):
    print(f"    [{severity}] {msg}")


def stat(label: str, value):
    print(f"    {label}: {value}")


def main():
    import psycopg2
    import psycopg2.extras

    print("37 — Comprehensive Data Sanitation")
    print(f"    Mode: {'audit' if args.audit else ''} {'fix' if args.fix else ''} "
          f"{'enrich' if args.enrich else ''} {'(dry-run)' if DRY_RUN else ''}")

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    fixes_applied = 0
    issues_found = 0

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 1: IDENTITY SANITATION (people)
    # ══════════════════════════════════════════════════════════════════════
    if args.audit or args.fix:
        section("1. Identity Sanitation (people)")

        cur.execute("""
            SELECT pe.id, pe.name, pe.date_of_birth, pe.height_cm,
                   pe.preferred_foot, pe.nation_id, pe.club_id, pe.active,
                   pe.wikidata_id, c.clubname, n.name as nation_name
            FROM people pe
            LEFT JOIN clubs c ON c.id = pe.club_id
            LEFT JOIN nations n ON n.id = pe.nation_id
            WHERE pe.active = true
            ORDER BY pe.name
        """)
        people = cur.fetchall()
        stat("Active players", len(people))

        # 1a. Duplicate names at same club (accent-insensitive)
        subsection("1a. Accent duplicates at same club")
        by_club: dict[int, list] = defaultdict(list)
        for p in people:
            if p["club_id"]:
                by_club[p["club_id"]].append(p)

        accent_dupes = []
        for club_id, players in by_club.items():
            seen: dict[str, dict] = {}
            for p in players:
                key = strip_accents(p["name"])
                if key in seen:
                    accent_dupes.append((seen[key], p))
                else:
                    seen[key] = p

        stat("Accent duplicate pairs", len(accent_dupes))
        for keep, kill in accent_dupes[:LIMIT]:
            issue(f"'{keep['name']}' (ID={keep['id']}) vs '{kill['name']}' "
                  f"(ID={kill['id']}) @ {keep['clubname']}", "DUPE")
        issues_found += len(accent_dupes)

        # 1b. Invalid/missing DOB
        subsection("1b. Date of birth issues")
        no_dob = [p for p in people if not p["date_of_birth"]]
        stat("Missing DOB", len(no_dob))

        future_dob = [p for p in people if p["date_of_birth"]
                      and p["date_of_birth"] > date(2012, 1, 1)]
        old_dob = [p for p in people if p["date_of_birth"]
                   and p["date_of_birth"] < date(1960, 1, 1)]
        if future_dob:
            issue(f"{len(future_dob)} players with DOB after 2012")
            issues_found += len(future_dob)
        if old_dob:
            issue(f"{len(old_dob)} players with DOB before 1960 (likely retired)", "WARN")

        # 1c. Invalid height
        subsection("1c. Height issues")
        no_height = [p for p in people if not p["height_cm"]]
        stat("Missing height", len(no_height))

        bad_height = [p for p in people if p["height_cm"]
                      and (p["height_cm"] < 150 or p["height_cm"] > 215)]
        if bad_height:
            issue(f"{len(bad_height)} players with height outside 150-215cm")
            for p in bad_height[:LIMIT]:
                issue(f"  {p['name']}: {p['height_cm']}cm", "DETAIL")
            issues_found += len(bad_height)

        # 1d. Invalid/missing foot
        subsection("1d. Preferred foot issues")
        no_foot = [p for p in people if not p["preferred_foot"]]
        stat("Missing foot", len(no_foot))

        bad_foot = [p for p in people if p["preferred_foot"]
                    and p["preferred_foot"] not in VALID_FEET]
        if bad_foot:
            issue(f"{len(bad_foot)} players with invalid foot value")
            for p in bad_foot[:LIMIT]:
                issue(f"  {p['name']}: '{p['preferred_foot']}'", "DETAIL")
            issues_found += len(bad_foot)

            if args.fix:
                # Auto-fix common foot variants
                FOOT_FIXES = {
                    "left": "Left", "right": "Right", "both": "Both",
                    "L": "Left", "R": "Right", "B": "Both",
                    "Left foot": "Left", "Right foot": "Right",
                }
                for p in bad_foot:
                    fixed = FOOT_FIXES.get(p["preferred_foot"])
                    if fixed:
                        if not DRY_RUN:
                            cur.execute("UPDATE people SET preferred_foot = %s WHERE id = %s",
                                        (fixed, p["id"]))
                        print(f"    FIX: {p['name']} foot '{p['preferred_foot']}' → '{fixed}'")
                        fixes_applied += 1

        # 1e. Missing nation/club
        subsection("1e. Missing references")
        no_nation = [p for p in people if not p["nation_id"]]
        no_club = [p for p in people if not p["club_id"]]
        stat("Missing nation", len(no_nation))
        stat("Missing club", len(no_club))

        # 1f. Names with garbage characters
        subsection("1f. Name quality")
        garbage_names = [p for p in people
                         if re.search(r'[{}\[\]<>|\\]', p["name"])
                         or p["name"].startswith("```")
                         or len(p["name"]) < 3]
        if garbage_names:
            issue(f"{len(garbage_names)} players with suspicious names")
            for p in garbage_names[:LIMIT]:
                issue(f"  ID={p['id']}: '{p['name']}'", "DETAIL")
            issues_found += len(garbage_names)

        # 1g. Name whitespace issues (leading/trailing/double spaces)
        whitespace_names = [p for p in people
                            if p["name"] != p["name"].strip()
                            or "  " in p["name"]]
        if whitespace_names:
            issue(f"{len(whitespace_names)} players with whitespace issues in name")
            issues_found += len(whitespace_names)
            if args.fix:
                for p in whitespace_names:
                    cleaned = re.sub(r'\s+', ' ', p["name"]).strip()
                    if not DRY_RUN:
                        cur.execute("UPDATE people SET name = %s WHERE id = %s",
                                    (cleaned, p["id"]))
                    print(f"    FIX: '{p['name']}' → '{cleaned}'")
                    fixes_applied += 1

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 2: PROFILE SANITATION (player_profiles)
    # ══════════════════════════════════════════════════════════════════════
    if args.audit or args.fix:
        section("2. Profile Sanitation (player_profiles)")

        cur.execute("""
            SELECT pp.person_id, pp.position, pp.level, pp.peak, pp.overall,
                   pp.archetype, pp.archetype_confidence, pp.profile_tier,
                   pp.blueprint, pe.name, c.clubname
            FROM player_profiles pp
            JOIN people pe ON pe.id = pp.person_id
            LEFT JOIN clubs c ON c.id = pe.club_id
            WHERE pe.active = true
        """)
        profiles = cur.fetchall()
        stat("Active profiles", len(profiles))

        # 2a. Invalid positions
        subsection("2a. Position validation")
        bad_positions = [p for p in profiles if p["position"]
                         and p["position"] not in VALID_POSITIONS]
        if bad_positions:
            issue(f"{len(bad_positions)} profiles with invalid position")
            for p in bad_positions[:LIMIT]:
                issue(f"  {p['name']}: '{p['position']}'", "DETAIL")
            issues_found += len(bad_positions)

        # 2b. Level out of range
        subsection("2b. Level validation")
        bad_levels = [p for p in profiles if p["level"] is not None
                      and (p["level"] < 1 or p["level"] > 99)]
        if bad_levels:
            issue(f"{len(bad_levels)} profiles with level outside 1-99")
            issues_found += len(bad_levels)

        # Suspicious levels
        very_low = [p for p in profiles if p["level"] is not None and p["level"] < 20]
        very_high = [p for p in profiles if p["level"] is not None and p["level"] > 95]
        if very_low:
            issue(f"{len(very_low)} profiles with level < 20 (suspicious)", "WARN")
        if very_high:
            issue(f"{len(very_high)} profiles with level > 95 (suspicious)", "WARN")

        # 2c. Archetype validation
        subsection("2c. Archetype validation")
        bad_archetypes = []
        triple_archetypes = []
        for p in profiles:
            if not p["archetype"]:
                continue
            parts = p["archetype"].split("-")
            if len(parts) > 2:
                triple_archetypes.append(p)
                continue
            for part in parts:
                if part not in VALID_MODELS:
                    bad_archetypes.append(p)
                    break

        if bad_archetypes:
            issue(f"{len(bad_archetypes)} profiles with invalid archetype components")
            for p in bad_archetypes[:LIMIT]:
                issue(f"  {p['name']}: '{p['archetype']}'", "DETAIL")
            issues_found += len(bad_archetypes)
        if triple_archetypes:
            issue(f"{len(triple_archetypes)} profiles with triple+ compound archetypes")
            issues_found += len(triple_archetypes)

        # 2d. GK archetype on non-GK
        gk_mismatch = [p for p in profiles
                        if p["archetype"] == "GK" and p["position"]
                        and p["position"] != "GK"]
        if gk_mismatch:
            issue(f"{len(gk_mismatch)} non-GK players with GK-only archetype")
            issues_found += len(gk_mismatch)

        # 2e. Level > peak
        level_peak_mismatch = [p for p in profiles
                                if p["level"] is not None and p["peak"] is not None
                                and p["level"] > p["peak"] + 5]
        if level_peak_mismatch:
            issue(f"{len(level_peak_mismatch)} profiles where level exceeds peak by >5", "WARN")
            for p in level_peak_mismatch[:LIMIT]:
                issue(f"  {p['name']}: level={p['level']}, peak={p['peak']}", "DETAIL")

        # 2f. Legacy 'The' prefix archetypes
        subsection("2f. Legacy archetype labels")
        cur.execute("""
            SELECT DISTINCT archetype FROM player_profiles
            WHERE archetype LIKE 'The %%'
        """)
        legacy_arches = [r["archetype"] for r in cur.fetchall()]
        if legacy_arches:
            issue(f"{len(legacy_arches)} legacy 'The ...' archetypes: {legacy_arches}")
            issues_found += len(legacy_arches)

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 3: PERSONALITY SANITATION (player_personality)
    # ══════════════════════════════════════════════════════════════════════
    if args.audit or args.fix:
        section("3. Personality Sanitation (player_personality)")

        cur.execute("""
            SELECT pp.person_id, pp.ei, pp.sn, pp.tf, pp.jp,
                   pp.competitiveness, pp.coachability,
                   pe.name
            FROM player_personality pp
            JOIN people pe ON pe.id = pp.person_id
            WHERE pe.active = true
        """)
        personalities = cur.fetchall()
        stat("Active personalities", len(personalities))

        # 3a. Out-of-range dimension scores
        subsection("3a. Dimension score ranges")
        for dim in ("ei", "sn", "tf", "jp"):
            out_of_range = [p for p in personalities
                            if p[dim] is not None and (p[dim] < 0 or p[dim] > 100)]
            if out_of_range:
                issue(f"{len(out_of_range)} personalities with {dim} outside 0-100")
                issues_found += len(out_of_range)
                if args.fix:
                    for p in out_of_range:
                        clamped = max(0, min(100, p[dim]))
                        if not DRY_RUN:
                            cur.execute(f"UPDATE player_personality SET {dim} = %s WHERE person_id = %s",
                                        (clamped, p["person_id"]))
                        print(f"    FIX: {p['name']} {dim} {p[dim]} → {clamped}")
                        fixes_applied += 1

        # 3b. Trait ranges
        subsection("3b. Trait score ranges")
        for trait in ("competitiveness", "coachability"):
            out_of_range = [p for p in personalities
                            if p[trait] is not None and (p[trait] < 0 or p[trait] > 100)]
            if out_of_range:
                issue(f"{len(out_of_range)} personalities with {trait} outside 0-100")
                issues_found += len(out_of_range)
                if args.fix:
                    for p in out_of_range:
                        clamped = max(0, min(100, p[trait]))
                        if not DRY_RUN:
                            cur.execute(f"UPDATE player_personality SET {trait} = %s WHERE person_id = %s",
                                        (clamped, p["person_id"]))
                        fixes_applied += 1

        # 3c. All-null personality records (empty rows)
        empty_personality = [p for p in personalities
                             if all(p[d] is None for d in ("ei", "sn", "tf", "jp",
                                                           "competitiveness", "coachability"))]
        if empty_personality:
            issue(f"{len(empty_personality)} empty personality records (all fields NULL)", "WARN")

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 4: MARKET SANITATION (player_market)
    # ══════════════════════════════════════════════════════════════════════
    if args.audit or args.fix:
        section("4. Market Sanitation (player_market)")

        cur.execute("""
            SELECT pm.person_id, pm.market_value_tier, pm.true_mvt,
                   pm.market_value_eur, pm.highest_market_value_eur,
                   pm.scarcity_score, pm.market_premium, pm.hg,
                   pe.name
            FROM player_market pm
            JOIN people pe ON pe.id = pm.person_id
            WHERE pe.active = true
        """)
        markets = cur.fetchall()
        stat("Active market records", len(markets))

        # 4a. Negative values
        subsection("4a. Negative values")
        neg_mv = [m for m in markets if m["market_value_eur"] is not None
                  and m["market_value_eur"] < 0]
        neg_hmv = [m for m in markets if m["highest_market_value_eur"] is not None
                   and m["highest_market_value_eur"] < 0]
        if neg_mv:
            issue(f"{len(neg_mv)} negative market_value_eur")
            issues_found += len(neg_mv)
        if neg_hmv:
            issue(f"{len(neg_hmv)} negative highest_market_value_eur")
            issues_found += len(neg_hmv)

        # 4b. Highest < current
        subsection("4b. Highest vs current market value")
        hmv_lt_mv = [m for m in markets
                     if m["market_value_eur"] is not None
                     and m["highest_market_value_eur"] is not None
                     and m["highest_market_value_eur"] < m["market_value_eur"]]
        if hmv_lt_mv:
            issue(f"{len(hmv_lt_mv)} where highest_market_value < current")
            issues_found += len(hmv_lt_mv)
            if args.fix:
                for m in hmv_lt_mv:
                    if not DRY_RUN:
                        cur.execute("""
                            UPDATE player_market
                            SET highest_market_value_eur = market_value_eur
                            WHERE person_id = %s
                        """, (m["person_id"],))
                    print(f"    FIX: {m['name']} highest_mv {m['highest_market_value_eur']} → {m['market_value_eur']}")
                    fixes_applied += 1

        # 4c. MVT out of range
        subsection("4c. Market value tier")
        bad_mvt = [m for m in markets if m["market_value_tier"] is not None
                   and m["market_value_tier"] not in VALID_MVT]
        if bad_mvt:
            issue(f"{len(bad_mvt)} invalid market_value_tier values")
            issues_found += len(bad_mvt)

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 5: ATTRIBUTE GRADE SANITATION
    # ══════════════════════════════════════════════════════════════════════
    if args.audit or args.fix:
        section("5. Attribute Grade Sanitation")

        cur.execute("""
            SELECT ag.player_id, ag.attribute, ag.scout_grade, ag.stat_score,
                   ag.source, pe.name
            FROM attribute_grades ag
            JOIN people pe ON pe.id = ag.player_id
            WHERE pe.active = true
        """)
        grades = cur.fetchall()
        stat("Active attribute grades", len(grades))

        # 5a. Negative grades
        subsection("5a. Negative grades")
        neg_sg = [g for g in grades if g["scout_grade"] is not None and g["scout_grade"] < 0]
        neg_ss = [g for g in grades if g["stat_score"] is not None and g["stat_score"] < 0]
        if neg_sg:
            issue(f"{len(neg_sg)} negative scout_grade values")
            issues_found += len(neg_sg)
        if neg_ss:
            issue(f"{len(neg_ss)} negative stat_score values")
            issues_found += len(neg_ss)

        # 5b. Over-scale grades
        subsection("5b. Over-scale grades")
        over_sg = [g for g in grades if g["scout_grade"] is not None and g["scout_grade"] > 20]
        over_ss = [g for g in grades if g["stat_score"] is not None and g["stat_score"] > 20]
        if over_sg:
            issue(f"{len(over_sg)} scout_grade values > 20")
            for g in over_sg[:LIMIT]:
                issue(f"  {g['name']}: {g['attribute']} = {g['scout_grade']}", "DETAIL")
            issues_found += len(over_sg)
        if over_ss:
            issue(f"{len(over_ss)} stat_score values > 20")
            issues_found += len(over_ss)

        # 5c. Source distribution
        subsection("5c. Source distribution")
        cur.execute("""
            SELECT source, COUNT(*) as cnt
            FROM attribute_grades
            GROUP BY source
            ORDER BY cnt DESC
        """)
        for row in cur.fetchall():
            stat(f"  {row['source'] or 'NULL'}", f"{row['cnt']:,}")

        # 5d. Orphaned grades (player not active)
        cur.execute("""
            SELECT COUNT(*) as cnt FROM attribute_grades ag
            JOIN people pe ON pe.id = ag.player_id
            WHERE pe.active = false
        """)
        orphaned = cur.fetchone()["cnt"]
        if orphaned:
            issue(f"{orphaned} grades for inactive players", "WARN")

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 6: STATUS SANITATION (player_status)
    # ══════════════════════════════════════════════════════════════════════
    if args.audit or args.fix:
        section("6. Status Sanitation (player_status)")

        cur.execute("""
            SELECT ps.person_id, ps.pursuit_status, ps.fitness_tag,
                   ps.mental_tag, ps.disciplinary_tag, ps.tactical_tag,
                   ps.contract_tag, ps.scouting_notes, ps.squad_role,
                   pe.name
            FROM player_status ps
            JOIN people pe ON pe.id = ps.person_id
            WHERE pe.active = true
        """)
        statuses = cur.fetchall()
        stat("Active status records", len(statuses))

        # 6a. Invalid enum values
        subsection("6a. Enum validation")
        tag_checks = [
            ("pursuit_status", VALID_PURSUIT_STATUS),
            ("fitness_tag", VALID_FITNESS_TAGS),
            ("mental_tag", VALID_MENTAL_TAGS),
            ("disciplinary_tag", VALID_DISCIPLINARY_TAGS),
            ("tactical_tag", VALID_TACTICAL_TAGS),
            ("contract_tag", VALID_CONTRACT_TAGS),
        ]
        for field_name, valid_set in tag_checks:
            invalid = [s for s in statuses
                       if s[field_name] and s[field_name] not in valid_set]
            if invalid:
                vals = set(s[field_name] for s in invalid)
                issue(f"{len(invalid)} invalid {field_name} values: {vals}")
                issues_found += len(invalid)

        # 6b. Garbage bios
        subsection("6b. Scouting notes quality")
        garbage_patterns = [
            (r'^```', "markdown code block"),
            (r'Tactical Attributes', "attribute dump"),
            (r'^---', "markdown separator"),
            (r'^Position.*:.*Age.*:.*Height', "template artifact"),
        ]
        garbage_bios = []
        for s in statuses:
            if not s["scouting_notes"]:
                continue
            for pattern, desc in garbage_patterns:
                if re.search(pattern, s["scouting_notes"]):
                    garbage_bios.append((s, desc))
                    break

        if garbage_bios:
            issue(f"{len(garbage_bios)} garbage scouting notes")
            for s, desc in garbage_bios[:LIMIT]:
                issue(f"  {s['name']}: {desc}", "DETAIL")
            issues_found += len(garbage_bios)

            if args.fix:
                for s, desc in garbage_bios:
                    if not DRY_RUN:
                        cur.execute("""
                            UPDATE player_status SET scouting_notes = NULL
                            WHERE person_id = %s
                        """, (s["person_id"],))
                    fixes_applied += 1
                print(f"    FIX: Nulled {len(garbage_bios)} garbage bios")

        # Short bios
        short_bios = [s for s in statuses
                      if s["scouting_notes"]
                      and len(s["scouting_notes"]) < 15
                      and s["scouting_notes"] not in garbage_bios]
        if short_bios:
            issue(f"{len(short_bios)} very short scouting notes (<15 chars)", "WARN")

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 7: CROSS-TABLE INTEGRITY
    # ══════════════════════════════════════════════════════════════════════
    if args.audit or args.fix:
        section("7. Cross-Table Referential Integrity")

        FK_CHECKS = [
            ("player_profiles", "person_id"),
            ("player_personality", "person_id"),
            ("player_market", "person_id"),
            ("player_status", "person_id"),
            ("attribute_grades", "player_id"),
            ("player_tags", "player_id"),
            ("player_id_links", "person_id"),
            ("player_field_sources", "player_id"),
            ("news_player_tags", "player_id"),
            ("career_metrics", "person_id"),
        ]

        for table, col in FK_CHECKS:
            try:
                cur.execute(f"""
                    SELECT COUNT(*) as cnt FROM {table} t
                    LEFT JOIN people p ON p.id = t.{col}
                    WHERE p.id IS NULL
                """)
                orphaned = cur.fetchone()["cnt"]
                if orphaned:
                    issue(f"{table}.{col}: {orphaned} orphaned records (no matching people)")
                    issues_found += orphaned
                else:
                    stat(f"  {table}.{col}", "OK")
            except Exception as e:
                conn.rollback()
                conn.autocommit = False
                stat(f"  {table}.{col}", f"SKIP ({e})")

        # Check for active people with no profile at all
        subsection("7b. Active people coverage")
        cur.execute("""
            SELECT COUNT(*) as total FROM people WHERE active = true
        """)
        total_active = cur.fetchone()["total"]

        for table, col in [("player_profiles", "person_id"),
                           ("player_status", "person_id"),
                           ("player_market", "person_id"),
                           ("player_personality", "person_id")]:
            cur.execute(f"""
                SELECT COUNT(DISTINCT pe.id) as cnt
                FROM people pe
                LEFT JOIN {table} t ON t.{col} = pe.id
                WHERE pe.active = true AND t.{col} IS NULL
            """)
            missing = cur.fetchone()["cnt"]
            pct = (1 - missing / total_active) * 100 if total_active else 0
            stat(f"  {table} coverage", f"{total_active - missing:,}/{total_active:,} ({pct:.1f}%)")

    # ══════════════════════════════════════════════════════════════════════
    # SECTION 8: ENRICHMENT GAP REPORT
    # ══════════════════════════════════════════════════════════════════════
    if args.enrich:
        section("8. Enrichment Gap Report")

        # What's needed for Tier 1 promotion:
        # people: name, DOB, height, foot, nation, club
        # player_profiles: position, archetype, blueprint, level, overall
        # player_personality: MBTI scores + competitiveness + coachability
        # player_market: market_value_tier, true_mvt, scarcity_score
        # player_status: pursuit_status, scouting_notes
        # attribute_grades: 20+ grades

        subsection("8a. Identity completeness (people)")
        cur.execute("""
            SELECT COUNT(*) as total,
                   COUNT(date_of_birth) as has_dob,
                   COUNT(height_cm) as has_height,
                   COUNT(preferred_foot) as has_foot,
                   COUNT(nation_id) as has_nation,
                   COUNT(club_id) as has_club,
                   COUNT(wikidata_id) as has_wikidata
            FROM people WHERE active = true
        """)
        r = cur.fetchone()
        total = r["total"]
        for field_name in ("dob", "height", "foot", "nation", "club", "wikidata"):
            key = f"has_{field_name}"
            count = r[key]
            pct = count / total * 100 if total else 0
            stat(f"  {field_name}", f"{count:,}/{total:,} ({pct:.1f}%)")

        subsection("8b. Profile completeness (player_profiles)")
        cur.execute("""
            SELECT COUNT(*) as total,
                   COUNT(position) as has_position,
                   COUNT(archetype) as has_archetype,
                   COUNT(blueprint) as has_blueprint,
                   COUNT(level) as has_level,
                   COUNT(overall) as has_overall
            FROM player_profiles pp
            JOIN people pe ON pe.id = pp.person_id
            WHERE pe.active = true
        """)
        r = cur.fetchone()
        ptotal = r["total"]
        stat(f"  profiles exist", f"{ptotal:,}/{total:,}")
        for field_name in ("position", "archetype", "blueprint", "level", "overall"):
            key = f"has_{field_name}"
            count = r[key]
            pct = count / ptotal * 100 if ptotal else 0
            stat(f"  {field_name}", f"{count:,}/{ptotal:,} ({pct:.1f}%)")

        subsection("8c. Personality completeness (player_personality)")
        cur.execute("""
            SELECT COUNT(*) as total,
                   COUNT(CASE WHEN ei IS NOT NULL AND sn IS NOT NULL
                              AND tf IS NOT NULL AND jp IS NOT NULL THEN 1 END) as has_all4,
                   COUNT(competitiveness) as has_comp,
                   COUNT(coachability) as has_coach
            FROM player_personality pp
            JOIN people pe ON pe.id = pp.person_id
            WHERE pe.active = true
        """)
        r = cur.fetchone()
        per_total = r["total"]
        stat(f"  personalities exist", f"{per_total:,}/{total:,}")
        stat(f"  all 4 dimensions", f"{r['has_all4']:,}/{per_total:,}")
        stat(f"  competitiveness", f"{r['has_comp']:,}/{per_total:,}")
        stat(f"  coachability", f"{r['has_coach']:,}/{per_total:,}")

        subsection("8d. Market completeness (player_market)")
        cur.execute("""
            SELECT COUNT(*) as total,
                   COUNT(market_value_tier) as has_mvt,
                   COUNT(true_mvt) as has_true_mvt,
                   COUNT(scarcity_score) as has_scarcity
            FROM player_market pm
            JOIN people pe ON pe.id = pm.person_id
            WHERE pe.active = true
        """)
        r = cur.fetchone()
        m_total = r["total"]
        stat(f"  market records exist", f"{m_total:,}/{total:,}")
        for field_name in ("mvt", "true_mvt", "scarcity"):
            key = f"has_{field_name}"
            count = r[key]
            pct = count / m_total * 100 if m_total else 0
            stat(f"  {field_name}", f"{count:,}/{m_total:,} ({pct:.1f}%)")

        subsection("8e. Status completeness (player_status)")
        cur.execute("""
            SELECT COUNT(*) as total,
                   COUNT(pursuit_status) as has_pursuit,
                   COUNT(CASE WHEN scouting_notes IS NOT NULL
                              AND LENGTH(scouting_notes) > 20 THEN 1 END) as has_bio
            FROM player_status ps
            JOIN people pe ON pe.id = ps.person_id
            WHERE pe.active = true
        """)
        r = cur.fetchone()
        s_total = r["total"]
        stat(f"  status records exist", f"{s_total:,}/{total:,}")
        stat(f"  pursuit_status", f"{r['has_pursuit']:,}/{s_total:,}")
        stat(f"  scouting_notes (>20 chars)", f"{r['has_bio']:,}/{s_total:,}")

        subsection("8f. Attribute grades coverage")
        cur.execute("""
            SELECT pe.id, pe.name, COUNT(ag.attribute) as grade_count
            FROM people pe
            LEFT JOIN attribute_grades ag ON ag.player_id = pe.id
            WHERE pe.active = true
            GROUP BY pe.id, pe.name
        """)
        grade_counts = cur.fetchall()
        has_20plus = sum(1 for g in grade_counts if g["grade_count"] >= 20)
        has_any = sum(1 for g in grade_counts if g["grade_count"] > 0)
        stat(f"  any grades", f"{has_any:,}/{total:,}")
        stat(f"  20+ grades (Tier 1 ready)", f"{has_20plus:,}/{total:,}")

        # Distribution
        buckets = {"0": 0, "1-9": 0, "10-19": 0, "20-29": 0, "30+": 0}
        for g in grade_counts:
            c = g["grade_count"]
            if c == 0:
                buckets["0"] += 1
            elif c < 10:
                buckets["1-9"] += 1
            elif c < 20:
                buckets["10-19"] += 1
            elif c < 30:
                buckets["20-29"] += 1
            else:
                buckets["30+"] += 1
        for bucket, count in buckets.items():
            stat(f"    {bucket} grades", f"{count:,}")

        subsection("8g. Tier 1 promotion readiness")
        # Players who meet ALL criteria for production promotion
        cur.execute("""
            SELECT pe.id, pe.name,
                   pe.date_of_birth IS NOT NULL as has_dob,
                   pe.height_cm IS NOT NULL as has_height,
                   pe.preferred_foot IS NOT NULL as has_foot,
                   pe.nation_id IS NOT NULL as has_nation,
                   pe.club_id IS NOT NULL as has_club,
                   pp.position IS NOT NULL as has_position,
                   pp.archetype IS NOT NULL as has_archetype,
                   pp.blueprint IS NOT NULL as has_blueprint,
                   pp.level IS NOT NULL as has_level,
                   pp.overall IS NOT NULL as has_overall,
                   (per.ei IS NOT NULL AND per.sn IS NOT NULL
                    AND per.tf IS NOT NULL AND per.jp IS NOT NULL) as has_mbti,
                   per.competitiveness IS NOT NULL as has_comp,
                   per.coachability IS NOT NULL as has_coach,
                   pm.market_value_tier IS NOT NULL as has_mvt,
                   pm.true_mvt IS NOT NULL as has_true_mvt,
                   pm.scarcity_score IS NOT NULL as has_scarcity,
                   ps.pursuit_status IS NOT NULL as has_pursuit,
                   (ps.scouting_notes IS NOT NULL
                    AND LENGTH(ps.scouting_notes) > 20) as has_bio
            FROM people pe
            LEFT JOIN player_profiles pp ON pp.person_id = pe.id
            LEFT JOIN player_personality per ON per.person_id = pe.id
            LEFT JOIN player_market pm ON pm.person_id = pe.id
            LEFT JOIN player_status ps ON ps.person_id = pe.id
            WHERE pe.active = true
        """)
        promotion_data = cur.fetchall()

        # Count attribute grades per player
        cur.execute("""
            SELECT player_id, COUNT(*) as cnt
            FROM attribute_grades
            GROUP BY player_id
        """)
        grade_map = {r["player_id"]: r["cnt"] for r in cur.fetchall()}

        tier1_ready = 0
        almost_ready = []  # missing 1-3 fields
        for p in promotion_data:
            has_grades = grade_map.get(p["id"], 0) >= 20
            checks = [
                p["has_dob"], p["has_height"], p["has_foot"],
                p["has_nation"], p["has_club"],
                p["has_position"], p["has_archetype"], p["has_blueprint"],
                p["has_level"], p["has_overall"],
                p["has_mbti"], p["has_comp"], p["has_coach"],
                p["has_mvt"], p["has_true_mvt"], p["has_scarcity"],
                p["has_pursuit"], p["has_bio"],
                has_grades,
            ]
            passed = sum(1 for c in checks if c)
            total_checks = len(checks)
            if passed == total_checks:
                tier1_ready += 1
            elif passed >= total_checks - 3:
                missing = []
                labels = [
                    "dob", "height", "foot", "nation", "club",
                    "position", "archetype", "blueprint", "level", "overall",
                    "mbti", "competitiveness", "coachability",
                    "mvt", "true_mvt", "scarcity",
                    "pursuit", "bio", "20+grades",
                ]
                for i, c in enumerate(checks):
                    if not c:
                        missing.append(labels[i])
                almost_ready.append((p["name"], missing))

        stat("Tier 1 ready", f"{tier1_ready:,}")
        stat("Almost ready (missing 1-3)", f"{len(almost_ready):,}")

        if almost_ready and VERBOSE:
            print("\n    Almost ready players:")
            for name, missing in almost_ready[:30]:
                print(f"      {name}: missing {', '.join(missing)}")

    # ══════════════════════════════════════════════════════════════════════
    # SUMMARY
    # ══════════════════════════════════════════════════════════════════════
    section("Summary")
    if args.audit:
        stat("Total issues found", issues_found)
    if args.fix:
        stat("Fixes applied", fixes_applied)
        if DRY_RUN:
            print("\n    --dry-run: no writes applied.")
            conn.rollback()
        else:
            conn.commit()
            print("\n    All fixes committed.")
    else:
        conn.rollback()

    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
