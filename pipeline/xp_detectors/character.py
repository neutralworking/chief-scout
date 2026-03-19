"""CHARACTER DEVELOPMENT — 15 events from personality + traits + api_football."""

from pipeline.xp_detectors.helpers import milestone

CAT = "character"


def detect(pd):
    ms = []
    personality = pd.get("personality") or {}
    traits = pd.get("traits", [])  # list of {trait, category, severity}
    af_seasons = pd.get("af_seasons", [])
    nat_count = pd.get("nationalities_count", 0)

    # ── Personality-based ─────────────────────────────────────────────────
    competitiveness = personality.get("competitiveness")
    coachability = personality.get("coachability")

    if competitiveness is not None:
        if competitiveness >= 90:
            ms.append(milestone("relentless_drive", "Relentless Drive", 2, "uncommon", CAT,
                                "personality", details={"score": competitiveness}))
        elif competitiveness >= 70:
            ms.append(milestone("competitive_fire", "Competitive Fire", 1, "common", CAT,
                                "personality", details={"score": competitiveness}))

    if coachability is not None:
        if coachability >= 85:
            ms.append(milestone("model_professional", "Model Professional", 2, "uncommon", CAT,
                                "personality", details={"score": coachability}))
        elif coachability >= 70:
            ms.append(milestone("student_of_game", "Student of the Game", 1, "common", CAT,
                                "personality", details={"score": coachability}))
        elif coachability is not None and coachability <= 15 and coachability > 0:
            ms.append(milestone("uncoachable", "Uncoachable", -1, "cursed", CAT,
                                "personality", details={"score": coachability}))

    # Leadership from personality code
    ei = personality.get("ei")
    tf = personality.get("tf")
    if ei is not None and tf is not None:
        if ei >= 70 and tf >= 60:
            ms.append(milestone("natural_leader", "Natural Leader", 2, "uncommon", CAT,
                                "personality", details={"ei": ei, "tf": tf}))
        elif ei >= 50 and tf >= 50:
            ms.append(milestone("quiet_authority", "Quiet Authority", 1, "common", CAT,
                                "personality", details={"ei": ei, "tf": tf}))

    # ── Discipline from API-Football ──────────────────────────────────────
    total_yellows = sum(s.get("yellow_cards", 0) for s in af_seasons)
    total_reds = sum(s.get("red_cards", 0) for s in af_seasons)
    total_apps = sum(s.get("appearances", 0) for s in af_seasons)

    if total_apps >= 100:
        card_rate = (total_yellows + total_reds * 2) / total_apps
        if card_rate < 0.1:
            ms.append(milestone("disciplined_career", "Disciplined Career", 1, "common", CAT,
                                "api_football", details={"yellows": total_yellows, "reds": total_reds,
                                                         "apps": total_apps}))

    for s in af_seasons:
        season = s.get("season")
        apps = s.get("appearances") or 0
        yellows = s.get("yellow_cards") or 0
        reds = s.get("red_cards") or 0
        if apps >= 20 and yellows == 0 and reds == 0:
            ms.append(milestone("fair_play_season", f"Fair Play ({season})", 1, "common", CAT,
                                "api_football", season=season))

    if total_reds >= 3:
        ms.append(milestone("hot_head", "Hot Head", -1, "cursed", CAT,
                            "api_football", details={"reds": total_reds}))
    if total_yellows >= 50:
        ms.append(milestone("card_collector", "Card Collector", -1, "cursed", CAT,
                            "api_football", details={"yellows": total_yellows}))

    # ── Trait-based ───────────────────────────────────────────────────────
    high_traits = [t for t in traits if (t.get("severity") or 0) >= 9]
    mid_traits = [t for t in traits if (t.get("severity") or 0) >= 8]

    # Specialist — any trait at 9+
    if high_traits:
        ms.append(milestone("specialist_trait", "Specialist", 1, "common", CAT,
                            "traits", details={"trait": high_traits[0].get("trait")}))

    # Multi-Skilled — 3+ traits at 8+
    if len(mid_traits) >= 3:
        ms.append(milestone("multi_skilled", "Multi-Skilled", 2, "uncommon", CAT,
                            "traits", details={"count": len(mid_traits)}))

    # Positional Chameleon — multiple position categories in traits
    categories = set(t.get("category") for t in traits if t.get("category"))
    if len(categories) >= 3:
        ms.append(milestone("positional_chameleon", "Positional Chameleon", 1, "common", CAT,
                            "traits", details={"categories": sorted(categories)}))

    # Dual Nationality
    if nat_count >= 2:
        ms.append(milestone("dual_nationality", "Dual Nationality", 1, "common", CAT,
                            "nationalities", details={"count": nat_count}))

    return ms
