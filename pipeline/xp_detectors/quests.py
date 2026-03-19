"""QUEST COMPLETIONS — 13 events from people.awards."""

import json
from pipeline.xp_detectors.helpers import milestone

CAT = "quests"

# Trophy classifications
ELITE_TROPHIES = {"UEFA Champions League", "FIFA World Cup"}

MAJOR_LEAGUE = {"Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"}

CONTINENTAL = {
    "UEFA European Championship", "Copa América", "Africa Cup of Nations",
    "Copa Libertadores",
}

EUROPA = {"UEFA Europa League"}
CONFERENCE = {"UEFA Europa Conference League"}

DOMESTIC_CUPS = {
    "FA Cup", "EFL Cup", "League Cup", "Copa del Rey", "Coppa Italia",
    "DFB-Pokal", "Coupe de France",
}

SUPER_CUPS = {
    "FA Community Shield", "Trophée des Champions", "DFL-Supercup",
    "Supercoppa Italiana", "Supercopa de España", "UEFA Super Cup",
    "FIFA Club World Cup", "Intercontinental Cup",
}

ALL_TROPHIES = (ELITE_TROPHIES | MAJOR_LEAGUE | CONTINENTAL | EUROPA |
                CONFERENCE | DOMESTIC_CUPS | SUPER_CUPS)


def detect(pd):
    ms = []
    awards = pd.get("awards")
    career = pd.get("career_entries", [])

    if not awards:
        return ms

    if isinstance(awards, str):
        try:
            awards = json.loads(awards)
        except (json.JSONDecodeError, TypeError):
            return ms

    if not isinstance(awards, list):
        return ms

    labels = []
    for a in awards:
        if isinstance(a, str):
            labels.append(a)
        elif isinstance(a, dict):
            labels.append(a.get("label") or a.get("name") or "")

    # Categorise
    elite = [l for l in labels if l in ELITE_TROPHIES]
    leagues = [l for l in labels if l in MAJOR_LEAGUE]
    continental = [l for l in labels if l in CONTINENTAL]
    europa = [l for l in labels if l in EUROPA]
    conference = [l for l in labels if l in CONFERENCE]
    cups = [l for l in labels if l in DOMESTIC_CUPS]
    supers = [l for l in labels if l in SUPER_CUPS]

    # World Cup Winner
    if "FIFA World Cup" in elite:
        ms.append(milestone("world_cup_winner", "World Cup Winner", 8, "legendary", CAT, "awards",
                            details={"trophy": "FIFA World Cup"}))

    # Champions League Winner
    if "UEFA Champions League" in elite:
        ms.append(milestone("champions_league_winner", "Champions League Winner", 5, "epic", CAT, "awards",
                            details={"trophy": "UEFA Champions League"}))

    # League Champion
    if leagues:
        ms.append(milestone("league_champion", "League Champion", 3, "rare", CAT, "awards",
                            details={"trophies": leagues[:5]}))

    # Serial Winner — 2+ distinct league titles
    if len(set(leagues)) >= 2:
        ms.append(milestone("serial_winner", "Serial Winner", 3, "rare", CAT, "awards",
                            details={"leagues": list(set(leagues))[:5]}))

    # Continental Champion
    if continental:
        ms.append(milestone("continental_champion", "Continental Champion", 3, "rare", CAT, "awards",
                            details={"trophies": continental[:3]}))

    # Europa League Winner
    if europa:
        ms.append(milestone("europa_league_winner", "Europa League Winner", 2, "uncommon", CAT, "awards"))

    # Conference League Winner
    if conference:
        ms.append(milestone("conference_league_winner", "Conference League Winner", 1, "common", CAT, "awards"))

    # Domestic Cup Winner
    if cups:
        ms.append(milestone("domestic_cup_winner", "Domestic Cup Winner", 1, "common", CAT, "awards",
                            details={"trophies": cups[:5]}))

    # Super Cup Winner
    if supers:
        ms.append(milestone("super_cup_winner", "Super Cup Winner", 1, "common", CAT, "awards",
                            details={"trophies": supers[:3]}))

    # The Treble — CL + league + domestic cup same era (approximation: all present)
    if elite and leagues and cups:
        ms.append(milestone("treble_winner", "The Treble", 5, "epic", CAT, "awards"))

    # The Double — league + domestic cup
    elif leagues and cups:
        ms.append(milestone("double_winner", "The Double", 3, "rare", CAT, "awards"))

    # Rising Through the Ranks — promotion detection from career
    club_leagues = pd.get("club_leagues", {})
    if career and club_leagues:
        league_tiers_seen = set()
        from pipeline.xp_detectors.helpers import TOP5_LEAGUES
        for e in career:
            cid = e.get("club_id")
            if cid and cid in club_leagues:
                lg = club_leagues[cid]
                if lg in TOP5_LEAGUES:
                    league_tiers_seen.add("top5")
                else:
                    league_tiers_seen.add("lower")
        if "lower" in league_tiers_seen and "top5" in league_tiers_seen:
            ms.append(milestone("rising_through_ranks", "Rising Through the Ranks", 2, "uncommon", CAT,
                                "career_history"))

    # Promotion Climber — lower league to top-5 within 5 years
    from pipeline.xp_detectors.helpers import TOP5_LEAGUES
    if career and club_leagues:
        senior = [e for e in career if e.get("start_date") and
                  (not e.get("team_type") or e["team_type"] == "senior_club")]
        non_top5 = [e for e in senior if club_leagues.get(e.get("club_id")) and
                    club_leagues[e["club_id"]] not in TOP5_LEAGUES]
        top5 = [e for e in senior if club_leagues.get(e.get("club_id")) and
                club_leagues[e["club_id"]] in TOP5_LEAGUES]
        if non_top5 and top5:
            first_lower = min(non_top5, key=lambda e: e["start_date"])
            first_top5 = min(top5, key=lambda e: e["start_date"])
            if first_lower["start_date"] < first_top5["start_date"]:
                gap = (first_top5["start_date"] - first_lower["start_date"]).days / 365.25
                if gap <= 5:
                    ms.append(milestone("promotion_climber", "Promotion Climber", 3, "rare", CAT,
                                        "career_history", date=first_top5["start_date"],
                                        details={"from": first_lower.get("club_name"),
                                                 "to": first_top5.get("club_name"),
                                                 "years": round(gap, 1)}))

    return ms
