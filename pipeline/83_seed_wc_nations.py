"""
83_seed_wc_nations.py — Seed World Cup 2026 participating nations into wc_nations table.

Maps the 48 qualified teams to existing nations.id, with FIFA ranking, confederation,
and URL-safe slugs.

Usage:
    python pipeline/83_seed_wc_nations.py [--dry-run]
"""
from __future__ import annotations

import sys
import psycopg2
from config import POSTGRES_DSN

DRY_RUN = "--dry-run" in sys.argv

# ── World Cup 2026 — 48 qualified nations ────────────────────────────────────
# Format: (nation_name, confederation, fifa_ranking_approx, slug, kit_emoji)
# Rankings are approximate as of March 2026.
WC_NATIONS = [
    # UEFA (16 teams)
    ("France", "UEFA", 2, "france", "🇫🇷"),
    ("Spain", "UEFA", 3, "spain", "🇪🇸"),
    ("England", "UEFA", 4, "england", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"),
    ("Belgium", "UEFA", 6, "belgium", "🇧🇪"),
    ("Netherlands", "UEFA", 7, "netherlands", "🇳🇱"),
    ("Portugal", "UEFA", 8, "portugal", "🇵🇹"),
    ("Italy", "UEFA", 9, "italy", "🇮🇹"),
    ("Germany", "UEFA", 11, "germany", "🇩🇪"),
    ("Croatia", "UEFA", 12, "croatia", "🇭🇷"),
    ("Denmark", "UEFA", 15, "denmark", "🇩🇰"),
    ("Austria", "UEFA", 17, "austria", "🇦🇹"),
    ("Switzerland", "UEFA", 19, "switzerland", "🇨🇭"),
    ("Ukraine", "UEFA", 22, "ukraine", "🇺🇦"),
    ("Turkey", "UEFA", 24, "turkey", "🇹🇷"),
    ("Serbia", "UEFA", 26, "serbia", "🇷🇸"),
    ("Poland", "UEFA", 28, "poland", "🇵🇱"),
    # CONMEBOL (6 teams)
    ("Argentina", "CONMEBOL", 1, "argentina", "🇦🇷"),
    ("Brazil", "CONMEBOL", 5, "brazil", "🇧🇷"),
    ("Uruguay", "CONMEBOL", 10, "uruguay", "🇺🇾"),
    ("Colombia", "CONMEBOL", 13, "colombia", "🇨🇴"),
    ("Ecuador", "CONMEBOL", 30, "ecuador", "🇪🇨"),
    ("Paraguay", "CONMEBOL", 42, "paraguay", "🇵🇾"),
    # CONCACAF (6 teams) — hosts + qualifiers
    ("United States", "CONCACAF", 14, "usa", "🇺🇸"),
    ("Mexico", "CONCACAF", 16, "mexico", "🇲🇽"),
    ("Canada", "CONCACAF", 35, "canada", "🇨🇦"),
    ("Costa Rica", "CONCACAF", 47, "costa-rica", "🇨🇷"),
    ("Jamaica", "CONCACAF", 55, "jamaica", "🇯🇲"),
    ("Panama", "CONCACAF", 48, "panama", "🇵🇦"),
    # CAF (9 teams)
    ("Morocco", "CAF", 18, "morocco", "🇲🇦"),
    ("Senegal", "CAF", 20, "senegal", "🇸🇳"),
    ("Nigeria", "CAF", 32, "nigeria", "🇳🇬"),
    ("Egypt", "CAF", 33, "egypt", "🇪🇬"),
    ("Cameroon", "CAF", 40, "cameroon", "🇨🇲"),
    ("Ivory Coast", "CAF", 38, "ivory-coast", "🇨🇮"),
    ("Algeria", "CAF", 36, "algeria", "🇩🇿"),
    ("South Africa", "CAF", 53, "south-africa", "🇿🇦"),
    ("DR Congo", "CAF", 50, "dr-congo", "🇨🇩"),
    # AFC (8 teams)
    ("Japan", "AFC", 21, "japan", "🇯🇵"),
    ("South Korea", "AFC", 23, "south-korea", "🇰🇷"),
    ("Iran", "AFC", 25, "iran", "🇮🇷"),
    ("Australia", "AFC", 27, "australia", "🇦🇺"),
    ("Saudi Arabia", "AFC", 51, "saudi-arabia", "🇸🇦"),
    ("Qatar", "AFC", 44, "qatar", "🇶🇦"),
    ("Iraq", "AFC", 46, "iraq", "🇮🇶"),
    ("Indonesia", "AFC", 90, "indonesia", "🇮🇩"),
    # OFC (1 team)
    ("New Zealand", "OFC", 75, "new-zealand", "🇳🇿"),
    # Intercontinental playoff winners (2 teams) — placeholder estimates
    ("Peru", "CONMEBOL", 29, "peru", "🇵🇪"),
    ("Honduras", "CONCACAF", 60, "honduras", "🇭🇳"),
]


def main():
    if not POSTGRES_DSN:
        print("ERROR: POSTGRES_DSN not set")
        sys.exit(1)

    conn = psycopg2.connect(POSTGRES_DSN)
    cur = conn.cursor()

    # Fetch existing nations mapping
    cur.execute("SELECT id, name FROM nations")
    nation_map = {name: nid for nid, name in cur.fetchall()}

    inserted = 0
    skipped = 0
    missing_nations = []

    for nation_name, confed, ranking, slug, emoji in WC_NATIONS:
        nation_id = nation_map.get(nation_name)
        if not nation_id:
            missing_nations.append(nation_name)
            # Insert the nation if missing
            if not DRY_RUN:
                cur.execute(
                    "INSERT INTO nations (name) VALUES (%s) ON CONFLICT (name) DO NOTHING RETURNING id",
                    (nation_name,),
                )
                row = cur.fetchone()
                if row:
                    nation_id = row[0]
                    nation_map[nation_name] = nation_id
                    print(f"  + Created nation: {nation_name} (id={nation_id})")
                else:
                    cur.execute("SELECT id FROM nations WHERE name = %s", (nation_name,))
                    nation_id = cur.fetchone()[0]
                    nation_map[nation_name] = nation_id
            else:
                print(f"  [DRY-RUN] Would create nation: {nation_name}")
                continue

        if DRY_RUN:
            print(f"  [DRY-RUN] Would seed: {emoji} {nation_name} ({confed}, #{ranking})")
            inserted += 1
            continue

        cur.execute(
            """
            INSERT INTO wc_nations (nation_id, confederation, fifa_ranking, slug, kit_emoji)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (nation_id) DO UPDATE SET
                confederation = EXCLUDED.confederation,
                fifa_ranking = EXCLUDED.fifa_ranking,
                slug = EXCLUDED.slug,
                kit_emoji = EXCLUDED.kit_emoji
            """,
            (nation_id, confed, ranking, slug, emoji),
        )
        inserted += 1

    if not DRY_RUN:
        conn.commit()

    # Report
    print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}Seeded {inserted} WC nations")
    if missing_nations:
        print(f"  Nations created: {', '.join(missing_nations)}")

    # Show player coverage per nation
    print("\n── Player Coverage ──")
    for nation_name, confed, ranking, slug, emoji in WC_NATIONS:
        nation_id = nation_map.get(nation_name)
        if not nation_id:
            print(f"  {emoji} {nation_name:25s} — MISSING NATION ID")
            continue
        cur.execute(
            """
            SELECT COUNT(DISTINCT p.id)
            FROM people p
            LEFT JOIN player_profiles pp ON pp.person_id = p.id
            WHERE (p.nation_id = %s OR EXISTS (
                SELECT 1 FROM player_nationalities pn WHERE pn.person_id = p.id AND pn.nation_id = %s
            ))
            AND p.active = true
            """,
            (nation_id, nation_id),
        )
        count = cur.fetchone()[0]
        bar = "█" * min(count // 5, 20)
        status = "✓" if count >= 26 else "⚠" if count >= 11 else "✗"
        print(f"  {status} {emoji} {nation_name:25s} {count:4d} players {bar}")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
