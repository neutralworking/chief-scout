"""
67_af_match_and_import.py — Match + import API-Football players.

Phase 1: Sync person_id from api_football_players → api_football_player_stats
Phase 2: Improved matching (prefix stripping, club-aware, fuzzy)
Phase 3: Import genuinely new players into people + player_profiles

Usage:
    python 67_af_match_and_import.py                  # all phases
    python 67_af_match_and_import.py --match-only     # skip import
    python 67_af_match_and_import.py --import-only    # skip matching
    python 67_af_match_and_import.py --dry-run        # preview
    python 67_af_match_and_import.py --min-apps 10    # import threshold (default: 5)
"""

import argparse
import html
import re
import sys
import unicodedata

from lib.db import require_conn

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--match-only", action="store_true")
parser.add_argument("--import-only", action="store_true")
parser.add_argument("--min-apps", type=int, default=5,
                    help="Minimum appearances to import a new player (default: 5)")
parser.add_argument("--verbose", action="store_true")
args = parser.parse_args()

DRY_RUN = args.dry_run


def normalize(name: str) -> str:
    name = html.unescape(name)
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.lower().strip()
    name = re.sub(r"\s+", " ", name)
    name = re.sub(r"\s+(jr\.?|sr\.?|ii|iii|iv)$", "", name)
    return name


def strip_prefixes(name: str) -> str:
    """Strip common name prefixes: al-, el-, de, van, von, etc."""
    return re.sub(r"^(al-|el-|el |al )", "", name)


def expand_initial(name: str) -> str | None:
    """Convert 'A. Saelemaekers' → 'a. saelemaekers' (already normalized)."""
    if "." in name:
        return name
    return None


# Manual alias map for known mismatches
PLAYER_ALIASES: dict[str, str] = {
    "a. saelemaekers": "alexis saelemaekers",
    "mousa tamari": "mousa al-tamari",
    "ruiz de galarreta": "ruiz de galarreta",
    "joao pedro": "joao pedro",  # common name, needs club disambiguation
}


