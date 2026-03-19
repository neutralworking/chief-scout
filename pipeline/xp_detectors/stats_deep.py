"""STATISTICAL DEEP CUTS — 14 events from api_football + fbref + understat + kaggle."""

from pipeline.xp_detectors.helpers import milestone

CAT = "stats_deep"


def detect(pd):
    ms = []
    af_seasons = pd.get("af_seasons", [])
    fbref_seasons = pd.get("fbref_seasons", [])
    understat_seasons = pd.get("understat_seasons", [])

    # Sort all season data chronologically
    af_sorted = sorted(af_seasons, key=lambda s: s.get("season", ""))
    fbref_sorted = sorted(fbref_seasons, key=lambda s: s.get("season", ""))

    # ── Breakthrough Season — first season with G+A >= 15 ─────────────────
    for s in af_sorted:
        season = s.get("season")
        ga = (s.get("goals") or 0) + (s.get("assists") or 0)
        if ga >= 15:
            ms.append(milestone("breakthrough_season", f"Breakthrough Season ({season})", 3, "rare",
                                CAT, "api_football", season=season, details={"ga": ga}))
            break
        elif ga >= 10:
            ms.append(milestone("arrival_season", f"Arrival Season ({season})", 2, "uncommon",
                                CAT, "api_football", season=season, details={"ga": ga}))
            break

    # ── Career-Best Season — season with highest G+A ──────────────────────
    if len(af_sorted) >= 3:
        best = max(af_sorted, key=lambda s: (s.get("goals") or 0) + (s.get("assists") or 0))
        best_ga = (best.get("goals") or 0) + (best.get("assists") or 0)
        if best_ga >= 20:
            ms.append(milestone("career_best_season", f"Career-Best Season ({best.get('season')})", 2,
                                "uncommon", CAT, "api_football", season=best.get("season"),
                                details={"ga": best_ga}))

    # ── Explosive Season — G+A 2x spike over previous season ──────────────
    for i in range(1, len(af_sorted)):
        prev_ga = (af_sorted[i-1].get("goals") or 0) + (af_sorted[i-1].get("assists") or 0)
        curr_ga = (af_sorted[i].get("goals") or 0) + (af_sorted[i].get("assists") or 0)
        if prev_ga >= 5 and curr_ga >= prev_ga * 2:
            season = af_sorted[i].get("season")
            ms.append(milestone("explosive_season", f"Explosive Season ({season})", 2, "uncommon",
                                CAT, "api_football", season=season,
                                details={"prev_ga": prev_ga, "curr_ga": curr_ga}))
            break

    # ── Year-on-Year Growth — 3+ consecutive improving seasons ────────────
    if len(af_sorted) >= 3:
        improving = 0
        for i in range(1, len(af_sorted)):
            prev_ga = (af_sorted[i-1].get("goals") or 0) + (af_sorted[i-1].get("assists") or 0)
            curr_ga = (af_sorted[i].get("goals") or 0) + (af_sorted[i].get("assists") or 0)
            if curr_ga > prev_ga and curr_ga >= 5:
                improving += 1
            else:
                improving = 0
            if improving >= 2:
                ms.append(milestone("year_on_year_growth", "Year-on-Year Growth", 2, "uncommon",
                                    CAT, "api_football",
                                    details={"consecutive": improving + 1}))
                break

    # ── Multi-Season Improver — rating improvement 3 consecutive ──────────
    if len(af_sorted) >= 3:
        rating_improving = 0
        for i in range(1, len(af_sorted)):
            prev_r = af_sorted[i-1].get("rating")
            curr_r = af_sorted[i].get("rating")
            if prev_r and curr_r and curr_r > prev_r:
                rating_improving += 1
            else:
                rating_improving = 0
            if rating_improving >= 2:
                ms.append(milestone("multi_season_improver", "Multi-Season Improver", 2, "uncommon",
                                    CAT, "api_football"))
                break

    # ── FBRef Deep Cuts ───────────────────────────────────────────────────
    for s in fbref_sorted:
        season = s.get("season")

        # Ball Progressor — 100+ progressive carries
        prog_carries = s.get("progressive_carries") or 0
        if prog_carries >= 100:
            ms.append(milestone("ball_progressor_season", f"Ball Progressor ({season})", 1, "common",
                                CAT, "fbref", season=season, details={"carries": prog_carries}))

        # Chance Creator — key passes 80+
        key_passes = s.get("key_passes") or 0
        if key_passes >= 80:
            ms.append(milestone("chance_creator_season", f"Chance Creator ({season})", 2, "uncommon",
                                CAT, "fbref", season=season, details={"key_passes": key_passes}))

        # Complete Season — goals + assists + tackles all above thresholds
        goals = s.get("goals") or 0
        assists = s.get("assists") or 0
        tackles = s.get("tackles") or 0
        if goals >= 5 and assists >= 5 and tackles >= 20:
            ms.append(milestone("complete_season", f"Complete Season ({season})", 2, "uncommon", CAT,
                                "fbref", season=season,
                                details={"goals": goals, "assists": assists, "tackles": tackles}))

    # ── Understat Deep Cuts ───────────────────────────────────────────────
    for s in understat_seasons:
        season = s.get("season")
        xa = s.get("xa") or 0
        xg_chain = s.get("xg_chain") or 0
        xg_buildup = s.get("xg_buildup") or 0

        if xa >= 12:
            ms.append(milestone("season_of_assists", f"Season of Assists ({season})", 2, "uncommon",
                                CAT, "understat", season=season, details={"xa": round(xa, 1)}))

        if xg_chain >= 20:
            ms.append(milestone("buildup_king_season", f"Build-Up King ({season})", 2, "uncommon",
                                CAT, "understat", season=season, details={"xg_chain": round(xg_chain, 1)}))

        if xg_buildup >= 15:
            ms.append(milestone("high_involvement_season", f"High Involvement ({season})", 1, "common",
                                CAT, "understat", season=season,
                                details={"xg_buildup": round(xg_buildup, 1)}))

    return ms
