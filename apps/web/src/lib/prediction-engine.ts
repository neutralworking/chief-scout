/**
 * Prediction Engine — Dixon-Coles Poisson model for match score prediction.
 *
 * Converts team strength (power_rating for clubs, fifa_points for nations)
 * into expected goals, then uses Poisson distribution to compute:
 *   - Most likely scoreline
 *   - Win/Draw/Loss probabilities
 *   - Expected goals per team
 *   - Confidence rating
 *
 * Pure functions — no DB calls. Accepts strength inputs, returns predictions.
 * Reusable by Punter's Pad downstream.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PredictionInput {
  homePower: number; // 0-100 (club_ratings.power_rating or nation strength)
  awayPower: number;
  competitionType: "domestic" | "continental" | "international";
  /** Override league average goals per team (default ~1.35) */
  leagueAvgGoals?: number;
  /** Override home advantage factor (default varies by competition type) */
  homeAdvantage?: number;
  /** Data confidence 0-1 (from club_ratings.confidence or heuristic) */
  confidence?: number;
}

export interface ScoreProbability {
  home: number;
  away: number;
  prob: number;
}

export interface PredictionResult {
  /** Most likely scoreline */
  scoreline: { home: number; away: number };
  /** Expected goals */
  homeXG: number;
  awayXG: number;
  /** Win/Draw/Loss probabilities (0-1) */
  homeWinProb: number;
  drawProb: number;
  awayWinProb: number;
  /** Prediction confidence 0-1 */
  confidence: number;
  /** Top 10 most likely exact scores */
  topScores: ScoreProbability[];
  /** Full score probability matrix [home 0-6][away 0-6] */
  scoreMatrix: number[][];
}

// ── Constants ────────────────────────────────────────────────────────────────

/** Average goals per team per match (across top 5 European leagues ~1.35) */
const DEFAULT_AVG_GOALS = 1.35;

/** Home advantage multiplier by competition type */
const HOME_ADVANTAGE: Record<string, number> = {
  domestic: 1.18, // strong home effect in league play
  continental: 1.10, // reduced in CL/EL (bigger away performances)
  international: 1.08, // minimal in internationals (neutral venues common)
};

/** Maximum goals to compute in Poisson matrix */
const MAX_GOALS = 7;

// ── Poisson math ─────────────────────────────────────────────────────────────

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/** P(X = k) for Poisson distribution with rate lambda */
function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

/**
 * Dixon-Coles correction for low scores (0-0, 1-0, 0-1, 1-1).
 * Adjusts joint probability to better model defensive football.
 * rho typically in [-0.1, 0.0] — negative means fewer low-low draws than Poisson predicts.
 */
function dixonColesCorrection(
  homeGoals: number,
  awayGoals: number,
  homeLambda: number,
  awayLambda: number,
  rho: number,
): number {
  if (homeGoals === 0 && awayGoals === 0) {
    return 1 - homeLambda * awayLambda * rho;
  }
  if (homeGoals === 0 && awayGoals === 1) {
    return 1 + homeLambda * rho;
  }
  if (homeGoals === 1 && awayGoals === 0) {
    return 1 + awayLambda * rho;
  }
  if (homeGoals === 1 && awayGoals === 1) {
    return 1 - rho;
  }
  return 1;
}

// ── Core prediction ──────────────────────────────────────────────────────────

/**
 * Convert power rating (0-100) to expected goals (lambda).
 *
 * A team at the league average (power 50) scores ~avgGoals per match.
 * The power differential stretches or compresses this:
 *   - Power 70 vs 50 → higher lambda for 70, lower for 50
 *   - Uses exponential scaling so edges are meaningful but not absurd
 */
function powerToLambda(
  teamPower: number,
  opponentPower: number,
  avgGoals: number,
  isHome: boolean,
  homeAdv: number,
): number {
  // Clamp power to valid range
  const tp = Math.max(5, Math.min(95, teamPower));
  const op = Math.max(5, Math.min(95, opponentPower));

  // Attack strength: how much better than average this team is
  const attackStrength = tp / 50;
  // Defense weakness: inverse of opponent's defensive capability
  const defenseWeakness = (100 - op) / 50;

  // Geometric mean of attack and defensive factors, centered on avgGoals
  let lambda = avgGoals * Math.sqrt(attackStrength * defenseWeakness);

  // Apply home advantage
  if (isHome) {
    lambda *= homeAdv;
  }

  // Clamp to reasonable range (0.2 - 4.0 goals)
  return Math.max(0.2, Math.min(4.0, lambda));
}

