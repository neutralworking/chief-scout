"""
Core data types for the valuation engine.

These match the spec's PlayerProfile structure and API contracts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class GradeType(str, Enum):
    SCOUT = "scout"
    STAT = "stat"
    INFERRED = "inferred"


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ValuationMode(str, Enum):
    DOF_ANCHOR = "dof_anchor"
    SCOUT_DOMINANT = "scout_dominant"
    BALANCED = "balanced"
    DATA_DOMINANT = "data_dominant"


@dataclass
class AttributeGrade:
    effective_grade: float          # 1-10
    grade_type: GradeType
    confidence: Confidence
    stale: bool = False


@dataclass
class DofAssessment:
    """Director of Football structured assessment."""
    person_id: int
    technical: int          # 1-10
    physical: int
    tactical: int
    personality: int
    commercial: int
    availability: int
    worth_right_team_meur: float    # millions EUR
    worth_any_team_meur: float
    confidence: str = "informed"    # conviction | informed | impression
    usage_profile: Optional[str] = None
    summary: Optional[str] = None


@dataclass
class PlayerProfile:
    person_id: int
    name: str
    age: Optional[int] = None
    position: Optional[str] = None
    secondary_positions: list[str] = field(default_factory=list)
    height_cm: Optional[int] = None
    preferred_foot: Optional[str] = None

    # Archetype scores (0-100, derived from attribute means × 10)
    archetype_scores: dict[str, float] = field(default_factory=dict)

    # 48+ attributes, keyed by attribute name
    attributes: dict[str, AttributeGrade] = field(default_factory=dict)

    # Personality
    personality_code: Optional[str] = None     # e.g. "INSP"
    personality_tags: list[str] = field(default_factory=list)

    # Playing style tags (Category 4)
    playing_style_tags: list[str] = field(default_factory=list)

    # Contract / market
    contract_years_remaining: Optional[float] = None
    contract_tag: Optional[str] = None
    current_wage_weekly_eur: Optional[float] = None
    release_clause_eur: Optional[float] = None
    transfer_fee_eur: Optional[float] = None
    market_value_eur: Optional[float] = None       # Transfermarkt / external market value

    # Career / meta
    league: Optional[str] = None
    club: Optional[str] = None
    club_id: Optional[int] = None
    national_team_status: Optional[str] = None  # "none" | "called_up" | "regular" | "star"
    trajectory: Optional[str] = None            # from career_metrics
    injury_days_2yr: Optional[int] = None
    level: Optional[int] = None                 # editorial level (1-99) — ceiling
    best_role_score: Optional[int] = None       # best role score (0-100) — primary value driver
    best_role: Optional[str] = None             # best tactical role name
    profile_tier: Optional[int] = None          # 1=scout-assessed, 2=data-derived, 3=skeleton
    xp_modifier: Optional[int] = None           # -5 to +8, career experience modifier

    # Performance metrics (per-90, from FBref/StatsBomb)
    performance: dict[str, float] = field(default_factory=dict)

    @property
    def primary_archetype(self) -> Optional[str]:
        if not self.archetype_scores:
            return None
        return max(self.archetype_scores, key=self.archetype_scores.get)

    @property
    def secondary_archetype(self) -> Optional[str]:
        if len(self.archetype_scores) < 2:
            return None
        sorted_archetypes = sorted(
            self.archetype_scores, key=self.archetype_scores.get, reverse=True
        )
        return sorted_archetypes[1]

    @property
    def primary_secondary_gap(self) -> float:
        if len(self.archetype_scores) < 2:
            return 0.0
        scores = sorted(self.archetype_scores.values(), reverse=True)
        return scores[0] - scores[1]


@dataclass
class ClubContext:
    club_id: Optional[int] = None
    club_name: Optional[str] = None
    league: Optional[str] = None
    league_tier: Optional[int] = None       # 1=Top 5, 2=6-10, etc.
    financial_tier: Optional[str] = None    # "elite" | "high" | "medium" | "low"
    objective: Optional[str] = None         # "survival" | "mid_table" | "europe" | "title"
    selling_pressure: Optional[float] = None  # 0-1, higher = more desperate


@dataclass
class SquadGap:
    position: str
    archetype_gaps: dict[str, float] = field(default_factory=dict)
    personality_gaps: list[str] = field(default_factory=list)
    style_tag_gaps: list[str] = field(default_factory=list)


@dataclass
class EvaluationContext:
    buying_club: ClubContext
    target_position: str
    target_system: str                          # key into TACTICAL_SYSTEMS
    squad_gaps: list[SquadGap] = field(default_factory=list)
    window: str = "summer"                      # "summer" | "winter" | "out_of_window"
    selling_club: Optional[ClubContext] = None


@dataclass
class ValuationRequest:
    player_id: int
    player_profile: Optional[PlayerProfile] = None
    evaluation_context: Optional[EvaluationContext] = None
    mode: ValuationMode = ValuationMode.SCOUT_DOMINANT
    scout_confidence_override: Optional[float] = None
    model_version: str = "v1.0"


@dataclass
class MarketValue:
    central: int        # P50 in EUR
    p10: int
    p25: int
    p75: int
    p90: int


@dataclass
class ContextualFitBreakdown:
    system_archetype_fit: float
    system_threshold_fit: float
    system_personality_fit: float
    system_tag_compatibility: float
    squad_gap_fill: float


@dataclass
class UseValue:
    central: int
    contextual_fit_score: float
    contextual_fit_breakdown: ContextualFitBreakdown


@dataclass
class Decomposition:
    scout_profile_contribution: float
    performance_data_contribution: float
    contract_age_contribution: float
    market_context_contribution: float
    personality_adjustment: float
    playing_style_fit_adjustment: float


@dataclass
class ConfidenceReport:
    profile_confidence: float
    data_coverage: float
    overall_confidence: str  # "high" | "medium" | "low"
    band_width_ratio: float


@dataclass
class DisagreementReport:
    scout_anchored_value: int
    data_implied_value: int
    divergent_features: list[str]
    narrative: str


@dataclass
class ComparableTransfer:
    player_name: str
    person_id: Optional[int] = None
    from_club: Optional[str] = None
    to_club: Optional[str] = None
    fee_eur: Optional[int] = None
    transfer_date: Optional[str] = None
    age_at_transfer: Optional[int] = None
    position: Optional[str] = None
    archetype: Optional[str] = None
    similarity_score: float = 0.0


@dataclass
class ValuationResponse:
    market_value: MarketValue
    use_value: Optional[UseValue]
    decomposition: Decomposition
    confidence: ConfidenceReport
    disagreement_flag: bool = False
    disagreement: Optional[DisagreementReport] = None
    stale_profile: bool = False
    low_data_warning: bool = False
    personality_risk_flags: list[str] = field(default_factory=list)
    style_risk_flags: list[str] = field(default_factory=list)
    comparable_transfers: list[ComparableTransfer] = field(default_factory=list)
    narrative: str = ""
    model_version: str = "v1.0"
