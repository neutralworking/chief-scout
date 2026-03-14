"""
Squad gap fill scoring — how much a player addresses identified
gaps in the buying club's squad.
"""

from __future__ import annotations

from valuation_core.types import EvaluationContext, PlayerProfile


def compute_squad_gap_fill(
    profile: PlayerProfile,
    context: EvaluationContext,
) -> float:
    """
    Compute squad gap fill score (0.0 - 1.0).

    Evaluates how well the player fills identified gaps in:
    - Archetype distribution
    - Personality balance
    - Playing style coverage
    """
    if not context.squad_gaps:
        return 0.5  # no gap analysis provided

    total_score = 0.0
    gap_count = 0

    for gap in context.squad_gaps:
        # Only consider gaps at the target position
        if gap.position != context.target_position:
            continue

        gap_count += 1
        gap_score = 0.0
        components = 0

        # Archetype gap fill
        if gap.archetype_gaps and profile.archetype_scores:
            archetype_fill = 0.0
            for arch, needed_score in gap.archetype_gaps.items():
                player_score = profile.archetype_scores.get(arch, 0.0)
                if needed_score > 0:
                    fill = min(1.0, player_score / needed_score)
                    archetype_fill += fill
            if gap.archetype_gaps:
                archetype_fill /= len(gap.archetype_gaps)
            gap_score += archetype_fill
            components += 1

        # Style tag gap fill
        if gap.style_tag_gaps:
            player_tags = set(profile.playing_style_tags)
            needed = set(gap.style_tag_gaps)
            matched = len(player_tags & needed)
            tag_fill = matched / len(needed) if needed else 0.5
            gap_score += tag_fill
            components += 1

        # Personality gap fill
        if gap.personality_gaps and profile.personality_tags:
            player_tag_set = set(profile.personality_tags)
            needed_tags = set(gap.personality_gaps)
            matched = len(player_tag_set & needed_tags)
            pers_fill = matched / len(needed_tags) if needed_tags else 0.5
            gap_score += pers_fill
            components += 1

        if components > 0:
            total_score += gap_score / components

    if gap_count == 0:
        return 0.5

    return min(1.0, total_score / gap_count)
