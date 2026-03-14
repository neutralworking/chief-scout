/**
 * Transfer Valuation Engine — TypeScript port.
 *
 * 3-layer valuation: Ability → Market Value → Result
 * Uses Box-Muller transform for Monte Carlo (no numpy needed).
 */

import {
  AGE_CURVES,
  BAND_WIDTH_MULTIPLIERS,
  CONFIDENCE_NOISE_SCALE,
  CONFIDENCE_WEIGHTS,
  CONTRACT_MULTIPLIERS,
  DISAGREEMENT_THRESHOLD_STDEV,
  LAMBDA_MODES,
  LEAGUE_STRENGTH,
  LOW_OBSERVABILITY_ATTRIBUTES,
  MODEL_ATTRIBUTES,
  MONTE_CARLO_SAMPLES,
  POSITION_SCARCITY,
  POSITIONAL_ARCHETYPE_TIERS,
  RISK_TAGS,
  SOURCE_PRIORITY,
  VALUE_TAGS,
} from "./config";
import type {
  AttributeGrade,
  ConfidenceLevel,
  ConfidenceState,
  GradeType,
  MarketValue,
  PlayerProfile,
  ValuationMode,
  ValuationResult,
} from "./types";

// ── Random number generation (Box-Muller) ──────────────────────────────────

function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ── Data loading ────────────────────────────────────────────────────────────

interface RawGradeRow {
  attribute: string;
  scout_grade: number | null;
  stat_score: number | null;
  source: string | null;
  is_inferred: boolean | null;
}

function processGrades(rows: RawGradeRow[]): {
  attributes: Record<string, AttributeGrade>;
  archetype_scores: Record<string, number>;
} {
  // Group by attribute, pick best source
  const best: Record<string, RawGradeRow & { _priority: number }> = {};
  for (const g of rows) {
    const attr = g.attribute.toLowerCase().replace(/ /g, "_");
    const priority = SOURCE_PRIORITY[g.source ?? ""] ?? 0;
    if (!best[attr] || priority > best[attr]._priority) {
      best[attr] = { ...g, attribute: attr, _priority: priority };
    }
  }

  const attributes: Record<string, AttributeGrade> = {};
  for (const [attr, g] of Object.entries(best)) {
    let effective: number;
    let gradeType: GradeType;

    if (g.scout_grade != null && g.scout_grade > 0) {
      effective = Math.min(g.scout_grade / 2, 10.0);
      gradeType = "scout";
    } else if (g.stat_score != null && g.stat_score > 0) {
      effective = Math.min(g.stat_score / 2, 10.0);
      gradeType = "stat";
    } else {
      effective = 5.0;
      gradeType = "inferred";
    }

    if (g.is_inferred || g.source === "eafc_inferred") {
      gradeType = "inferred";
    }

    let confidence: ConfidenceLevel = "low";
    if (gradeType === "scout" && g.source === "scout_assessment") {
      confidence = "high";
    } else if (gradeType !== "inferred") {
      confidence = LOW_OBSERVABILITY_ATTRIBUTES.has(attr) ? "medium" : "medium";
      if (g.source === "fbref" || g.source === "statsbomb") confidence = "medium";
    }

    attributes[attr] = { effective_grade: effective, grade_type: gradeType, confidence, stale: false };
  }

  // Compute archetype scores
  const archetype_scores: Record<string, number> = {};
  for (const [model, modelAttrs] of Object.entries(MODEL_ATTRIBUTES)) {
    const values: number[] = [];
    for (const attr of modelAttrs) {
      const grade = attributes[attr];
      if (grade) values.push(grade.effective_grade);
    }
    if (values.length > 0) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      archetype_scores[model] = Math.min(Math.round(mean * 100) / 10, 100);
    }
  }

  return { attributes, archetype_scores };
}

function estimateContractYears(tag: string | null): number {
  const map: Record<string, number> = {
    "Long-Term": 4.0, "Extension Talks": 3.0,
    "One Year Left": 1.0, "Six Months": 0.5, "Expired": 0.0,
  };
  return map[tag ?? "One Year Left"] ?? 2.0;
}

// ── Layer 1: Ability Estimation ───────────────────────────────────────────

