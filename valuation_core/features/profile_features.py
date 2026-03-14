"""
Profile feature extraction — archetype vectors, attribute grades,
personality codes, playing style tags.

Transforms the PlayerProfile into the feature vector consumed by Layer 1.
"""

from __future__ import annotations

import numpy as np

from valuation_core.config import (
    ALL_MODELS,
    CONFIDENCE_WEIGHTS,
    LOW_OBSERVABILITY_ATTRIBUTES,
    MODEL_ATTRIBUTES,
    POSITIONAL_ARCHETYPE_TIERS,
    RISK_TAGS,
    VALUE_TAGS,
)
from valuation_core.types import Confidence, PlayerProfile

# All 34 playing style tags for multi-hot encoding
ALL_STYLE_TAGS = [
    # In Possession (15)
    "Ball Progressor", "Tempo Setter", "Press Resistant", "Half-Space Operator",
    "Line Breaker", "Switch Player", "Width Provider", "Positional Anchor",
    "Inverted Player", "Link-Up Artist", "Hold-Up Target", "Direct Runner",
    "Box Crasher", "Drop Deep Creator", "Overlap Runner",
    # Out of Possession (9)
    "Press Trigger", "Cover Shadow", "Compactor", "Recoverer",
    "Controlled Aggressor", "High Line Defender", "Deep Defender",
    "1v1 Isolator", "Tactical Fouler",
    # In Transition (4)
    "Transition Threat", "Counter-Press Leader", "Phase Skipper", "Third-Man Runner",
    # Specialist Weapons (6)
    "Set-Piece Delivery", "Dead-Ball Threat", "Long Throw Weapon",
    "Two-Footed", "Aerial Target", "Penalty Specialist",
]

# Personality codes — 4 binary dimensions
PERSONALITY_POLES = [
    ("A", "I"),  # Analytical / Instinctive
    ("X", "N"),  # Extrinsic / Intrinsic
    ("S", "L"),  # Soloist / Leader
    ("C", "P"),  # Competitor / Composer
]


def extract_archetype_features(profile: PlayerProfile) -> dict[str, float]:
    """Extract archetype-related features from the player profile."""
    features: dict[str, float] = {}

    # Raw archetype scores (12 continuous features)
    for model in ALL_MODELS:
        features[f"archetype_{model.lower()}"] = profile.archetype_scores.get(model, 0.0)

    # Primary and secondary archetype (one-hot)
    primary = profile.primary_archetype
    secondary = profile.secondary_archetype
    for model in ALL_MODELS:
        features[f"primary_{model.lower()}"] = 1.0 if model == primary else 0.0
        features[f"secondary_{model.lower()}"] = 1.0 if model == secondary else 0.0

    # Primary-secondary gap
    features["primary_secondary_gap"] = profile.primary_secondary_gap

    return features


def extract_attribute_features(profile: PlayerProfile) -> dict[str, float]:
    """Extract per-attribute features and confidence metrics."""
    features: dict[str, float] = {}

    # Per-attribute effective grades
    all_attrs = set()
    for model, attrs in MODEL_ATTRIBUTES.items():
        all_attrs.update(attrs)

    grades = []
    confidences = []
    inferred_count = 0
    stale_count = 0
    total_attrs = len(all_attrs)

    for attr in sorted(all_attrs):
        grade_info = profile.attributes.get(attr)
        if grade_info:
            features[f"attr_{attr}"] = grade_info.effective_grade
            grades.append(grade_info.effective_grade)
            confidences.append(CONFIDENCE_WEIGHTS.get(grade_info.confidence.value, 0.3))
            if grade_info.grade_type.value == "inferred":
                inferred_count += 1
            if grade_info.stale:
                stale_count += 1
        else:
            features[f"attr_{attr}"] = 0.0

    # Attribute ceiling and floor
    if grades:
        features["attribute_ceiling"] = max(grades)
        features["attribute_floor"] = min(grades)
    else:
        features["attribute_ceiling"] = 0.0
        features["attribute_floor"] = 0.0

    # Profile confidence score (weighted mean across positionally-relevant attributes)
    position = profile.position or "CM"
    relevant_models = POSITIONAL_ARCHETYPE_TIERS.get(position, {})
    relevant_attrs = set()
    for model in relevant_models:
        if model in MODEL_ATTRIBUTES:
            relevant_attrs.update(MODEL_ATTRIBUTES[model])

    relevant_confidences = []
    for attr in relevant_attrs:
        grade_info = profile.attributes.get(attr)
        if grade_info:
            relevant_confidences.append(
                CONFIDENCE_WEIGHTS.get(grade_info.confidence.value, 0.3)
            )

    features["profile_confidence_score"] = (
        float(np.mean(relevant_confidences)) if relevant_confidences else 0.3
    )

    # Inferred and stale fractions
    features["inferred_fraction"] = inferred_count / max(total_attrs, 1)
    features["stale_fraction"] = stale_count / max(total_attrs, 1)

    # Positional fit score
    if profile.archetype_scores and relevant_models:
        weighted_fit = sum(
            profile.archetype_scores.get(m, 0) * w
            for m, w in relevant_models.items()
        )
        max_possible = sum(100 * w for w in relevant_models.values())
        features["positional_fit_score"] = weighted_fit / max_possible if max_possible > 0 else 0.0
    else:
        features["positional_fit_score"] = 0.0

    return features


