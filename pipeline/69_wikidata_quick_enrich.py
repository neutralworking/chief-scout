"""
69_wikidata_quick_enrich.py — Quick Wikidata enrichment for players missing basic data.

Uses Wikidata search API + entity data to fill DOB, height, nation, wikidata_id
for top players who are missing these fields.

Usage:
    python 69_wikidata_quick_enrich.py                   # top 100 by level
    python 69_wikidata_quick_enrich.py --limit 200       # more
    python 69_wikidata_quick_enrich.py --min-level 80    # lower threshold
    python 69_wikidata_quick_enrich.py --dry-run
"""

import argparse
import sys
import time

import requests

from lib.db import require_conn

parser = argparse.ArgumentParser()
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--limit", type=int, default=100)
parser.add_argument("--min-level", type=int, default=83)
args = parser.parse_args()


def search_wikidata(name: str):
    """Search Wikidata for a football player by name."""
    url = "https://www.wikidata.org/w/api.php"
    params = {
        "action": "wbsearchentities",
        "search": name,
        "language": "en",
        "type": "item",
        "limit": 5,
        "format": "json",
    }
    try:
        resp = requests.get(url, params=params, timeout=10,
                            headers={"User-Agent": "ChiefScout/1.0"})
        if resp.status_code == 200:
            for item in resp.json().get("search", []):
                desc = (item.get("description") or "").lower()
                if "football" in desc or "soccer" in desc or "footballer" in desc:
                    return item["id"], item.get("description", "")
    except Exception as e:
        print(f"  Search error: {e}")
    return None, None