function computeConfidenceState(profile: PlayerProfile): ConfidenceState {
  const grades = Object.values(profile.attributes);
  if (grades.length === 0) return "very_low";

  const highPct = grades.filter((g) => g.confidence === "high").length / grades.length;
  const lowPct = grades.filter((g) => g.confidence === "low").length / grades.length;
  const inferredPct = grades.filter((g) => g.grade_type === "inferred").length / grades.length;

  if (highPct >= 0.7 && inferredPct < 0.1) return "high";
  if (lowPct >= 0.5 || inferredPct >= 0.4) return inferredPct >= 0.6 ? "very_low" : "low";
  return "medium";
}

function estimateAbility(profile: PlayerProfile): {
  central: number;
  std: number;
  samples: number[];
  confidence_state: ConfidenceState;
} {
  const confidenceState = computeConfidenceState(profile);
  const samples: number[] = [];

  for (let i = 0; i < MONTE_CARLO_SAMPLES; i++) {
    // Perturb archetype scores
    const perturbed: Record<string, number> = {};
    for (const [model, score] of Object.entries(profile.archetype_scores)) {
      const modelAttrs = MODEL_ATTRIBUTES[model] ?? [];
      const noiseScales: number[] = [];
      for (const attr of modelAttrs) {
        const g = profile.attributes[attr];
        const conf = g?.confidence ?? "low";
        noiseScales.push(CONFIDENCE_NOISE_SCALE[conf] ?? 0.30);
      }
      const avgNoise = noiseScales.length > 0
        ? noiseScales.reduce((a, b) => a + b, 0) / noiseScales.length
        : 0.30;
      const noise = gaussianRandom() * score * avgNoise;
      perturbed[model] = Math.max(0, Math.min(100, score + noise));
    }

    // Compute positionally-weighted ability
    const pos = profile.position ?? "CM";
    const tiers = POSITIONAL_ARCHETYPE_TIERS[pos] ?? {};
    let weightedSum = 0;
    let weightTotal = 0;
    for (const [arch, weight] of Object.entries(tiers)) {
      weightedSum += (perturbed[arch] ?? 0) * weight;
      weightTotal += weight;
    }
    samples.push(weightTotal > 0 ? weightedSum / weightTotal : 50);
  }

  samples.sort((a, b) => a - b);
  const central = samples[Math.floor(samples.length / 2)];
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
  const std = Math.sqrt(variance);

  return { central, std, samples, confidence_state: confidenceState };
}

// ── Layer 2: Market Value ────────────────────────────────────────────────

function abilityToBaseValue(ability: number): number {
  if (ability < 30) return 100_000;
  if (ability < 40) return 100_000 + (ability - 30) * 40_000;
  if (ability < 50) return 500_000 + (ability - 40) * 100_000;
  if (ability < 60) return 1_500_000 + (ability - 50) * 350_000;
  if (ability < 70) return 5_000_000 + (ability - 60) * 1_000_000;
  if (ability < 80) return 15_000_000 + (ability - 70) * 3_500_000;
  if (ability < 90) return 50_000_000 + (ability - 80) * 7_000_000;
  return 120_000_000 + (ability - 90) * 15_000_000;
}

function levelToBaseValue(level: number): number {
  if (level < 65) return 0.1;
  if (level < 70) return 0.5 + (level - 65) * 0.3;
  if (level < 75) return 2.0 + (level - 70) * 0.6;
  if (level < 80) return 5.0 + (level - 75) * 2.0;
  if (level < 85) return 15.0 + (level - 80) * 6.0;
  if (level < 90) return 45.0 + (level - 85) * 15.0;
  return 120.0 + (level - 90) * 25.0;
}

function computeAgeMultiplier(age: number | null, position: string | null): number {
  if (age == null) return 1.0;
  const curve = AGE_CURVES[position ?? "CM"] ?? AGE_CURVES.CM;

  if (age >= curve.peak_start && age <= curve.peak_end) return 1.0;
  if (age < curve.peak_start) {
    if (age <= 16) return 0.45;
    if (age <= curve.youth_premium_peak) {
      const t = (age - 16) / (curve.youth_premium_peak - 16);
      return 0.45 + t * 0.75;
    }
    const t = (age - curve.youth_premium_peak) / Math.max(curve.peak_start - curve.youth_premium_peak, 1);
    return 1.20 - t * 0.20;
  }
  const yearsPast = age - curve.peak_end;
  return Math.max(0.05, Math.exp(-curve.decline_rate * yearsPast));
}

