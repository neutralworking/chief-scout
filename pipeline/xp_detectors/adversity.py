"""ADVERSITY & RESILIENCE — 12 events from kaggle_injuries + career_history."""

from pipeline.xp_detectors.helpers import milestone, TODAY, infer_team_type, age_at

CAT = "adversity"


def detect(pd):
    ms = []
    injuries = pd.get("injuries", [])  # list of {injury_type, days_out, season, ...}
    injury_summary = pd.get("injury_summary")  # {total_days, total_injuries, major_count}
    career = pd.get("career_entries", [])
    dob = pd.get("dob")
    cm = pd.get("career_metric") or {}

    career_years = cm.get("career_years") or 0

    for e in career:
        if not e.get("team_type"):
            e["team_type"] = infer_team_type(e.get("club_name", ""))
    senior = [e for e in career if e.get("team_type") == "senior_club" and e.get("start_date")]

    # ── Injury-based milestones ───────────────────────────────────────────
    if injury_summary:
        total_days = injury_summary.get("total_days") or 0
        total_injuries = injury_summary.get("total_injuries") or 0
        major_count = injury_summary.get("major_count") or 0  # 90+ days

        # Iron Constitution — career with <30 days total injury in 5+ years
        if career_years >= 5 and total_days < 30:
            ms.append(milestone("iron_constitution", "Iron Constitution", 2, "uncommon", CAT,
                                "injuries", details={"days_out": total_days, "years": career_years}))

        # Glass Cannon — >365 days injured
        if total_days > 365:
            ms.append(milestone("glass_cannon", "Glass Cannon", -2, "cursed", CAT,
                                "injuries", details={"days_out": total_days}))

        # Recurring Nightmare — 5+ injuries of same type
        injury_types = {}
        for inj in injuries:
            itype = inj.get("injury_type", "unknown")
            injury_types[itype] = injury_types.get(itype, 0) + 1
        for itype, count in injury_types.items():
            if count >= 5:
                ms.append(milestone("recurring_nightmare", "Recurring Nightmare", -1, "cursed", CAT,
                                    "injuries", details={"type": itype, "count": count}))
                break

        # Clean Bill of Health — 0 injuries in record
        if total_injuries == 0 and career_years >= 3:
            ms.append(milestone("clean_bill", "Clean Bill of Health", 1, "common", CAT,
                                "injuries"))

    # Major Comeback — returned after 180+ day injury
    long_injuries = [i for i in injuries if (i.get("days_out") or 0) >= 180]
    if long_injuries:
        ms.append(milestone("major_comeback", "Major Comeback", 5, "epic", CAT,
                            "injuries", details={"days_out": long_injuries[0].get("days_out")}))

    # ACL Survivor
    acl = [i for i in injuries if i.get("injury_type") and
           "acl" in i["injury_type"].lower() or "cruciate" in (i.get("injury_type") or "").lower()]
    if acl:
        ms.append(milestone("acl_survivor", "ACL Survivor", 2, "uncommon", CAT,
                            "injuries", details={"count": len(acl)}))

    # Phoenix Rising — 2+ major comebacks
    if len(long_injuries) >= 2:
        ms.append(milestone("phoenix_rising", "Phoenix Rising", 5, "epic", CAT,
                            "injuries", details={"comebacks": len(long_injuries)}))

    # Comeback Season — strong season after major injury (detect via AF data)
    af_seasons = pd.get("af_seasons", [])
    for inj in long_injuries:
        inj_season = inj.get("season")
        if inj_season and af_seasons:
            # Find the next season after injury
            post_seasons = [s for s in af_seasons if s.get("season") and
                            s["season"] > inj_season and (s.get("goals", 0) + s.get("assists", 0)) >= 10]
            if post_seasons:
                ms.append(milestone("comeback_season", "Comeback Season", 2, "uncommon", CAT,
                                    "injuries", season=post_seasons[0]["season"],
                                    details={"season": post_seasons[0]["season"]}))
                break

    # ── Career longevity ──────────────────────────────────────────────────
    if career_years >= 18:
        ms.append(milestone("evergreen_legend", "Living Legend Career", 5, "epic", CAT,
                            "career_history", details={"years": career_years}))
    elif career_years >= 15:
        ms.append(milestone("evergreen", "Evergreen", 3, "rare", CAT,
                            "career_history", details={"years": career_years}))

    # Still Going Strong — age 34+ and active
    if dob:
        current_age = age_at(dob, TODAY)
        active = pd.get("active", True)
        if current_age and current_age >= 34 and active:
            ms.append(milestone("still_going_strong", "Still Going Strong", 1, "common", CAT,
                                "career_history", details={"age": round(current_age, 1)}))

    # Relegation Survivor — stayed at club through presumed relegation
    # (simplified: club went from top-5 to lower league in career)
    club_leagues = pd.get("club_leagues", {})
    from pipeline.xp_detectors.helpers import TOP5_LEAGUES
    for e in senior:
        if not e.get("end_date"):
            continue
        cid = e.get("club_id")
        if cid and club_leagues.get(cid) and club_leagues[cid] not in TOP5_LEAGUES:
            # Check if previously at a top-5 club
            prev = [p for p in senior if p.get("club_id") == cid and p.get("start_date") and
                    p["start_date"] < e["start_date"] and
                    club_leagues.get(p.get("club_id")) in TOP5_LEAGUES]
            if prev:
                ms.append(milestone("relegation_survivor", "Relegation Survivor", 1, "common", CAT,
                                    "career_history", details={"club": e.get("club_name")}))
                break

    # Bounced Back — returned to top-5 after lower league
    if senior and club_leagues:
        was_lower = False
        for e in sorted(senior, key=lambda x: x["start_date"]):
            cid = e.get("club_id")
            lg = club_leagues.get(cid, "")
            if lg and lg not in TOP5_LEAGUES:
                was_lower = True
            elif lg in TOP5_LEAGUES and was_lower:
                ms.append(milestone("bounced_back", "Bounced Back", 2, "uncommon", CAT,
                                    "career_history", date=e["start_date"],
                                    details={"club": e.get("club_name")}))
                break

    return ms
