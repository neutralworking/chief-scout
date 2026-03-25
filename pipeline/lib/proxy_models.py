"""
Proxy model inference for missing model scores.

Many tactical roles require models (Sprinter, Engine, Controller, Target)
that have poor data coverage after EAFC exclusion. This module infers
approximate model scores from available proxy attributes, enabling role
diversity instead of 80%+ concentration in a single role per position.

Proxy scores are discounted (0.75×) to ensure they never outcompete
real data-driven model scores.
"""

# Discount applied to all proxy-inferred scores.
# Prevents proxy roles from systematically outscoring real-data roles.
# Light discount: proxy scores are 85% of their computed value.
# Too low (0.75) = proxy roles can never compete.
# Too high (1.0) = proxy roles dominate real-data roles.
# 0.85 lets proxy roles compete when the data genuinely suggests that
# profile, without systematically overriding real model scores.
PROXY_DISCOUNT = 0.85

# Proxy rules: for each model, define which available attributes can
# approximate it, with weights reflecting correlation strength.
PROXY_RULES = {
    "Sprinter": {
        # Pace/athleticism proxies. Carries and take_ons imply speed in
        # transition — you don't beat a man without pace. Movement is
        # direct when available from scout data.
        "sources": [
            ("movement", 1.0),
            ("acceleration", 1.0),
            ("pace", 1.0),
            ("carries", 0.7),
            ("take_ons", 0.6),
        ],
        "min_attrs": 2,
    },
    "Engine": {
        # Work rate proxies. Pressing and intensity are direct. Interceptions
        # and tackling are weak proxies (defensive ≠ energetic). Require 3
        # attributes to avoid false positives — a CB with tackling + interceptions
        # shouldn't automatically get an Engine score.
        "sources": [
            ("intensity", 1.0),
            ("pressing", 1.0),
            ("stamina", 1.0),
            ("interceptions", 0.5),
            ("tackling", 0.4),
            ("duels", 0.5),
        ],
        "min_attrs": 3,
    },
    "Controller": {
        # Game management proxies. Pass accuracy indicates control.
        # Awareness and discipline suggest positional intelligence.
        # Composure is direct when available.
        "sources": [
            ("composure", 1.0),
            ("anticipation", 1.0),
            ("pass_accuracy", 0.7),
            ("awareness", 0.7),
            ("discipline", 0.6),
        ],
        "min_attrs": 2,
    },
    "Target": {
        # Aerial/physical proxies. Heading and aerial_duels are direct.
        # Aggression and duels suggest physical presence.
        "sources": [
            ("heading", 1.0),
            ("aerial_duels", 1.0),
            ("jumping", 0.8),
            ("aggression", 0.5),
            ("duels", 0.5),
        ],
        "min_attrs": 2,
    },
}


def infer_proxy_scores(best_grades, existing_model_scores):
    """Infer proxy model scores for models not already computed.

    Args:
        best_grades: dict of {attr: (score_0_20, priority)} — the normalised
            best-grade-per-attribute map from compute_model_scores().
        existing_model_scores: dict of {model_name: score} — models already
            computed from real data.

    Returns:
        dict of {model_name: proxy_score} for models that were missing and
        could be inferred. Never overrides existing scores.
    """
    proxy_scores = {}

    for model_name, rule in PROXY_RULES.items():
        # Never override real data
        if model_name in existing_model_scores:
            continue

        # Collect available proxy attributes
        weighted_values = []
        for attr, weight in rule["sources"]:
            if attr in best_grades:
                score_20 = best_grades[attr][0]
                weighted_values.append((score_20 * weight, weight))

        if len(weighted_values) < rule["min_attrs"]:
            continue

        # Weighted average → model score (same formula as real models)
        total_weighted = sum(v for v, _ in weighted_values)
        total_weight = sum(w for _, w in weighted_values)
        avg_20 = total_weighted / total_weight

        # Convert to 0-99 scale (same as real model scores: avg * 5, cap 99)
        raw_score = min(avg_20 * 5, 99)

        # Apply proxy discount
        proxy_scores[model_name] = round(raw_score * PROXY_DISCOUNT)

    return proxy_scores