def extract_personality_features(profile: PlayerProfile) -> dict[str, float]:
    """Extract personality code and tag features."""
    features: dict[str, float] = {}

    # Personality code → 4 binary features
    code = profile.personality_code or ""
    for i, (high, low) in enumerate(PERSONALITY_POLES):
        if len(code) > i:
            features[f"personality_{high}"] = 1.0 if code[i] == high else 0.0
        else:
            features[f"personality_{high}"] = 0.5  # unknown = neutral

    # Risk and value tag counts
    risk_count = sum(1 for t in profile.personality_tags if t in RISK_TAGS)
    value_count = sum(1 for t in profile.personality_tags if t in VALUE_TAGS)
    features["risk_tag_count"] = float(risk_count)
    features["value_tag_count"] = float(value_count)

    # Individual high-impact tag flags
    high_impact = [
        "Contract Sensitive", "High Exit Probability", "Commercially Motivated",
        "Declining Trajectory", "Proven at Level", "Undroppable", "Culture Setter",
    ]
    for tag in high_impact:
        features[f"tag_{tag.lower().replace(' ', '_')}"] = (
            1.0 if tag in profile.personality_tags else 0.0
        )

    return features


def extract_style_tag_features(profile: PlayerProfile) -> dict[str, float]:
    """Extract playing style tag features (34-dim multi-hot)."""
    features: dict[str, float] = {}
    for tag in ALL_STYLE_TAGS:
        key = f"style_{tag.lower().replace(' ', '_').replace('-', '_')}"
        features[key] = 1.0 if tag in profile.playing_style_tags else 0.0
    return features


def extract_all_profile_features(profile: PlayerProfile) -> dict[str, float]:
    """Extract all profile-derived features into a single dict."""
    features: dict[str, float] = {}
    features.update(extract_archetype_features(profile))
    features.update(extract_attribute_features(profile))
    features.update(extract_personality_features(profile))
    features.update(extract_style_tag_features(profile))
    return features


def compute_confidence_state(profile: PlayerProfile) -> str:
    """
    Determine overall confidence state of a profile.

    Returns: "high" | "medium" | "low" | "very_low"
    """
    if not profile.attributes:
        return "very_low"

    confidences = [g.confidence for g in profile.attributes.values()]
    high_pct = sum(1 for c in confidences if c == Confidence.HIGH) / len(confidences)
    low_pct = sum(1 for c in confidences if c == Confidence.LOW) / len(confidences)

    # Check for low-observability attributes without scout observation
    low_obs_count = sum(
        1 for attr, g in profile.attributes.items()
        if attr in LOW_OBSERVABILITY_ATTRIBUTES and g.grade_type.value != "scout"
    )
    low_obs_total = sum(
        1 for attr in profile.attributes if attr in LOW_OBSERVABILITY_ATTRIBUTES
    )
    low_obs_fraction = low_obs_count / max(low_obs_total, 1)

    # Inferred fraction
    inferred_pct = sum(
        1 for g in profile.attributes.values() if g.grade_type.value == "inferred"
    ) / len(confidences)

    if high_pct >= 0.7 and inferred_pct < 0.1:
        return "high"
    elif low_pct >= 0.5 or inferred_pct >= 0.4:
        return "very_low" if inferred_pct >= 0.6 else "low"
    else:
        return "medium"