/**
 * Compute match prediction from team strengths.
 */
export function predictMatch(input: PredictionInput): PredictionResult {
  const avgGoals = input.leagueAvgGoals ?? DEFAULT_AVG_GOALS;
  const homeAdv =
    input.homeAdvantage ?? HOME_ADVANTAGE[input.competitionType] ?? 1.15;
  const rho = -0.04; // Dixon-Coles correlation parameter

  // Compute expected goals
  const homeLambda = powerToLambda(
    input.homePower,
    input.awayPower,
    avgGoals,
    true,
    homeAdv,
  );
  const awayLambda = powerToLambda(
    input.awayPower,
    input.homePower,
    avgGoals,
    false,
    1.0,
  );

  // Build score probability matrix
  const matrix: number[][] = [];
  const scores: ScoreProbability[] = [];
  let totalProb = 0;

  for (let h = 0; h < MAX_GOALS; h++) {
    matrix[h] = [];
    for (let a = 0; a < MAX_GOALS; a++) {
      const pHome = poissonPmf(h, homeLambda);
      const pAway = poissonPmf(a, awayLambda);
      const dcCorr = dixonColesCorrection(h, a, homeLambda, awayLambda, rho);
      const prob = pHome * pAway * dcCorr;
      matrix[h][a] = prob;
      totalProb += prob;
      scores.push({ home: h, away: a, prob });
    }
  }

  // Normalize (should be ~1.0 but correct for truncation)
  for (let h = 0; h < MAX_GOALS; h++) {
    for (let a = 0; a < MAX_GOALS; a++) {
      matrix[h][a] /= totalProb;
    }
  }
  for (const s of scores) {
    s.prob /= totalProb;
  }

  // Sort by probability descending
  scores.sort((a, b) => b.prob - a.prob);

  // Compute W/D/L
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  for (let h = 0; h < MAX_GOALS; h++) {
    for (let a = 0; a < MAX_GOALS; a++) {
      if (h > a) homeWin += matrix[h][a];
      else if (h === a) draw += matrix[h][a];
      else awayWin += matrix[h][a];
    }
  }

  // Confidence: blend of input confidence and model fit
  const dataConfidence = input.confidence ?? 0.5;
  // Reduce confidence when teams are very close (harder to predict)
  const powerDiff = Math.abs(input.homePower - input.awayPower);
  const predictionClarity = Math.min(1, powerDiff / 40);
  const confidence = dataConfidence * 0.6 + predictionClarity * 0.4;

  return {
    scoreline: { home: scores[0].home, away: scores[0].away },
    homeXG: Math.round(homeLambda * 100) / 100,
    awayXG: Math.round(awayLambda * 100) / 100,
    homeWinProb: Math.round(homeWin * 1000) / 1000,
    drawProb: Math.round(draw * 1000) / 1000,
    awayWinProb: Math.round(awayWin * 1000) / 1000,
    confidence: Math.round(confidence * 100) / 100,
    topScores: scores.slice(0, 10).map((s) => ({
      ...s,
      prob: Math.round(s.prob * 1000) / 1000,
    })),
    scoreMatrix: matrix.map((row) =>
      row.map((p) => Math.round(p * 10000) / 10000),
    ),
  };
}

// ── Helpers for API layer ────────────────────────────────────────────────────

/** Strip premium fields for free tier */
export function freeTierPrediction(result: PredictionResult) {
  return {
    scoreline: result.scoreline,
    homeWinProb: result.homeWinProb,
    drawProb: result.drawProb,
    awayWinProb: result.awayWinProb,
  };
}

/** Full prediction for premium tier */
export function premiumPrediction(result: PredictionResult) {
  return {
    ...result,
  };
}

/**
 * Convert FIFA points to a 0-100 power scale for international matches.
 * FIFA points typically range from ~800 (weakest) to ~1900 (strongest).
 */
export function fifaPointsToPower(points: number): number {
  const MIN_POINTS = 800;
  const MAX_POINTS = 1900;
  const clamped = Math.max(MIN_POINTS, Math.min(MAX_POINTS, points));
  return ((clamped - MIN_POINTS) / (MAX_POINTS - MIN_POINTS)) * 80 + 10;
}

/**
 * Estimate power from squad strength (otp_ideal_squads.strength).
 * Already 0-100 so minimal transformation needed.
 */
export function squadStrengthToPower(strength: number): number {
  return Math.max(10, Math.min(90, strength));
}
