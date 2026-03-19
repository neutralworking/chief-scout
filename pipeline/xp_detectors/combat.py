"""COMBAT MASTERY — 38 events from api_football + fbref + understat stats."""

from pipeline.xp_detectors.helpers import milestone

CAT = "combat"


def detect(pd):
    ms = []
    af_seasons = pd.get("af_seasons", [])  # list of dicts per season
    fbref_seasons = pd.get("fbref_seasons", [])
    understat_seasons = pd.get("understat_seasons", [])
    total_goals = pd.get("total_goals") or 0

    # ── Career goal milestones (from people.total_goals) ──────────────────
    # Career goal milestones — from people.total_goals AND aggregated AF stats
    af_career_goals = sum(s.get("goals") or 0 for s in af_seasons)
    effective_goals = max(total_goals, af_career_goals)

    if effective_goals >= 500:
        ms.append(milestone("goals_500_club", "500 Club", 8, "legendary", CAT, "computed",
                            details={"goals": effective_goals}))
    elif effective_goals >= 300:
        ms.append(milestone("goals_300_club", "300 Club", 5, "epic", CAT, "computed",
                            details={"goals": effective_goals}))
    elif effective_goals >= 200:
        ms.append(milestone("goals_double_century", "Double Century", 3, "rare", CAT, "computed",
                            details={"goals": effective_goals}))
    elif effective_goals >= 100:
        ms.append(milestone("goals_century", "Century", 2, "uncommon", CAT, "computed",
                            details={"goals": effective_goals}))
    elif effective_goals >= 50:
        ms.append(milestone("goals_half_century", "Half Century", 1, "common", CAT, "computed",
                            details={"goals": effective_goals}))

    # ── Per-season stat events (API-Football) ─────────────────────────────
    consecutive_iron_man = 0
    consecutive_good_rating = 0
    career_apps = 0

    for s in af_seasons:
        season = s.get("season")
        goals = s.get("goals") or 0
        assists = s.get("assists") or 0
        appearances = s.get("appearances") or 0
        minutes = s.get("minutes") or 0
        shots_total = s.get("shots_total") or 0
        passes_accuracy = s.get("passes_accuracy")
        key_passes = s.get("key_passes") or 0
        tackles_total = s.get("tackles_total") or 0
        interceptions = s.get("interceptions") or 0
        blocks = s.get("blocks") or 0
        dribbles_success = s.get("dribbles_success") or 0
        dribbles_attempts = s.get("dribbles_attempts") or 0
        duels_won = s.get("duels_won") or 0
        duels_total = s.get("duels_total") or 0
        rating = s.get("rating")
        penalty_scored = s.get("penalty_scored") or 0
        penalty_missed = s.get("penalty_missed") or 0
        fouls_drawn = s.get("fouls_drawn") or 0
        yellow = s.get("yellow_cards") or 0
        red = s.get("red_cards") or 0
        career_apps += appearances
        ga = goals + assists

        # Goal milestones per season
        if goals >= 40:
            ms.append(milestone("goals_40_season", f"40-Goal Season ({season})", 8, "legendary", CAT,
                                "api_football", season=season, details={"goals": goals}))
        elif goals >= 30:
            ms.append(milestone("goals_30_season", f"30-Goal Season ({season})", 5, "epic", CAT,
                                "api_football", season=season, details={"goals": goals}))
        elif goals >= 20:
            ms.append(milestone("goals_20_season", f"20-Goal Season ({season})", 3, "rare", CAT,
                                "api_football", season=season, details={"goals": goals}))
        elif goals >= 15:
            ms.append(milestone("goals_15_season", f"15-Goal Season ({season})", 2, "uncommon", CAT,
                                "api_football", season=season, details={"goals": goals}))
        elif goals >= 10:
            ms.append(milestone("goals_10_season", f"Double Digits ({season})", 1, "common", CAT,
                                "api_football", season=season, details={"goals": goals}))

        # First Blood — first goal (approximate: first season with goals > 0)
        if goals > 0 and not any("first_blood" in m["milestone_key"] for m in ms):
            ms.append(milestone("first_blood", "First Blood", 1, "common", CAT,
                                "api_football"))

        # Assist milestones
        if assists >= 20:
            ms.append(milestone("assist_king_season", f"Assist King ({season})", 5, "epic", CAT,
                                "api_football", season=season, details={"assists": assists}))
        elif assists >= 15:
            ms.append(milestone("elite_provider_season", f"Elite Provider ({season})", 3, "rare", CAT,
                                "api_football", season=season, details={"assists": assists}))
        elif assists >= 10:
            ms.append(milestone("provider_season", f"Provider ({season})", 2, "uncommon", CAT,
                                "api_football", season=season, details={"assists": assists}))

        # Combined G+A
        if ga >= 40:
            ms.append(milestone("ga_40_season", f"G+A 40+ ({season})", 8, "legendary", CAT,
                                "api_football", season=season, details={"ga": ga}))
        elif ga >= 30:
            ms.append(milestone("ga_30_season", f"G+A 30+ ({season})", 5, "epic", CAT,
                                "api_football", season=season, details={"ga": ga}))
        elif ga >= 25:
            ms.append(milestone("ga_25_season", f"G+A 25+ ({season})", 3, "rare", CAT,
                                "api_football", season=season, details={"ga": ga}))
        elif ga >= 20:
            ms.append(milestone("ga_20_season", f"G+A 20+ ({season})", 2, "uncommon", CAT,
                                "api_football", season=season, details={"ga": ga}))

        # Passing
        if key_passes >= 80:
            ms.append(milestone("creative_engine_season", f"Creative Engine ({season})", 2, "uncommon",
                                CAT, "api_football", season=season, details={"key_passes": key_passes}))
        if passes_accuracy and passes_accuracy >= 90:
            ms.append(milestone("pass_master_season", f"Pass Master ({season})", 2, "uncommon", CAT,
                                "api_football", season=season, details={"accuracy": passes_accuracy}))

        # Defending
        if tackles_total >= 80:
            ms.append(milestone("tackle_machine_season", f"Tackle Machine ({season})", 2, "uncommon",
                                CAT, "api_football", season=season, details={"tackles": tackles_total}))
        if interceptions >= 60:
            ms.append(milestone("interception_king_season", f"Interception King ({season})", 1, "common",
                                CAT, "api_football", season=season, details={"interceptions": interceptions}))
        if duels_total and duels_total > 0:
            duel_rate = duels_won / duels_total * 100
            if duel_rate >= 65 and duels_total >= 100:
                ms.append(milestone("duel_dominator_season", f"Duel Dominator ({season})", 2, "uncommon",
                                    CAT, "api_football", season=season,
                                    details={"rate": round(duel_rate, 1), "total": duels_total}))
        def_total = tackles_total + interceptions + blocks
        if def_total >= 150:
            ms.append(milestone("defensive_wall_season", f"Defensive Wall ({season})", 2, "uncommon",
                                CAT, "api_football", season=season, details={"combined": def_total}))

        # Dribbling
        if dribbles_attempts and dribbles_attempts >= 50:
            dribble_rate = dribbles_success / dribbles_attempts * 100
            if dribble_rate >= 65:
                ms.append(milestone("dribble_wizard_season", f"Dribble Wizard ({season})", 2, "uncommon",
                                    CAT, "api_football", season=season,
                                    details={"rate": round(dribble_rate, 1)}))

        # Durability
        if minutes >= 3000:
            ms.append(milestone("iron_man_season", f"Iron Man ({season})", 2, "uncommon", CAT,
                                "api_football", season=season, details={"minutes": minutes}))
            consecutive_iron_man += 1
        else:
            consecutive_iron_man = 0

        if consecutive_iron_man >= 3 and not any("iron_man_streak" in m["milestone_key"] for m in ms):
            ms.append(milestone("iron_man_streak", "Iron Man Streak", 5, "epic", CAT,
                                "api_football", details={"consecutive": consecutive_iron_man}))

        if appearances >= 35:
            ms.append(milestone("ever_present_season", f"Ever Present ({season})", 1, "common", CAT,
                                "api_football", season=season, details={"apps": appearances}))

        # Ratings
        if rating:
            if rating >= 8.5:
                ms.append(milestone("world_class_season_rating", f"World Class Season ({season})", 5, "epic", CAT,
                                    "api_football", season=season, details={"rating": rating}))
            elif rating >= 8.0:
                ms.append(milestone("elite_season_rating", f"Elite Season ({season})", 3, "rare", CAT,
                                    "api_football", season=season, details={"rating": rating}))
            elif rating >= 7.5:
                ms.append(milestone("consistent_performer_season", f"Consistent Performer ({season})", 2,
                                    "uncommon", CAT, "api_football", season=season, details={"rating": rating}))
            elif rating >= 7.2:
                ms.append(milestone("solid_season_rating", f"Solid Season ({season})", 1,
                                    "common", CAT, "api_football", season=season, details={"rating": rating}))

            if rating >= 7.2:
                consecutive_good_rating += 1
            else:
                consecutive_good_rating = 0

            if consecutive_good_rating >= 3 and not any("sustained_excellence" in m["milestone_key"] for m in ms):
                ms.append(milestone("sustained_excellence", "Sustained Excellence", 5, "epic", CAT,
                                    "api_football", details={"consecutive": consecutive_good_rating}))

        # Penalties
        if penalty_scored >= 5:
            ms.append(milestone("penalty_specialist_season", f"Penalty Specialist ({season})", 1, "common",
                                CAT, "api_football", season=season,
                                details={"scored": penalty_scored, "missed": penalty_missed}))
        if penalty_missed >= 3:
            ms.append(milestone("penalty_woes_season", f"Penalty Woes ({season})", -1, "cursed",
                                CAT, "api_football", season=season, details={"missed": penalty_missed}))

        # Lightning Rod (fouls drawn)
        if fouls_drawn >= 60:
            ms.append(milestone("lightning_rod_season", f"Lightning Rod ({season})", 1, "common",
                                CAT, "api_football", season=season, details={"fouls_drawn": fouls_drawn}))

        # Lethal Efficiency
        if goals >= 10 and minutes > 0:
            mpg = minutes / goals
            if mpg <= 120:
                ms.append(milestone("lethal_efficiency_season", f"Lethal Efficiency ({season})", 2,
                                    "uncommon", CAT, "api_football", season=season,
                                    details={"mins_per_goal": round(mpg, 1)}))

    # Career appearance milestones
    if career_apps >= 500:
        ms.append(milestone("apps_500_career", "500 Career Apps", 2, "uncommon", CAT,
                            "api_football", details={"apps": career_apps}))
    elif career_apps >= 300:
        ms.append(milestone("apps_300_club", "300 Club", 3, "rare", CAT,
                            "api_football", details={"apps": career_apps}))
    elif career_apps >= 200:
        ms.append(milestone("apps_200_club", "200 Club", 2, "uncommon", CAT,
                            "api_football", details={"apps": career_apps}))
    elif career_apps >= 100:
        ms.append(milestone("apps_centurion", "Centurion", 1, "common", CAT,
                            "api_football", details={"apps": career_apps}))

    # ── xG events from Understat ──────────────────────────────────────────
    for s in understat_seasons:
        season = s.get("season")
        goals = s.get("goals") or 0
        xg = s.get("xg") or 0
        if goals >= 5 and xg > 0:
            ratio = goals / xg
            diff = goals - xg
            if diff >= 5:
                ms.append(milestone("clinical_finisher_season", f"Clinical Finisher ({season})", 3,
                                    "rare", CAT, "understat", season=season,
                                    details={"goals": goals, "xg": round(xg, 1)}))
            elif diff >= 3:
                ms.append(milestone("sharp_finisher_season", f"Sharp Finisher ({season})", 2,
                                    "uncommon", CAT, "understat", season=season,
                                    details={"goals": goals, "xg": round(xg, 1)}))
            elif ratio >= 1.15:
                ms.append(milestone("defying_data_season", f"Defying the Data ({season})", 1,
                                    "common", CAT, "understat", season=season,
                                    details={"ratio": round(ratio, 2)}))
            elif ratio < 0.70:
                ms.append(milestone("finishing_woes_season", f"Finishing Woes ({season})", -1,
                                    "cursed", CAT, "understat", season=season,
                                    details={"ratio": round(ratio, 2)}))

    # ── Progressive passing from FBRef ────────────────────────────────────
    for s in fbref_seasons:
        season = s.get("season")
        prog_passes = s.get("progressive_passes") or 0
        if prog_passes >= 100:
            ms.append(milestone("progressive_passer_season", f"Progressive Passer ({season})", 1,
                                "common", CAT, "fbref", season=season,
                                details={"prog_passes": prog_passes}))

    return ms
