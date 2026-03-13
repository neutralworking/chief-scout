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
