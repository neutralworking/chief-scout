"""BONDS & RIVALRIES — 15 events from career_history + career_metrics."""

from pipeline.xp_detectors.helpers import milestone, TODAY, infer_team_type

CAT = "bonds"


def detect(pd):
    ms = []
    career = pd.get("career_entries", [])
    cm = pd.get("career_metric") or {}

    for e in career:
        if not e.get("team_type"):
            e["team_type"] = infer_team_type(e.get("club_name", ""))

    senior = [e for e in career if e.get("team_type") == "senior_club" and e.get("start_date")]
    national = [e for e in career if e.get("team_type") == "national_team"]

    trajectory = cm.get("trajectory")
    career_years = cm.get("career_years") or 0
    max_tenure = cm.get("max_tenure_yrs") or 0

    # ── International Caps ────────────────────────────────────────────────
    caps = pd.get("international_caps")
    # Count senior national team entries (exclude youth)
    senior_nats = [e for e in national if not any(
        x in (e.get("club_name") or "").lower() for x in ("u21", "u20", "u19", "u18", "u17", "u16", "youth")
    )]

    if senior_nats:
        ms.append(milestone("international_career", "International Career", 3, "rare", CAT,
                            "career_history",
                            details={"teams": list({e["club_name"] for e in senior_nats if e.get("club_name")})[:3]}))
    elif national:
        ms.append(milestone("youth_international", "Youth International", 1, "common", CAT,
                            "career_history",
                            details={"teams": list({e["club_name"] for e in national if e.get("club_name")})[:3]}))

    if caps:
        if caps >= 150:
            ms.append(milestone("caps_150", "150 Caps", 5, "epic", CAT,
                                "career_history", details={"caps": caps}))
        elif caps >= 100:
            ms.append(milestone("caps_100", "100 Caps", 3, "rare", CAT,
                                "career_history", details={"caps": caps}))
        elif caps >= 50:
            ms.append(milestone("caps_50", "50 Caps", 2, "uncommon", CAT,
                                "career_history", details={"caps": caps}))

    # ── Loyalty milestones ────────────────────────────────────────────────
    if trajectory == "one-club":
        if max_tenure >= 15:
            ms.append(milestone("one_club_immortal", "One-Club Immortal", 8, "legendary", CAT,
                                "career_metrics", details={"years": max_tenure}))
        elif max_tenure >= 10:
            ms.append(milestone("one_club_legend", "One-Club Legend", 5, "epic", CAT,
                                "career_metrics", details={"years": max_tenure}))
        elif career_years >= 5:
            ms.append(milestone("one_club_loyalty", "One-Club Loyalty", 3, "rare", CAT,
                                "career_metrics", details={"years": career_years}))

    # Long service at any club (7+ years non-loan)
    for e in senior:
        if e.get("is_loan"):
            continue
        start = e.get("start_date")
        end = e.get("end_date") or TODAY
        if start:
            years = (end - start).days / 365.25
            if years >= 10:
                ms.append(milestone("decade_at_club", "Decade at Club", 5, "epic", CAT,
                                    "career_history",
                                    details={"club": e.get("club_name"), "years": round(years, 1)}))
                break
            elif years >= 7:
                ms.append(milestone("long_service", "Long Service", 3, "rare", CAT,
                                    "career_history",
                                    details={"club": e.get("club_name"), "years": round(years, 1)}))
                break

    # Consecutive Seasons 5+ at a club (when not one-club)
    if trajectory != "one-club":
        for e in senior:
            if e.get("is_loan"):
                continue
            start = e.get("start_date")
            end = e.get("end_date") or TODAY
            if start:
                years = (end - start).days / 365.25
                if years >= 5:
                    ms.append(milestone("consecutive_seasons", "Consecutive Seasons", 1, "common", CAT,
                                        "career_history",
                                        details={"club": e.get("club_name"), "years": round(years, 1)}))
                    break

    # Loan Success — loan → permanent to equal/higher league
    club_leagues = pd.get("club_leagues", {})
    from pipeline.xp_detectors.helpers import TOP5_LEAGUES
    loan_entries = [e for e in senior if e.get("is_loan")]
    for loan in loan_entries:
        loan_end = loan.get("end_date")
        if not loan_end:
            continue
        next_perm = [e for e in senior if not e.get("is_loan") and e.get("start_date") and
                     e["start_date"] >= loan_end and (e["start_date"] - loan_end).days <= 180]
        if next_perm:
            next_move = min(next_perm, key=lambda e: e["start_date"])
            next_league = club_leagues.get(next_move.get("club_id"))
            if next_league and next_league in TOP5_LEAGUES:
                ms.append(milestone("loan_success", "Loan Success", 1, "common", CAT,
                                    "career_history",
                                    details={"loan_club": loan.get("club_name"),
                                             "signed_by": next_move.get("club_name")}))
                break

    # Captain Material — detected from traits or personality
    personality = pd.get("personality") or {}
    ei = personality.get("ei")
    comp = personality.get("competitiveness")
    if ei and comp and ei >= 65 and comp >= 75:
        ms.append(milestone("captain_material", "Captain Material", 2, "uncommon", CAT,
                            "personality", details={"ei": ei, "competitiveness": comp}))

    # Iconic Number
    # (Would need jersey_number data — skip if not available)

    # Dual National Team
    senior_nats = [e for e in national if not any(
        x in (e.get("club_name") or "").lower() for x in ("u21", "u20", "u19", "u18", "u17", "youth")
    )]
    nat_teams = set(e.get("club_name") for e in senior_nats if e.get("club_name"))
    if len(nat_teams) >= 2:
        ms.append(milestone("dual_national_team", "Dual National Team", 2, "uncommon", CAT,
                            "career_history", details={"teams": sorted(nat_teams)}))

    return ms
