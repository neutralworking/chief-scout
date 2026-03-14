/**
 * Chief Scout Transfer Valuation Engine — TypeScript Types
 *
 * These types match the Python Pydantic schemas in valuation_api/schemas.py
 * and the spec's API contracts.
 */

// ── Request Types ────────────────────────────────────────────────────────────

export interface ClubContext {
  club_id?: number;
  club_name?: string;
  league?: string;
  league_tier?: number; // 1=Top 5, 2=6-10, etc.
  financial_tier?: "elite" | "high" | "medium" | "low";
  objective?: "survival" | "mid_table" | "europe" | "title";
  selling_pressure?: number; // 0-1
}

export interface SquadGap {
  position: string;
  archetype_gaps?: Record<string, number>;
  personality_gaps?: string[];
  style_tag_gaps?: string[];
}

export type TacticalStyle =
  | "gegenpress"
  | "tiki_taka"
  | "counter_attacking"
  | "wing_play"
  | "catenaccio"
  | "total_football";

export interface EvaluationContext {
  buying_club: ClubContext;
  target_position: string;
  target_system: TacticalStyle;
  squad_gaps?: SquadGap[];
  window?: "summer" | "winter" | "out_of_window";
  selling_club?: ClubContext;
}

export interface ValuationRequest {
  player_id: number;
  evaluation_context?: EvaluationContext;
  mode?: "scout_dominant" | "balanced" | "data_dominant";
  scout_confidence_override?: number;
  model_version?: string;
}

export interface BatchValuationRequest {
  requests: ValuationRequest[];
}

export interface SimulationRequest {
  player_id: number;
  changes: Record<string, unknown>;
  evaluation_context?: EvaluationContext;
  mode?: "scout_dominant" | "balanced" | "data_dominant";
}

// ── Response Types ───────────────────────────────────────────────────────────

export interface MarketValue {
  central: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  currency: "EUR";
}

export interface ContextualFitBreakdown {
  system_archetype_fit: number;
  system_threshold_fit: number;
  system_personality_fit: number;
  system_tag_compatibility: number;
  squad_gap_fill: number;
}

export interface UseValue {
  central: number;
  contextual_fit_score: number;
  contextual_fit_breakdown: ContextualFitBreakdown;
}

export interface Decomposition {
  scout_profile_contribution: number;
  performance_data_contribution: number;
  contract_age_contribution: number;
  market_context_contribution: number;
  personality_adjustment: number;
  playing_style_fit_adjustment: number;
}

export interface Confidence {
  profile_confidence: number;
  data_coverage: number;
  overall_confidence: "high" | "medium" | "low";
  band_width_ratio: number;
}

export interface DisagreementReport {
  scout_anchored_value: number;
  data_implied_value: number;
  divergent_features: string[];
  narrative: string;
}

export interface Flags {
  disagreement_flag: boolean;
  scout_data_delta?: DisagreementReport;
  stale_profile: boolean;
  low_data_warning: boolean;
  personality_risk_flags: string[];
  playing_style_risk_flags: string[];
}

export interface ComparableTransfer {
  player_name: string;
  person_id?: number;
  from_club?: string;
  to_club?: string;
  fee_eur?: number;
  transfer_date?: string;
  age_at_transfer?: number;
  position?: string;
  archetype?: string;
  similarity_score: number;
}

export interface ValuationResponse {
  market_value: MarketValue;
  use_value?: UseValue;
  decomposition: Decomposition;
  confidence: Confidence;
  flags: Flags;
  comparable_transfers: ComparableTransfer[];
  narrative: string;
  model_version: string;
}
