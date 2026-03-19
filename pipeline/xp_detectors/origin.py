"""ORIGIN STORY — 8 events from career_history + people."""

from pipeline.xp_detectors.helpers import (
    age_at, club_root, infer_team_type, milestone, TODAY,
)

CAT = "origin"


def detect(pd):
    """Detect origin story milestones. pd = PlayerData dict."""
    ms = []
    career = pd.get("career_entries", [])
    dob = pd.get("dob")

    # Ensure team types
    for e in career:
        if not e.get("team_type"):
            e["team_type"] = infer_team_type(e.get("club_name", ""))

    senior = [e for e in career if e.get("team_type") == "senior_club" and e.get("start_date")]
    youth = [e for e in career if e.get("team_type") == "youth" and e.get("club_name")]
    national = [e for e in career if e.get("team_type") == "national_team"]

    # Senior Debut
    if senior:
        earliest = min(senior, key=lambda e: e["start_date"])
        ms.append(milestone(
            "senior_debut", "Senior Debut", 1, "common", CAT,
            "career_history", date=earliest["start_date"],
            details={"club": earliest.get("club_name")},
        ))

        # Early Starter / Prodigy
        debut_age = age_at(dob, earliest["start_date"])
        if debut_age is not None:
            if debut_age < 16:
                ms.append(milestone(
                    "prodigy", "Prodigy", 5, "epic", CAT,
                    "career_history", date=earliest["start_date"],
                    details={"debut_age": round(debut_age, 1)},
                ))
            elif debut_age < 18:
                ms.append(milestone(
                    "early_starter", "Early Starter", 2, "uncommon", CAT,
                    "career_history", date=earliest["start_date"],
                    details={"debut_age": round(debut_age, 1)},
                ))
            elif debut_age > 22:
                ms.append(milestone(
                    "late_starter", "Late Starter", 1, "common", CAT,
                    "career_history", date=earliest["start_date"],
                    details={"debut_age": round(debut_age, 1)},
                ))

        # First Professional Contract
        non_youth_non_loan = [e for e in senior if not e.get("is_loan")]
        if non_youth_non_loan:
            first = min(non_youth_non_loan, key=lambda e: e["start_date"])
            ms.append(milestone(
                "first_contract", "First Professional Contract", 1, "common", CAT,
                "career_history", date=first["start_date"],
                details={"club": first.get("club_name")},
            ))

    # Academy Graduate
    if youth and senior:
        youth_roots = {club_root(e["club_name"]) for e in youth}
        for e in senior:
            if club_root(e.get("club_name")) in youth_roots and not e.get("is_loan"):
                ms.append(milestone(
                    "youth_academy_grad", "Academy Graduate", 3, "rare", CAT,
                    "career_history", date=e.get("start_date"),
                    details={"club": e.get("club_name")},
                ))
                break

    # Hometown Hero — birth country = first club country
    nation_id = pd.get("nation_id")
    if nation_id and senior:
        first_club_id = senior[0].get("club_id") if senior else None
        club_nations = pd.get("club_nations", {})
        if first_club_id and club_nations.get(first_club_id) == nation_id:
            ms.append(milestone(
                "hometown_hero", "Hometown Hero", 1, "common", CAT,
                "career_history", details={"club": senior[0].get("club_name")},
            ))

    # Youth International
    youth_nat = [e for e in national if e.get("club_name") and
                 any(x in e["club_name"].lower() for x in ("u21", "u20", "u19", "u18", "u17", "youth"))]
    if youth_nat:
        ms.append(milestone(
            "youth_international", "Youth International", 1, "common", CAT,
            "career_history",
            details={"teams": list({e["club_name"] for e in youth_nat})[:3]},
        ))

    return ms
