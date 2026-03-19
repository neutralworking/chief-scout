"""CURSED — 8 negative events from career_metrics + api_football + career_history."""

from pipeline.xp_detectors.helpers import milestone, infer_team_type, TODAY

CAT = "cursed"


def detect(pd):
    ms = []
    cm = pd.get("career_metric") or {}
    af_seasons = pd.get("af_seasons", [])
    career = pd.get("career_entries", [])
    club_leagues = pd.get("club_leagues", {})

    for e in career:
        if not e.get("team_type"):
            e["team_type"] = infer_team_type(e.get("club_name", ""))

    senior = [e for e in career if e.get("team_type") == "senior_club" and e.get("start_date")]

    trajectory = cm.get("trajectory")
    clubs_count = cm.get("clubs_count") or 0
    loan_count = cm.get("loan_count") or 0
    career_years = cm.get("career_years") or 0
    avg_tenure = cm.get("avg_tenure_yrs") or 0

    # Unstable Loans — 3+ loan spells
    if loan_count >= 3:
        ms.append(milestone("unstable_loans", "Unstable Loans", -1, "cursed", CAT,
                            "career_metrics", details={"loans": loan_count}))

    # Excessive Moves — 6+ clubs in <=8 years
    if clubs_count >= 6 and career_years <= 8:
        ms.append(milestone("excessive_moves", "Excessive Moves", -2, "cursed", CAT,
                            "career_metrics",
                            details={"clubs": clubs_count, "years": career_years}))

    # Journeyman — trajectory + low tenure
    if trajectory == "journeyman" and avg_tenure < 1.5:
        ms.append(milestone("journeyman", "Journeyman", -1, "cursed", CAT,
                            "career_metrics", details={"avg_tenure": avg_tenure}))

    # Career Decline — trajectory declining
    if trajectory == "declining":
        ms.append(milestone("career_decline", "Career Decline", -1, "cursed", CAT,
                            "career_metrics"))

    # Minutes Drought — season with <500 mins but 10+ apps (not current season)
    from datetime import date
    current_year = str(date.today().year)
    for s in af_seasons:
        season = str(s.get("season", ""))
        minutes = s.get("minutes") or 0
        apps = s.get("appearances") or 0
        # Skip current/recent season (likely incomplete)
        if current_year in season:
            continue
        if minutes < 500 and apps >= 10:
            ms.append(milestone("minutes_drought", f"Minutes Drought ({season})", -1, "cursed", CAT,
                                "api_football", season=season, details={"minutes": minutes, "apps": apps}))
            break  # Only one

    # Free Agent Spell — gap between clubs > 6 months
    sorted_senior = sorted(senior, key=lambda e: e["start_date"])
    for i in range(1, len(sorted_senior)):
        prev_end = sorted_senior[i-1].get("end_date")
        curr_start = sorted_senior[i].get("start_date")
        if prev_end and curr_start:
            gap_days = (curr_start - prev_end).days
            if gap_days > 180:
                ms.append(milestone("free_agent_spell", "Free Agent Spell", -1, "cursed", CAT,
                                    "career_history",
                                    details={"gap_days": gap_days,
                                             "between": [sorted_senior[i-1].get("club_name"),
                                                         sorted_senior[i].get("club_name")]}))
                break

    # Downgrade Move — moved from top-5 to non-top-5 (not loan, age < 32)
    from pipeline.xp_detectors.helpers import TOP5_LEAGUES, age_at
    dob = pd.get("dob")
    for i in range(1, len(sorted_senior)):
        prev = sorted_senior[i-1]
        curr = sorted_senior[i]
        if curr.get("is_loan"):
            continue
        prev_lg = club_leagues.get(prev.get("club_id"))
        curr_lg = club_leagues.get(curr.get("club_id"))
        if prev_lg in TOP5_LEAGUES and curr_lg and curr_lg not in TOP5_LEAGUES:
            move_age = age_at(dob, curr["start_date"]) if dob else None
            if move_age is None or move_age < 32:
                ms.append(milestone("downgrade_move", "Downgrade Move", -1, "cursed", CAT,
                                    "career_history",
                                    details={"from": prev.get("club_name"),
                                             "to": curr.get("club_name")}))
                break

    # Contract Rebel — detected from news sentiment or traits
    traits = pd.get("traits", [])
    rebel_traits = [t for t in traits if t.get("trait") and
                    any(x in t["trait"].lower() for x in ("rebel", "disrupt", "disloyal"))]
    if rebel_traits:
        ms.append(milestone("contract_rebel", "Contract Rebel", -1, "cursed", CAT,
                            "traits", details={"trait": rebel_traits[0].get("trait")}))

    return ms