def main():
    conn = require_conn()
    conn.autocommit = False
    cur = conn.cursor()

    print("67 — API-Football Match & Import")

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 1: Sync person_id from players table → stats table
    # ═══════════════════════════════════════════════════════════════════════════
    if not args.import_only:
        print("\n── Phase 1: Sync person_id ──────────────────────────────────")
        if DRY_RUN:
            cur.execute("""
                SELECT COUNT(*) FROM api_football_player_stats s
                JOIN api_football_players p ON p.api_football_id = s.api_football_id
                WHERE p.person_id IS NOT NULL AND s.person_id IS NULL
            """)
            print(f"  [dry-run] Would sync {cur.fetchone()[0]} stats rows")
        else:
            cur.execute("""
                UPDATE api_football_player_stats s
                SET person_id = p.person_id
                FROM api_football_players p
                WHERE p.api_football_id = s.api_football_id
                  AND p.person_id IS NOT NULL
                  AND s.person_id IS NULL
            """)
            synced = cur.rowcount
            conn.commit()
            print(f"  Synced {synced} stats rows from players table")

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 2: Improved matching
    # ═══════════════════════════════════════════════════════════════════════════
    if not args.import_only:
        print("\n── Phase 2: Match unmatched players ────────────────────────")

        # Load unmatched AF players
        cur.execute("""
            SELECT afp.api_football_id, afp.name, afs.team_name, afs.league_name
            FROM api_football_players afp
            JOIN api_football_player_stats afs ON afs.api_football_id = afp.api_football_id
            WHERE afp.person_id IS NULL
        """)
        unmatched = cur.fetchall()
        print(f"  {len(unmatched)} unmatched AF players")

        if not unmatched:
            print("  Nothing to match.")
        else:
            # Load existing links to skip
            cur.execute("SELECT external_id FROM player_id_links WHERE source = 'api_football'")
            already_linked = {r[0] for r in cur.fetchall()}

            # Load people indices
            cur.execute("SELECT id, name FROM people")
            people_rows = cur.fetchall()

            people_by_norm: dict[str, list[tuple[int, str]]] = {}
            people_by_initial: dict[str, list[tuple[int, str]]] = {}
            people_by_last: dict[str, list[tuple[int, str]]] = {}
            people_by_stripped: dict[str, list[tuple[int, str]]] = {}

            for pid, pname in people_rows:
                norm = normalize(pname)
                people_by_norm.setdefault(norm, []).append((pid, pname))

                # Also index without common prefixes (al-, el-)
                stripped = strip_prefixes(norm)
                if stripped != norm:
                    people_by_stripped.setdefault(stripped, []).append((pid, pname))

                parts = norm.split()
                if len(parts) >= 2:
                    last = parts[-1]
                    people_by_last.setdefault(last, []).append((pid, pname))
                    # "f. lastname"
                    initial_key = f"{parts[0][0]}. {last}"
                    people_by_initial.setdefault(initial_key, []).append((pid, pname))
                    # Multi-word surname
                    if len(parts) >= 3:
                        surname = " ".join(parts[1:])
                        multi_key = f"{parts[0][0]}. {surname}"
                        people_by_initial.setdefault(multi_key, []).append((pid, pname))
                    # Also first + last without middle
                    if len(parts) >= 3:
                        short_key = f"{parts[0]} {parts[-1]}"
                        people_by_norm.setdefault(short_key, []).append((pid, pname))

            # Load club data for disambiguation
            cur.execute("""
                SELECT p.id, c.clubname FROM people p
                JOIN clubs c ON c.id = p.club_id
                WHERE p.club_id IS NOT NULL
            """)
            people_club = {r[0]: normalize(r[1]) for r in cur.fetchall()}

            # Club name normalization for AF teams
            CLUB_ALIASES = {
                "manchester united": ["man utd", "man united"],
                "manchester city": ["man city"],
                "tottenham hotspur": ["tottenham", "spurs"],
                "wolverhampton wanderers": ["wolves"],
                "nottingham forest": ["nott forest"],
                "newcastle united": ["newcastle"],
                "west ham united": ["west ham"],
                "paris saint germain": ["psg", "paris saint-germain", "paris sg"],
                "atletico madrid": ["atletico de madrid", "atletico"],
                "borussia dortmund": ["dortmund", "bvb"],
                "borussia monchengladbach": ["gladbach", "monchengladbach"],
                "bayern munchen": ["bayern munich", "fc bayern"],
                "inter milan": ["internazionale", "inter"],
            }
            # Build reverse: alias → canonical
            club_canonical = {}
            for canonical, aliases in CLUB_ALIASES.items():
                club_canonical[canonical] = canonical
                for a in aliases:
                    club_canonical[a] = canonical

            def clubs_match(af_team: str, db_club: str) -> bool:
                af_n = normalize(af_team)
                db_n = normalize(db_club) if db_club else ""
                if not af_n or not db_n:
                    return False
                # Direct containment
                if af_n in db_n or db_n in af_n:
                    return True
                # Canonical form
                af_c = club_canonical.get(af_n, af_n)
                db_c = club_canonical.get(db_n, db_n)
                return af_c == db_c

            matched = 0
            links = []
            stats_updates = []

            for af_id, af_name, team_name, league_name in unmatched:
                if str(af_id) in already_linked:
                    continue

                norm = normalize(af_name)
                person_id = None
                method = None

                # Strategy 1: Exact normalized name (unique)
                candidates = people_by_norm.get(norm, [])
                if len(candidates) == 1:
                    person_id = candidates[0][0]
                    method = "exact"
                elif len(candidates) > 1 and team_name:
                    # Disambiguate by club
                    club_hits = [pid for pid, _ in candidates
                                 if clubs_match(team_name, people_club.get(pid, ""))]
                    if len(club_hits) == 1:
                        person_id = club_hits[0]
                        method = "exact_club"

                # Strategy 2: Initial + last name ("A. Saelemaekers" → initial key)
                if not person_id and "." in norm:
                    candidates = people_by_initial.get(norm, [])
                    if len(candidates) == 1:
                        person_id = candidates[0][0]
                        method = "initial"
                    elif len(candidates) > 1 and team_name:
                        club_hits = [pid for pid, _ in candidates
                                     if clubs_match(team_name, people_club.get(pid, ""))]
                        if len(club_hits) == 1:
                            person_id = club_hits[0]
                            method = "initial_club"

                # Strategy 3: Strip al-/el- prefix and retry
                if not person_id:
                    stripped = strip_prefixes(norm)
                    if stripped != norm:
                        candidates = people_by_norm.get(stripped, [])
                        if not candidates:
                            candidates = people_by_stripped.get(norm, [])
                        if len(candidates) == 1:
                            person_id = candidates[0][0]
                            method = "prefix_strip"
                        elif len(candidates) > 1 and team_name:
                            club_hits = [pid for pid, _ in candidates
                                         if clubs_match(team_name, people_club.get(pid, ""))]
                            if len(club_hits) == 1:
                                person_id = club_hits[0]
                                method = "prefix_strip_club"

                    # Also try adding al- prefix to match DB
                    for prefix in ["al-", "el-"]:
                        if not person_id and not norm.startswith(prefix):
                            prefixed = prefix + norm
                            candidates = people_by_norm.get(prefixed, [])
                            if len(candidates) == 1:
                                person_id = candidates[0][0]
                                method = "prefix_add"
                                break

                # Strategy 4: Mononym + club
                if not person_id and " " not in norm and team_name:
                    candidates = people_by_norm.get(norm, [])
                    if not candidates:
                        candidates = people_by_last.get(norm, [])
                    if len(candidates) == 1:
                        person_id = candidates[0][0]
                        method = "mononym"
                    elif len(candidates) > 1:
                        club_hits = [pid for pid, _ in candidates
                                     if clubs_match(team_name, people_club.get(pid, ""))]
                        if len(club_hits) == 1:
                            person_id = club_hits[0]
                            method = "mononym_club"

                # Strategy 5: Last name only + club (for common first names)
                if not person_id and team_name:
                    parts = norm.split()
                    if len(parts) >= 2:
                        last = parts[-1]
                        candidates = people_by_last.get(last, [])
                        if candidates and len(candidates) <= 10:
                            club_hits = [pid for pid, _ in candidates
                                         if clubs_match(team_name, people_club.get(pid, ""))]
                            if len(club_hits) == 1:
                                person_id = club_hits[0]
                                method = "lastname_club"

                if person_id:
                    matched += 1
                    links.append((person_id, "api_football", str(af_id), af_name,
                                  method, 0.9 if method == "exact" else 0.8))
                    stats_updates.append((person_id, af_id))
                    if args.verbose:
                        print(f"    {af_name:30s} → {method:15s} pid={person_id}")

            print(f"  New matches: {matched}")
            still_unmatched = len(unmatched) - matched - len(already_linked)
            print(f"  Still unmatched: {still_unmatched}")

            if not DRY_RUN and links:
                from psycopg2.extras import execute_values, execute_batch
                execute_values(cur, """
                    INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
                    VALUES %s
                    ON CONFLICT (source, external_id) DO NOTHING
                """, links)
                execute_batch(cur, """
                    UPDATE api_football_player_stats SET person_id = %s WHERE api_football_id = %s
                """, stats_updates)
                execute_batch(cur, """
                    UPDATE api_football_players SET person_id = %s WHERE api_football_id = %s
                """, stats_updates)
                conn.commit()
                print(f"  Written {len(links)} links + updated stats")

    # ═══════════════════════════════════════════════════════════════════════════
    # Phase 3: Import new players
    # ═══════════════════════════════════════════════════════════════════════════
    if not args.match_only:
        print(f"\n── Phase 3: Import new players (min {args.min_apps} apps) ──────")

        # Reload unmatched after Phase 2
        cur.execute("""
            SELECT afp.api_football_id, afp.name,
                   afs.team_name, afs.league_name, afs.appearances,
                   afs.goals, afs.assists
            FROM api_football_players afp
            JOIN api_football_player_stats afs ON afs.api_football_id = afp.api_football_id
            WHERE afp.person_id IS NULL
              AND COALESCE(afs.appearances, 0) >= %s
            ORDER BY afs.appearances DESC
        """, (args.min_apps,))
        to_import = cur.fetchall()
        print(f"  {len(to_import)} AF players with >= {args.min_apps} appearances, not yet in DB")

        if not to_import:
            print("  Nothing to import.")
        else:
            # Load ALL existing people names for dedup check
            cur.execute("SELECT id, name FROM people")
            existing_names = {}
            for pid, pname in cur.fetchall():
                existing_names.setdefault(normalize(pname), []).append(pid)

            # Match AF team_name → club_id
            cur.execute("SELECT id, clubname FROM clubs")
            clubs_by_norm = {}
            for cid, cname in cur.fetchall():
                clubs_by_norm[normalize(cname)] = cid

            # Also use manual map from script 29
            from importlib import import_module

            imported = 0
            skipped_dupe = 0
            skipped_no_name = 0
            new_people = []
            new_profiles = []
            new_links = []
            new_stats_updates = []

            for af_id, af_name, team_name, league_name, apps, goals, assists in to_import:
                if not af_name or af_name.strip() == "":
                    skipped_no_name += 1
                    continue

                norm = normalize(af_name)

                # Dedup: skip if normalized name already exists
                if norm in existing_names:
                    skipped_dupe += 1
                    if args.verbose:
                        print(f"    SKIP (dupe): {af_name} ≈ existing pid={existing_names[norm][0]}")
                    continue

                # Find club_id
                club_id = None
                if team_name:
                    club_norm = normalize(team_name)
                    club_id = clubs_by_norm.get(club_norm)
                    if not club_id:
                        # Try partial match
                        for cn, cid in clubs_by_norm.items():
                            if club_norm in cn or cn in club_norm:
                                club_id = cid
                                break

                # Build insert data
                # Use the AF name as-is (preserving accents from the API)
                clean_name = html.unescape(af_name.strip())
                # Remove initial format — expand if possible
                if re.match(r'^[A-Z]\.\s', clean_name):
                    # Can't expand initials without more data, keep as-is
                    pass

                new_people.append({
                    "name": clean_name,
                    "club_id": club_id,
                    "active": True,
                })
                # Mark as seen to prevent dupes within same batch
                existing_names.setdefault(norm, []).append(-1)
                new_links.append((af_id, clean_name))
                imported += 1

            print(f"  To import: {imported}")
            print(f"  Skipped (name exists): {skipped_dupe}")
            if skipped_no_name:
                print(f"  Skipped (no name): {skipped_no_name}")

            if DRY_RUN:
                print("  [dry-run] No writes.")
                if imported:
                    print(f"  Sample imports:")
                    for _, af_name, team, league, apps, goals, assists in to_import[:15]:
                        norm = normalize(af_name)
                        if len(existing_names.get(norm, [])) <= 1 or existing_names.get(norm, [None])[-1] == -1:
                            print(f"    {af_name:30s} {(team or '-'):22s} {apps or 0:>2d}apps {goals or 0:>2d}g")
            elif imported > 0:
                print(f"  Inserting {imported} new people...")
                from psycopg2.extras import execute_values

                # Insert people and get IDs back
                cur.execute("SELECT MAX(id) FROM people")
                next_id = (cur.fetchone()[0] or 0) + 1

                insert_rows = []
                name_to_new_id = {}
                for p in new_people:
                    insert_rows.append((next_id, p["name"], p["club_id"], p["active"]))
                    name_to_new_id[p["name"]] = next_id
                    next_id += 1

                execute_values(cur, """
                    INSERT INTO people (id, name, club_id, active)
                    VALUES %s
                """, insert_rows)
                conn.commit()

                # Create player_profiles stubs
                profile_rows = [(pid,) for pid in name_to_new_id.values()]
                execute_values(cur, """
                    INSERT INTO player_profiles (person_id)
                    VALUES %s
                    ON CONFLICT (person_id) DO NOTHING
                """, profile_rows)

                # Link AF IDs
                link_rows = []
                stats_updates = []
                for af_id, clean_name in new_links:
                    new_pid = name_to_new_id.get(clean_name)
                    if new_pid:
                        link_rows.append((new_pid, "api_football", str(af_id), clean_name, "import", 1.0))
                        stats_updates.append((new_pid, af_id))

                if link_rows:
                    execute_values(cur, """
                        INSERT INTO player_id_links (person_id, source, external_id, external_name, match_method, confidence)
                        VALUES %s
                        ON CONFLICT (source, external_id) DO NOTHING
                    """, link_rows)

                if stats_updates:
                    from psycopg2.extras import execute_batch
                    execute_batch(cur, """
                        UPDATE api_football_player_stats SET person_id = %s WHERE api_football_id = %s
                    """, stats_updates)
                    execute_batch(cur, """
                        UPDATE api_football_players SET person_id = %s WHERE api_football_id = %s
                    """, stats_updates)

                conn.commit()
                print(f"  Inserted {len(name_to_new_id)} people, {len(link_rows)} links")

    # ═══════════════════════════════════════════════════════════════════════════
    # Summary
    # ═══════════════════════════════════════════════════════════════════════════
    print("\n── Summary ─────────────────────────────────────────────────")
    cur.execute("SELECT COUNT(*) FROM api_football_players WHERE person_id IS NOT NULL")
    print(f"  AF players matched: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM api_football_players WHERE person_id IS NULL")
    print(f"  AF players unmatched: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM api_football_player_stats WHERE person_id IS NOT NULL")
    print(f"  AF stats with person_id: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM people")
    print(f"  Total people: {cur.fetchone()[0]}")

    conn.close()
    print("\n  Done.")


if __name__ == "__main__":
    main()