function computeContractMultiplier(years: number | null): number {
  if (years == null) return 0.80;
  const breakpoints = Object.keys(CONTRACT_MULTIPLIERS).map(Number).sort((a, b) => a - b);
  if (years <= breakpoints[0]) return CONTRACT_MULTIPLIERS[breakpoints[0]];
  if (years >= breakpoints[breakpoints.length - 1]) return CONTRACT_MULTIPLIERS[breakpoints[breakpoints.length - 1]];
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const lo = breakpoints[i], hi = breakpoints[i + 1];
    if (years >= lo && years <= hi) {
      const t = (years - lo) / (hi - lo);
      return CONTRACT_MULTIPLIERS[lo] + t * (CONTRACT_MULTIPLIERS[hi] - CONTRACT_MULTIPLIERS[lo]);
    }
  }
  return 1.0;
}

function computePersonalityAdjustment(profile: PlayerProfile): number {
  let adj = 0;
  for (const tag of profile.personality_tags) {
    if (tag in RISK_TAGS) adj += RISK_TAGS[tag];
    else if (tag in VALUE_TAGS) adj += VALUE_TAGS[tag];
  }
  const tags = new Set(profile.personality_tags);
  if (tags.has("High Exit Probability") && tags.has("Contract Sensitive")) adj -= 0.03;
  return 1.0 + adj;
}

function estimateMarketValue(
  profile: PlayerProfile,
  ability: ReturnType<typeof estimateAbility>,
  mode: ValuationMode,
): {
  market_value: MarketValue;
  scout_value: number;
  data_value: number;
  personality_mult: number;
  band_width_ratio: number;
  decomposition: {
    scout_profile_pct: number;
    performance_data_pct: number;
    contract_age_pct: number;
    market_context_pct: number;
    personality_adj_pct: number;
  };
} {
  const lam = LAMBDA_MODES[mode] ?? 0.7;
  const baseValue = abilityToBaseValue(ability.central);
  const ageMult = computeAgeMultiplier(profile.age, profile.position);
  const contractMult = computeContractMultiplier(profile.contract_years_remaining);
  const scarcityMult = POSITION_SCARCITY[profile.position ?? "CM"] ?? 1.0;
  const leagueMult = LEAGUE_STRENGTH[profile.league ?? "default"] ?? LEAGUE_STRENGTH.default;
  const personalityMult = computePersonalityAdjustment(profile);

  const scoutValue = baseValue * ageMult * contractMult * scarcityMult * leagueMult * personalityMult;

  let dataValue = scoutValue;
  if (profile.level != null) {
    const levelBase = levelToBaseValue(profile.level);
    dataValue = levelBase * 1_000_000 * ageMult * contractMult * scarcityMult * leagueMult;
  }
  if (profile.transfer_fee_eur && profile.transfer_fee_eur > 0) {
    dataValue = dataValue * 0.6 + profile.transfer_fee_eur * 0.4;
  }

  // Blend
  const central = lam * scoutValue + (1 - lam) * dataValue;

  // Monte Carlo quantiles
  const bandMult = BAND_WIDTH_MULTIPLIERS[ability.confidence_state] ?? 1.8;
  const valueSamples: number[] = [];
  for (const abilitySample of ability.samples) {
    const sBase = abilityToBaseValue(abilitySample);
    const sVal = sBase * ageMult * contractMult * scarcityMult * leagueMult * personalityMult;
    valueSamples.push(lam * sVal + (1 - lam) * dataValue);
  }
  valueSamples.sort((a, b) => a - b);

  const median = valueSamples[Math.floor(valueSamples.length / 2)];
  const vMean = valueSamples.reduce((a, b) => a + b, 0) / valueSamples.length;
  const vVar = valueSamples.reduce((s, v) => s + (v - vMean) ** 2, 0) / valueSamples.length;
  const std = Math.sqrt(vVar) * bandMult;

  let p10 = Math.max(0, Math.round(median - 1.28 * std));
  let p25 = Math.max(0, Math.round(median - 0.67 * std));
  const p50 = Math.round(median);
  let p75 = Math.round(median + 0.67 * std);
  let p90 = Math.round(median + 1.28 * std);
  p10 = Math.min(p10, p50);
  p25 = Math.min(Math.max(p25, p10), p50);
  p75 = Math.max(p75, p50);
  p90 = Math.max(p90, p75);

  // Decomposition
  const safeLog = (x: number) => Math.abs(Math.log(Math.max(x, 0.001)));
  const totalMod = Math.max(
    safeLog(ageMult) + safeLog(contractMult) + safeLog(scarcityMult) + safeLog(leagueMult) + safeLog(personalityMult),
    0.01,
  );
  const scoutPct = lam * 100;
  const dataPct = (1 - lam) * 100;
  const contractAgePct = (safeLog(ageMult) + safeLog(contractMult)) / totalMod * dataPct;
  const marketPct = (safeLog(scarcityMult) + safeLog(leagueMult)) / totalMod * dataPct;
  const persAdjPct = safeLog(personalityMult) / totalMod * dataPct;

  return {
    market_value: { central: p50, p10, p25, p75, p90 },
    scout_value: Math.round(scoutValue),
    data_value: Math.round(dataValue),
    personality_mult: personalityMult,
    band_width_ratio: p90 / Math.max(p10, 1),
    decomposition: {
      scout_profile_pct: Math.round(scoutPct * 10) / 10,
      performance_data_pct: Math.round((dataPct - contractAgePct - marketPct - persAdjPct) * 10) / 10,
      contract_age_pct: Math.round(contractAgePct * 10) / 10,
      market_context_pct: Math.round(marketPct * 10) / 10,
      personality_adj_pct: Math.round((personalityMult - 1.0) * 1000) / 10,
    },
  };
}

