"""EXPLORATION — 14 events from career_history + clubs."""

from pipeline.xp_detectors.helpers import (
    age_at, infer_team_type, milestone, TODAY, TOP5_LEAGUES,
)

CAT = "exploration"

# Continent mapping by league (simplified)
LEAGUE_CONTINENTS = {
    "Premier League": "Europe", "La Liga": "Europe", "Serie A": "Europe",
    "Bundesliga": "Europe", "Ligue 1": "Europe", "Eredivisie": "Europe",
    "Primeira Liga": "Europe", "Süper Lig": "Europe", "Scottish Premiership": "Europe",
    "MLS": "North America", "Liga MX": "North America",
    "J1 League": "Asia", "K League 1": "Asia", "Saudi Pro League": "Asia",
    "Chinese Super League": "Asia", "Indian Super League": "Asia",
    "A-League": "Oceania",
    "Brasileirão": "South America", "Argentine Primera": "South America",
    "Egyptian Premier League": "Africa", "CAF Champions League": "Africa",
}


def detect(pd):
    ms = []
    career = pd.get("career_entries", [])
    dob = pd.get("dob")
    cm = pd.get("career_metric") or {}
    club_leagues = pd.get("club_leagues", {})
    club_capacities = pd.get("club_capacities", {})
    club_countries = pd.get("club_countries", {})
    nation_id = pd.get("nation_id")

    for e in career:
        if not e.get("team_type"):
            e["team_type"] = infer_team_type(e.get("club_name", ""))

    senior = [e for e in career if e.get("team_type") == "senior_club" and e.get("start_date")]
    senior_sorted = sorted(senior, key=lambda e: e["start_date"])

    leagues_count = cm.get("leagues_count") or 0
    clubs_count = cm.get("clubs_count") or 0

    # Multi-League 3+
    if leagues_count >= 3:
        ms.append(milestone("multi_league", "Multi-League", 1, "common", CAT,
                            "career_metrics", details={"leagues": leagues_count}))

    # Five-League Veteran
    if leagues_count >= 5:
        ms.append(milestone("five_league_veteran", "Five-League Veteran", 5, "epic", CAT,
                            "career_metrics", details={"leagues": leagues_count}))

    # Cross-Continental
    continents = set()
    for e in senior:
        cid = e.get("club_id")
        if cid and cid in club_leagues:
            cont = LEAGUE_CONTINENTS.get(club_leagues[cid])
            if cont:
                continents.add(cont)
    if len(continents) >= 3:
        ms.append(milestone("cross_continental_3", "Globe-Spanning Career", 5, "epic", CAT,
                            "career_history", details={"continents": sorted(continents)}))
    elif len(continents) >= 2:
        ms.append(milestone("cross_continental", "Cross-Continental", 3, "rare", CAT,
                            "career_history", details={"continents": sorted(continents)}))

    # Big Stage Leap — capacity < 10k → > 50k
    if len(senior_sorted) >= 2 and club_capacities:
        caps = [(e, club_capacities.get(e.get("club_id"), 0)) for e in senior_sorted]
        small = any(c < 10000 and c > 0 for _, c in caps)
        big = any(c > 50000 for _, c in caps)
        if small and big:
            ms.append(milestone("big_stage_leap", "Big Stage Leap", 2, "uncommon", CAT,
                                "career_history"))

    # Stadium Upgrade — new club 2x capacity
    if len(senior_sorted) >= 2 and club_capacities:
        for i in range(1, len(senior_sorted)):
            prev_cap = club_capacities.get(senior_sorted[i-1].get("club_id"), 0)
            curr_cap = club_capacities.get(senior_sorted[i].get("club_id"), 0)
            if prev_cap > 0 and curr_cap >= prev_cap * 2 and curr_cap > 10000:
                ms.append(milestone("stadium_upgrade", "Stadium Upgrade", 1, "common", CAT,
                                    "career_history",
                                    details={"from_cap": prev_cap, "to_cap": curr_cap}))
                break

    # Top 5 League Debut
    for e in senior_sorted:
        cid = e.get("club_id")
        if cid and club_leagues.get(cid) in TOP5_LEAGUES:
            ms.append(milestone("top5_league_debut", "Top 5 League Debut", 2, "uncommon", CAT,
                                "career_history", date=e["start_date"],
                                details={"league": club_leagues[cid]}))
            break

    # Premier League Arrival
    for e in senior_sorted:
        cid = e.get("club_id")
        if cid and club_leagues.get(cid) == "Premier League":
            ms.append(milestone("premier_league_debut", "Premier League Arrival", 2, "uncommon", CAT,
                                "career_history", date=e["start_date"],
                                details={"club": e.get("club_name")}))
            break

    # Loan Adventure / Loan Odyssey
    loans = [e for e in senior if e.get("is_loan")]
    if loans:
        ms.append(milestone("loan_adventure", "Loan Adventure", 1, "common", CAT,
                            "career_history", details={"count": len(loans)}))
    if len(loans) >= 3:
        ms.append(milestone("loan_odyssey", "Loan Odyssey", 1, "common", CAT,
                            "career_history", details={"count": len(loans)}))

    # Exile & Return — loan then return to parent club
    for loan in loans:
        parent_before = [e for e in senior_sorted if not e.get("is_loan") and
                         e.get("start_date") and loan.get("start_date") and
                         e["start_date"] < loan["start_date"]]
        if parent_before:
            parent = parent_before[-1]
            returns = [e for e in senior_sorted if not e.get("is_loan") and
                       e.get("start_date") and loan.get("end_date") and
                       e["start_date"] >= loan["end_date"] and
                       e.get("club_name") == parent.get("club_name")]
            if returns:
                ms.append(milestone("exile_and_return", "Exile & Return", 2, "uncommon", CAT,
                                    "career_history",
                                    details={"club": parent.get("club_name")}))
                break

    # Foreign Pioneer
    if nation_id and senior_sorted and club_countries:
        for e in senior_sorted:
            cid = e.get("club_id")
            if cid and club_countries.get(cid) and club_countries[cid] != nation_id:
                ms.append(milestone("foreign_pioneer", "Foreign Pioneer", 1, "common", CAT,
                                    "career_history",
                                    details={"club": e.get("club_name")}))
                break

    # Wanderer 6+ / Globetrotter 8+
    if clubs_count >= 8:
        ms.append(milestone("globetrotter", "Globetrotter", 2, "uncommon", CAT,
                            "career_metrics", details={"clubs": clubs_count}))
    elif clubs_count >= 6:
        ms.append(milestone("wanderer", "The Wanderer", 1, "common", CAT,
                            "career_metrics", details={"clubs": clubs_count}))

    # Late Bloomer — top-5 debut after 25
    if dob and senior_sorted and club_leagues:
        for e in senior_sorted:
            cid = e.get("club_id")
            if cid and club_leagues.get(cid) in TOP5_LEAGUES:
                a = age_at(dob, e["start_date"])
                if a and a >= 25:
                    ms.append(milestone("late_bloomer_top5", "Late Bloomer", 1, "common", CAT,
                                        "career_history", date=e["start_date"],
                                        details={"age": round(a, 1)}))
                break

    return ms
