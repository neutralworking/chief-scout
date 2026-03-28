export type Lens = "match" | "replacement";

export interface SimilarityFactors {
  role_match: number;
  role_score_proximity: number;
  archetype_alignment: number;
  pillar_shape: number;
  trait_overlap: number;
  physical_profile: number;
  personality_match: number;
  grade_profile: number;
  quality_band: number;
  club_diversity: number;
}

export type FactorName = keyof SimilarityFactors;

export const FACTOR_NAMES: FactorName[] = [
  "role_match",
  "role_score_proximity",
  "archetype_alignment",
  "pillar_shape",
  "trait_overlap",
  "physical_profile",
  "personality_match",
  "grade_profile",
  "quality_band",
  "club_diversity",
];

export interface SimilarityResult {
  player: PlayerCandidate;
  similarity: number;
  confidence: "strong" | "partial" | "indicative";
  populated_factors: number;
  factors: SimilarityFactors;
  match_reasons: string[];
}

export interface PlayerCandidate {
  person_id: number;
  name: string;
  position: string | null;
  level: number | null;
  peak: number | null;
  archetype: string | null;
  earned_archetype: string | null;
  best_role: string | null;
  best_role_score: number | null;
  technical_score: number | null;
  tactical_score: number | null;
  mental_score: number | null;
  physical_score: number | null;
  personality_type: string | null;
  preferred_foot: string | null;
  side: string | null;
  height_cm: number | null;
  club: string | null;
  club_id: number | null;
  nation: string | null;
  image_url: string | null;
  overall: number | null;
  active: boolean;
}

export const MATCH_WEIGHTS: Record<FactorName, number> = {
  role_match: 10,
  role_score_proximity: 5,
  archetype_alignment: 20,
  pillar_shape: 15,
  trait_overlap: 15,
  physical_profile: 10,
  personality_match: 10,
  grade_profile: 10,
  quality_band: 0,
  club_diversity: 5,
};

export const REPLACEMENT_WEIGHTS: Record<FactorName, number> = {
  role_match: 25,
  role_score_proximity: 15,
  archetype_alignment: 10,
  pillar_shape: 10,
  trait_overlap: 5,
  physical_profile: 15,
  personality_match: 0,
  grade_profile: 10,
  quality_band: 5,
  club_diversity: 5,
};

export const ADJACENT_POSITIONS: Record<string, string[]> = {
  GK: ["GK"],
  WD: ["WD", "WM"],
  CD: ["CD", "DM"],
  DM: ["DM", "CM", "CD"],
  CM: ["CM", "DM", "AM"],
  WM: ["WM", "WD", "WF"],
  AM: ["AM", "CM", "WF", "CF"],
  WF: ["WF", "WM", "AM", "CF"],
  CF: ["CF", "AM", "WF"],
};
