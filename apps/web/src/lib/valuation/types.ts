/**
 * Core data types for the valuation engine.
 * TypeScript port of valuation_core/types.py
 */

export type GradeType = "scout" | "stat" | "inferred";
export type ConfidenceLevel = "high" | "medium" | "low";
export type ValuationMode = "scout_dominant" | "balanced" | "data_dominant";
export type ConfidenceState = "high" | "medium" | "low" | "very_low";

export interface AttributeGrade {
  effective_grade: number; // 0-10
  grade_type: GradeType;
  confidence: ConfidenceLevel;
  stale: boolean;
}

export interface PlayerProfile {
  person_id: number;
  name: string;
  age: number | null;
  position: string | null;
  archetype_scores: Record<string, number>;
  attributes: Record<string, AttributeGrade>;
  personality_code: string | null;
  personality_tags: string[];
  playing_style_tags: string[];
  contract_years_remaining: number | null;
  contract_tag: string | null;
  transfer_fee_eur: number | null;
  league: string | null;
  club: string | null;
  club_id: number | null;
  trajectory: string | null;
  level: number | null;
  profile_tier: number | null;
}

export interface MarketValue {
  central: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
}

export interface Decomposition {
  scout_profile_pct: number;
  performance_data_pct: number;
  contract_age_pct: number;
  market_context_pct: number;
  personality_adj_pct: number;
}

export interface ConfidenceReport {
  profile_confidence: number;
  data_coverage: number;
  overall_confidence: string;
  band_width_ratio: number;
}

export interface ValuationResult {
  person_id: number;
  name: string;
  position: string | null;
  age: number | null;
  market_value: MarketValue;
  decomposition: Decomposition;
  confidence: ConfidenceReport;
  personality_risk_flags: string[];
  narrative: string;
  mode: ValuationMode;
}
