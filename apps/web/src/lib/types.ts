export interface PlayerCard {
  person_id: number;
  name: string;
  dob: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
  active: boolean;
  nation: string | null;
  club: string | null;
  position: string | null;
  level: number | null;
  archetype: string | null;
  model_id: string | null;
  profile_tier: number | null;
  personality_type: string | null;
  pursuit_status: string | null;
  market_value_tier: string | null;
  true_mvt: string | null;
  market_value_eur: number | null;
  director_valuation_meur: number | null;
  // Engine valuation (joined from player_valuations)
  engine_value_p50: number | null;
  engine_confidence: string | null;
  // Radar fingerprint: [DEF, CRE, ATK, PWR, PAC, DRV] for outfield, [STP, CMD, SWP, DST] for GK
  fingerprint?: number[] | null;
}

export interface PlayerValuation {
  id: number;
  person_id: number;
  market_value_p10: number | null;
  market_value_p25: number | null;
  market_value_p50: number | null;
  market_value_p75: number | null;
  market_value_p90: number | null;
  use_value_central: number | null;
  contextual_fit_score: number | null;
  system_archetype_fit: number | null;
  system_threshold_fit: number | null;
  system_personality_fit: number | null;
  system_tag_compatibility: number | null;
  squad_gap_fill: number | null;
  scout_profile_pct: number | null;
  performance_data_pct: number | null;
  contract_age_pct: number | null;
  market_context_pct: number | null;
  personality_adj_pct: number | null;
  style_fit_adj_pct: number | null;
  profile_confidence: number | null;
  data_coverage: number | null;
  overall_confidence: string | null;
  band_width_ratio: number | null;
  disagreement_flag: boolean;
  scout_anchored_value: number | null;
  data_implied_value: number | null;
  divergent_features: string[] | null;
  disagreement_narrative: string | null;
  stale_profile: boolean;
  low_data_warning: boolean;
  personality_risk_flags: string[] | null;
  style_risk_flags: string[] | null;
  mode: string | null;
  target_position: string | null;
  target_system: string | null;
  model_version: string | null;
  narrative: string | null;
  evaluated_at: string | null;
}

export type Position =
  | "GK"
  | "WD"
  | "CD"
  | "DM"
  | "CM"
  | "WM"
  | "AM"
  | "WF"
  | "CF";

export type PursuitStatus =
  | "Priority"
  | "Interested"
  | "Scout Further"
  | "Watch"
  | "Monitor"
  | "Pass";

export const POSITIONS: Position[] = [
  "GK",
  "CD",
  "WD",
  "DM",
  "CM",
  "WM",
  "AM",
  "WF",
  "CF",
];

export const PURSUIT_STATUSES: PursuitStatus[] = [
  "Priority",
  "Interested",
  "Scout Further",
  "Watch",
  "Monitor",
  "Pass",
];

export const PURSUIT_COLORS: Record<string, string> = {
  Priority: "bg-pursuit-priority text-white",
  Interested: "bg-pursuit-interested text-black",
  "Scout Further": "bg-pursuit-scout text-black",
  Watch: "bg-pursuit-watch text-white",
  Monitor: "bg-pursuit-monitor text-white",
  Pass: "bg-pursuit-pass text-white",
};

export const POSITION_COLORS: Record<string, string> = {
  GK: "bg-amber-700/60",
  CD: "bg-blue-700/60",
  WD: "bg-blue-600/60",
  DM: "bg-green-700/60",
  CM: "bg-green-600/60",
  WM: "bg-green-500/60",
  AM: "bg-purple-600/60",
  WF: "bg-red-600/60",
  CF: "bg-red-700/60",
};

export function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