def get_entity_data(qid: str) -> dict | None:
    """Fetch DOB, height, nationality from a Wikidata entity."""
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    try:
        resp = requests.get(url, timeout=10, headers={"User-Agent": "ChiefScout/1.0"})
        if resp.status_code != 200:
            return None
        entity = resp.json().get("entities", {}).get(qid, {})
        claims = entity.get("claims", {})

        dob = None
        if "P569" in claims:
            v = claims["P569"][0].get("mainsnak", {}).get("datavalue", {}).get("value", {})
            raw = v.get("time", "")
            if raw:
                dob = raw[:11].lstrip("+")  # "+1997-02-07T..." → "1997-02-07"

        height = None
        if "P2048" in claims:
            v = claims["P2048"][0].get("mainsnak", {}).get("datavalue", {}).get("value", {})
            amt = v.get("amount", "")
            unit = v.get("unit", "")
            if amt:
                h = float(amt.lstrip("+"))
                if "metre" in unit and h < 3:
                    height = round(h * 100)
                elif h > 100:
                    height = round(h)

        nation_qid = None
        if "P27" in claims:
            nation_qid = claims["P27"][0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id")

        foot = None
        if "P552" in claims:
            foot_qid = claims["P552"][0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id")
            if foot_qid == "Q3029952":
                foot = "Right"
            elif foot_qid == "Q3033950":
                foot = "Left"
            elif foot_qid == "Q111384475":
                foot = "Both"

        return {"dob": dob, "height_cm": height, "nation_qid": nation_qid, "foot": foot}
    except Exception as e:
        print(f"  Entity error: {e}")
    return None


def main():
    conn = require_conn()
    cur = conn.cursor()

    print(f"69 — Quick Wikidata Enrichment (level >= {args.min_level}, limit {args.limit})")

    # Load nation mapping (by name, since nations table has no wikidata_id)
    cur.execute("SELECT id, name FROM nations")
    nation_by_name = {}
    for nid, nname in cur.fetchall():
        nation_by_name[nname.lower()] = nid

    # Wikidata country QID → country name (common ones)
    COUNTRY_QID_MAP = {
        "Q29": "spain", "Q142": "france", "Q183": "germany", "Q145": "united kingdom",
        "Q38": "italy", "Q55": "netherlands", "Q36": "poland", "Q45": "portugal",
        "Q408": "australia", "Q17": "japan", "Q884": "south korea",
        "Q155": "brazil", "Q414": "argentina", "Q717": "venezuela",
        "Q733": "paraguay", "Q298": "chile", "Q736": "ecuador",
        "Q739": "colombia", "Q750": "bolivia", "Q419": "peru", "Q77": "uruguay",
        "Q30": "united states", "Q96": "mexico", "Q16": "canada",
        "Q1028": "morocco", "Q1008": "ivory coast", "Q1030": "senegal",
        "Q1032": "nigeria", "Q1005": "gambia", "Q1029": "cameroon",
        "Q1009": "ghana", "Q1033": "guinea", "Q929": "central african republic",
        "Q1006": "mali", "Q1007": "burkina faso",
        "Q20": "norway", "Q34": "sweden", "Q35": "denmark", "Q33": "finland",
        "Q31": "belgium", "Q39": "switzerland", "Q40": "austria",
        "Q213": "czech republic", "Q28": "hungary", "Q36": "poland",
        "Q37": "republic of ireland", "Q218": "romania", "Q219": "bulgaria",
        "Q41": "greece", "Q212": "ukraine", "Q159": "russia",
        "Q43": "turkey", "Q222": "albania", "Q224": "croatia",
        "Q403": "serbia", "Q225": "bosnia and herzegovina",
        "Q221": "north macedonia", "Q236": "montenegro",
        "Q229": "cyprus", "Q227": "azerbaijan",
        "Q232": "kazakhstan", "Q230": "georgia",
        "Q801": "israel", "Q889": "afghanistan",
        "Q79": "egypt", "Q262": "algeria", "Q948": "tunisia",
        "Q668": "india", "Q252": "indonesia",
        "Q843": "pakistan", "Q869": "thailand",
        "Q148": "china", "Q865": "taiwan",
        "Q664": "new zealand",
        "Q215": "slovenia", "Q214": "slovakia",
        "Q233": "malta", "Q27": "republic of ireland",
        "Q21": "england", "Q22": "scotland", "Q25": "wales",
    }
    def resolve_nation(qid):
        if not qid:
            return None
        country = COUNTRY_QID_MAP.get(qid)
        if country:
            return nation_by_name.get(country)
        # Try fetching the label
        try:
            resp = requests.get(f"https://www.wikidata.org/w/api.php",
                               params={"action": "wbgetentities", "ids": qid,
                                       "props": "labels", "languages": "en", "format": "json"},
                               timeout=5, headers={"User-Agent": "ChiefScout/1.0"})
            if resp.status_code == 200:
                label = resp.json().get("entities", {}).get(qid, {}).get("labels", {}).get("en", {}).get("value", "")
                return nation_by_name.get(label.lower())
        except:
            pass
        return None

    # Get players missing DOB, height, or nation
    cur.execute("""
        SELECT p.id, p.name, pp.level, p.wikidata_id,
               p.date_of_birth IS NULL as needs_dob,
               p.height_cm IS NULL as needs_height,
               p.nation_id IS NULL as needs_nation
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        WHERE pp.level >= %s
          AND (p.date_of_birth IS NULL OR p.height_cm IS NULL OR p.nation_id IS NULL)
        ORDER BY pp.level DESC
        LIMIT %s
    """, (args.min_level, args.limit))
    players = cur.fetchall()
    print(f"  {len(players)} players to enrich")

    updated = 0
    skipped = 0
    not_found = 0

    for pid, name, level, existing_qid, needs_dob, needs_height, needs_nation in players:
        # Search Wikidata if no QID
        qid = existing_qid
        if not qid:
            qid, desc = search_wikidata(name)
            if not qid:
                not_found += 1
                if level >= 85:
                    print(f"  {name:30s} L{level} → NOT FOUND")
                time.sleep(0.3)
                continue
            time.sleep(0.5)

        # Get entity data
        data = get_entity_data(qid)
        if not data:
            skipped += 1
            time.sleep(0.3)
            continue

        # Sanity check DOB
        dob = data.get("dob")
        if dob:
            try:
                year = int(dob[:4])
                month = int(dob[5:7])
                day = int(dob[8:10])
                if year < 1975 or year > 2010 or month < 1 or month > 12 or day < 1 or day > 31:
                    print(f"  {name:30s} L{level} → SKIP bad dob={dob}")
                    skipped += 1
                    time.sleep(0.3)
                    continue
            except (ValueError, IndexError):
                dob = None

        height = data.get("height_cm")
        if height and (height < 150 or height > 210):
            height = None

        nation_id = resolve_nation(data.get("nation_qid"))
        foot = data.get("foot")

        # Build update
        sets = []
        params = []

        if not existing_qid:
            sets.append("wikidata_id = %s")
            params.append(qid)

        if needs_dob and dob:
            sets.append("date_of_birth = %s")
            params.append(dob)
        if needs_height and height:
            sets.append("height_cm = %s")
            params.append(height)
        if needs_nation and nation_id:
            sets.append("nation_id = %s")
            params.append(nation_id)
        if foot:
            sets.append("preferred_foot = %s")
            params.append(foot)

        if not sets:
            skipped += 1
            time.sleep(0.3)
            continue

        params.append(pid)
        fields = []
        if needs_dob and dob:
            fields.append(f"dob={dob}")
        if needs_height and height:
            fields.append(f"h={height}")
        if needs_nation and nation_id:
            fields.append(f"nat")
        if foot:
            fields.append(f"foot={foot}")

        if args.dry_run:
            print(f"  {name:30s} L{level} → {qid} {' '.join(fields)}")
        else:
            cur.execute(f"UPDATE people SET {', '.join(sets)} WHERE id = %s", params)
            updated += 1
            if level >= 85 or updated <= 20:
                print(f"  {name:30s} L{level} → {qid} {' '.join(fields)}")

        time.sleep(0.8)

    if not args.dry_run:
        conn.commit()

    print(f"\n  Updated: {updated}")
    print(f"  Not found: {not_found}")
    print(f"  Skipped: {skipped}")

    conn.close()
    print("  Done.")


if __name__ == "__main__":
    main()