// ── Narrative ────────────────────────────────────────────────────────────

function formatEur(value: number): string {
  if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}bn`;
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return `€${value.toLocaleString()}`;
}

function generateNarrative(
  profile: PlayerProfile,
  mv: MarketValue,
  personalityMult: number,
): string {
  const parts: string[] = [];

  parts.push(`Valued at ${formatEur(mv.central)} (band: ${formatEur(mv.p10)}–${formatEur(mv.p90)}).`);

  // Primary/secondary archetype
  const sorted = Object.entries(profile.archetype_scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length >= 2) {
    const [primary, pScore] = sorted[0];
    const [secondary, sScore] = sorted[1];
    parts.push(`Driven by a ${primary}-${secondary} profile (${Math.round(pScore)}/${Math.round(sScore)}).`);
  }

  // Age context
  if (profile.age != null) {
    const phase = profile.age <= 21 ? "supports high-potential upside"
      : profile.age <= 24 ? "supports a rising pre-peak valuation"
      : profile.age <= 29 ? "supports a near-peak valuation"
      : profile.age <= 31 ? "indicates early decline"
      : "reflects a late-career profile";
    const contractStr = profile.contract_years_remaining != null
      ? ` with ${Math.round(profile.contract_years_remaining)}yr remaining`
      : "";
    parts.push(`At ${profile.age}${contractStr}, the age-contract profile ${phase}.`);
  }

  // Personality
  const adjPct = (personalityMult - 1.0) * 100;
  if (Math.abs(adjPct) > 1) {
    const riskTags = profile.personality_tags.filter((t) => t in RISK_TAGS);
    const valueTags = profile.personality_tags.filter((t) => t in VALUE_TAGS);
    if (adjPct < 0 && riskTags.length > 0) {
      parts.push(`Personality risk tags (${riskTags.join(", ")}) apply a ${adjPct.toFixed(0)}% discount.`);
    } else if (adjPct > 0 && valueTags.length > 0) {
      parts.push(`Personality value tags (${valueTags.join(", ")}) apply a +${adjPct.toFixed(0)}% premium.`);
    }
  }

  return parts.join(" ");
}

// ── Full Valuation Pipeline ─────────────────────────────────────────────

export function runValuation(profile: PlayerProfile, mode: ValuationMode): ValuationResult {
  const ability = estimateAbility(profile);
  const market = estimateMarketValue(profile, ability, mode);

  // Confidence
  const dataCoverage = (() => {
    const total = 48;
    const available = Object.values(profile.attributes).filter(
      (g) => g.grade_type === "scout" || g.grade_type === "stat",
    ).length;
    return Math.min(1.0, available / total);
  })();

  const profConfidence = (() => {
    if (Object.keys(profile.attributes).length === 0) return 0.3;
    const scores = Object.values(profile.attributes).map(
      (g) => CONFIDENCE_WEIGHTS[g.confidence] ?? 0.3,
    );
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  })();

  let overallConf = "medium";
  if (ability.confidence_state === "high" && dataCoverage > 0.7) overallConf = "high";
  else if (ability.confidence_state === "low" || ability.confidence_state === "very_low" || dataCoverage < 0.3) overallConf = "low";

  const personalityRisks = profile.personality_tags.filter((t) => t in RISK_TAGS);
  const narrative = generateNarrative(profile, market.market_value, market.personality_mult);

  return {
    person_id: profile.person_id,
    name: profile.name,
    position: profile.position,
    age: profile.age,
    market_value: market.market_value,
    decomposition: market.decomposition,
    confidence: {
      profile_confidence: Math.round(profConfidence * 1000) / 1000,
      data_coverage: Math.round(dataCoverage * 1000) / 1000,
      overall_confidence: overallConf,
      band_width_ratio: Math.round(market.band_width_ratio * 100) / 100,
    },
    personality_risk_flags: personalityRisks,
    narrative,
    mode,
  };
}

// ── Data loader (from Supabase query results) ────────────────────────────

export interface SupabasePlayerData {
  person: {
    id: number;
    name: string;
    date_of_birth: string | null;
    height_cm: number | null;
    preferred_foot: string | null;
    club_id: number | null;
    club_name: string | null;
    league: string | null;
  };
  profile: {
    position: string | null;
    level: number | null;
    profile_tier: number | null;
  } | null;
  personality: {
    ei: number | null;
    sn: number | null;
    tf: number | null;
    jp: number | null;
  } | null;
  market: {
    transfer_fee_eur: number | null;
  } | null;
  status: {
    contract_tag: string | null;
  } | null;
  grades: RawGradeRow[];
  trajectory: string | null;
  tags: string[];
}

export function buildPlayerProfile(data: SupabasePlayerData): PlayerProfile {
  // Compute age
  let age: number | null = null;
  if (data.person.date_of_birth) {
    const dob = new Date(data.person.date_of_birth);
    const today = new Date();
    age = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())
    ) {
      age--;
    }
  }

  // Personality code
  let personalityCode: string | null = null;
  if (data.personality) {
    const p = data.personality;
    if (p.ei != null || p.sn != null || p.tf != null || p.jp != null) {
      personalityCode =
        ((p.ei ?? 0) >= 50 ? "A" : "I") +
        ((p.sn ?? 0) >= 50 ? "X" : "N") +
        ((p.tf ?? 0) >= 50 ? "S" : "L") +
        ((p.jp ?? 0) >= 50 ? "C" : "P");
    }
  }

  const { attributes, archetype_scores } = processGrades(data.grades);

  // Separate tags
  const riskTagSet = new Set(Object.keys(RISK_TAGS));
  const valueTagSet = new Set(Object.keys(VALUE_TAGS));
  const personalityTags = data.tags.filter((t) => riskTagSet.has(t) || valueTagSet.has(t));

  return {
    person_id: data.person.id,
    name: data.person.name,
    age,
    position: data.profile?.position ?? null,
    archetype_scores,
    attributes,
    personality_code: personalityCode,
    personality_tags: personalityTags,
    playing_style_tags: data.tags.filter((t) => !riskTagSet.has(t) && !valueTagSet.has(t)),
    contract_years_remaining: estimateContractYears(data.status?.contract_tag ?? null),
    contract_tag: data.status?.contract_tag ?? null,
    transfer_fee_eur: data.market?.transfer_fee_eur ?? null,
    league: data.person.league,
    club: data.person.club_name,
    club_id: data.person.club_id,
    trajectory: data.trajectory,
    level: data.profile?.level ?? null,
    profile_tier: data.profile?.profile_tier ?? null,
  };
}
