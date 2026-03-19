"""REPUTATION & LEGEND — 22 events from awards + news + key_moments."""

import json
from pipeline.xp_detectors.helpers import milestone

CAT = "reputation"

# Individual award classifications
BALLON_DOR = {"Ballon d'Or", "FIFA World Player of the Year", "The Best FIFA Men's Player"}
GOLDEN_SHOE = {"European Golden Shoe"}
GOLDEN_BOY = {"Golden Boy"}
PFA_POTY = {"PFA Players' Player of the Year", "FWA Footballer of the Year"}
PFA_YPOTY = {"PFA Young Player of the Year"}
PICHICHI = {"Pichichi Trophy"}
CAPO = {"Capocannoniere"}
WC_GOLDEN_BALL = {"FIFA World Cup Golden Ball"}
WC_GOLDEN_BOOT = {"FIFA World Cup Golden Boot"}
PUSKAS = {"FIFA Puskás Award"}
KOPA = {"Kopa Trophy"}

ALL_INDIVIDUAL = (BALLON_DOR | GOLDEN_SHOE | GOLDEN_BOY | PFA_POTY | PFA_YPOTY |
                  PICHICHI | CAPO | WC_GOLDEN_BALL | WC_GOLDEN_BOOT | PUSKAS | KOPA)


def detect(pd):
    ms = []
    awards = pd.get("awards")
    moments = pd.get("key_moments", [])
    sentiment = pd.get("news_sentiment")

    # ── Individual Awards ─────────────────────────────────────────────────
    if awards:
        if isinstance(awards, str):
            try:
                awards = json.loads(awards)
            except (json.JSONDecodeError, TypeError):
                awards = []

        if isinstance(awards, list):
            labels = []
            for a in awards:
                if isinstance(a, str):
                    labels.append(a)
                elif isinstance(a, dict):
                    labels.append(a.get("label") or a.get("name") or "")

            award_set = set(labels)

            if award_set & BALLON_DOR:
                ms.append(milestone("ballon_dor", "Ballon d'Or", 8, "legendary", CAT, "awards",
                                    details={"awards": list(award_set & BALLON_DOR)}))
            if award_set & WC_GOLDEN_BALL:
                ms.append(milestone("wc_golden_ball", "World Cup Golden Ball", 5, "epic", CAT, "awards"))
            if award_set & WC_GOLDEN_BOOT:
                ms.append(milestone("wc_golden_boot", "World Cup Golden Boot", 3, "rare", CAT, "awards"))
            if award_set & GOLDEN_SHOE:
                ms.append(milestone("golden_shoe", "Golden Shoe", 3, "rare", CAT, "awards"))
            if award_set & GOLDEN_BOY:
                ms.append(milestone("golden_boy", "Golden Boy", 2, "uncommon", CAT, "awards"))
            if award_set & PFA_POTY:
                ms.append(milestone("pfa_poty", "PFA Player of the Year", 2, "uncommon", CAT, "awards"))
            if award_set & PFA_YPOTY:
                ms.append(milestone("pfa_ypoty", "PFA Young Player of the Year", 2, "uncommon", CAT,
                                    "awards"))
            if award_set & PICHICHI:
                ms.append(milestone("pichichi", "Pichichi", 2, "uncommon", CAT, "awards"))
            if award_set & CAPO:
                ms.append(milestone("capocannoniere", "Capocannoniere", 2, "uncommon", CAT, "awards"))
            if award_set & PUSKAS:
                ms.append(milestone("puskas", "Puskás Award", 2, "uncommon", CAT, "awards"))
            if award_set & KOPA:
                ms.append(milestone("kopa", "Kopa Trophy", 2, "uncommon", CAT, "awards"))

            # Trophy volume
            all_awards_count = len(labels)
            if all_awards_count >= 15:
                ms.append(milestone("legendary_cabinet", "Legendary Cabinet", 5, "epic", CAT,
                                    "awards", details={"count": all_awards_count}))
            elif all_awards_count >= 10:
                ms.append(milestone("decorated_career", "Decorated Career", 3, "rare", CAT,
                                    "awards", details={"count": all_awards_count}))
            elif all_awards_count >= 5:
                ms.append(milestone("trophy_cabinet", "Trophy Cabinet", 2, "uncommon", CAT,
                                    "awards", details={"count": all_awards_count}))

    # ── News Sentiment ────────────────────────────────────────────────────
    if sentiment:
        buzz = sentiment.get("buzz_score") or 0
        sent_score = sentiment.get("sentiment_score") or 0

        if buzz >= 8 and sent_score >= 0.5:
            ms.append(milestone("media_darling", "Media Darling", 1, "common", CAT,
                                "news_sentiment", details={"buzz": buzz, "sentiment": sent_score}))
        if buzz >= 5 and sent_score >= 0.7:
            ms.append(milestone("fan_favourite", "Fan Favourite", 1, "common", CAT,
                                "news_sentiment", details={"sentiment": sent_score}))
        if buzz >= 5 and sent_score <= -0.3:
            ms.append(milestone("controversial_figure", "Controversial Figure", -1, "cursed", CAT,
                                "news_sentiment", details={"sentiment": sent_score}))
        if sentiment.get("trend_7d") and sentiment["trend_7d"] > 0.3:
            ms.append(milestone("trending_up", "Trending Up", 1, "common", CAT,
                                "news_sentiment"))

    # ── Key Moments ───────────────────────────────────────────────────────
    if moments:
        goal_moments = [m for m in moments if m.get("moment_type") == "goal"]
        controversy_moments = [m for m in moments if m.get("moment_type") == "controversy"]

        if goal_moments:
            ms.append(milestone("headline_goal", "Headline Goal", 1, "common", CAT,
                                "key_moments", details={"count": len(goal_moments)}))
        if controversy_moments:
            ms.append(milestone("controversy", "Controversy", -1, "cursed", CAT,
                                "key_moments", details={"count": len(controversy_moments)}))

        if len(moments) >= 10:
            ms.append(milestone("living_legend_moments", "Living Legend", 2, "uncommon", CAT,
                                "key_moments", details={"count": len(moments)}))
        elif len(moments) >= 5:
            ms.append(milestone("story_rich_career", "Story-Rich Career", 1, "common", CAT,
                                "key_moments", details={"count": len(moments)}))

    return ms
