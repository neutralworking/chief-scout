"""
Pydantic models for the valuation API.

Maps to the TypeScript types in client_sdk/types.ts.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ClubContextSchema(BaseModel):
    club_id: Optional[int] = None
    club_name: Optional[str] = None
    league: Optional[str] = None
    league_tier: Optional[int] = None
    financial_tier: Optional[str] = None
    objective: Optional[str] = None
    selling_pressure: Optional[float] = None


class SquadGapSchema(BaseModel):
    position: str
    archetype_gaps: dict[str, float] = {}
    personality_gaps: list[str] = []
    style_tag_gaps: list[str] = []


class EvaluationContextSchema(BaseModel):
    buying_club: ClubContextSchema
    target_position: str
    target_system: str
    squad_gaps: list[SquadGapSchema] = []
    window: str = "summer"
    selling_club: Optional[ClubContextSchema] = None


class ValuationRequestSchema(BaseModel):
    player_id: int
    evaluation_context: Optional[EvaluationContextSchema] = None
    mode: str = "scout_dominant"
    scout_confidence_override: Optional[float] = None
    model_version: str = "v1.0"


class BatchValuationRequestSchema(BaseModel):
    requests: list[ValuationRequestSchema] = Field(max_length=50)


class MarketValueSchema(BaseModel):
    central: int
    p10: int
    p25: int
    p75: int
    p90: int
    currency: str = "EUR"


class ContextualFitBreakdownSchema(BaseModel):
    system_archetype_fit: float
    system_threshold_fit: float
    system_personality_fit: float
    system_tag_compatibility: float
    squad_gap_fill: float


class UseValueSchema(BaseModel):
    central: int
    contextual_fit_score: float
    contextual_fit_breakdown: ContextualFitBreakdownSchema


class DecompositionSchema(BaseModel):
    scout_profile_contribution: float
    performance_data_contribution: float
    contract_age_contribution: float
    market_context_contribution: float
    personality_adjustment: float
    playing_style_fit_adjustment: float


class ConfidenceSchema(BaseModel):
    profile_confidence: float
    data_coverage: float
    overall_confidence: str
    band_width_ratio: float


class DisagreementSchema(BaseModel):
    scout_anchored_value: int
    data_implied_value: int
    divergent_features: list[str]
    narrative: str


class ComparableTransferSchema(BaseModel):
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


class FlagsSchema(BaseModel):
    disagreement_flag: bool = False
    scout_data_delta: Optional[DisagreementSchema] = None
    stale_profile: bool = False
    low_data_warning: bool = False
    personality_risk_flags: list[str] = []
    playing_style_risk_flags: list[str] = []


class ValuationResponseSchema(BaseModel):
    market_value: MarketValueSchema
    use_value: Optional[UseValueSchema] = None
    decomposition: DecompositionSchema
    confidence: ConfidenceSchema
    flags: FlagsSchema
    comparable_transfers: list[ComparableTransferSchema] = []
    narrative: str = ""
    model_version: str = "v1.0"


class SimulationRequestSchema(BaseModel):
    player_id: int
    changes: dict = {}  # key: field name, value: new value
    evaluation_context: Optional[EvaluationContextSchema] = None
    mode: str = "scout_dominant"
