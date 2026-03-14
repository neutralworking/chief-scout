/**
 * Formation Intelligence — Role-aware player scoring for formation slots.
 *
 * Maps tactical roles (from tactical_roles table) to football intelligence:
 * archetype preferences, personality fit, position demands, key attributes,
 * and historical references for UI tooltips.
 *
 * Personality codes use the Chief Scout football-native system:
 *   A/I (Analytical/Instinctive), X/N (Extrinsic/Intrinsic),
 *   S/L (Soloist/Leader), C/P (Competitor/Composer)
 *
 * Archetypes use the 13 playing models from SACROSANCT.
 */

export interface RoleIntelligence {
  /** Archetype preferences ordered by fit (best first) */
  archetypes: string[];
  /** Personality type preferences ordered by fit (best first) */
  personalities: string[];
  /** Minimum level threshold — below this incurs a penalty */
  minLevel: number;
  /** Preferred position codes */
  positions: string[];
  /** Key attributes to weight (future use when attribute data is available) */
  keyAttributes?: string[];
  /** Historical reference for UI tooltip */
  reference: string;
}

/**
 * Role intelligence mapping keyed by tactical role name (as stored in tactical_roles.name).
 * Each entry encodes what makes a player suited to that specific role.
 */
export const ROLE_INTELLIGENCE: Record<string, RoleIntelligence> = {
  // ── GK ──────────────────────────────────────────────────────────────────
  "Sweeper Keeper": {
    archetypes: ["GK", "Passer", "Controller"],
    personalities: ["ANSP", "ANLP", "ANSC"],
    minLevel: 12,
    positions: ["GK"],
    keyAttributes: ["Footwork", "Pass Range", "Composure", "Anticipation"],
    reference: "The Neuer role — sweeper-keeper who commands the high line and distributes",
  },
  "Shot Stopper": {
    archetypes: ["GK", "Cover"],
    personalities: ["INSC", "ANSC", "AXSC"],
    minLevel: 12,
    positions: ["GK"],
    keyAttributes: ["Reactions", "Handling", "Agility", "Positioning"],
    reference: "The Courtois role — traditional keeper, shot-stopping specialist",
  },

  // ── CD ──────────────────────────────────────────────────────────────────
  "Ball-Playing CB": {
    archetypes: ["Cover", "Passer", "Controller"],
    personalities: ["ANLC", "ANLP", "INLC"],
    minLevel: 12,
    positions: ["CD"],
    keyAttributes: ["Pass Range", "Composure", "Positioning", "Interceptions"],
    reference: "The Beckenbauer role — builds from the back with progressive passing",
  },
  "Stopper": {
    archetypes: ["Destroyer", "Powerhouse", "Target"],
    personalities: ["ANSC", "INSC", "AXSC"],
    minLevel: 11,
    positions: ["CD"],
    keyAttributes: ["Tackling", "Heading", "Aggression", "Marking"],
    reference: "The Vidic role — front-foot aggression, wins every duel",
  },
  "Sweeper": {
    archetypes: ["Cover", "Controller"],
    personalities: ["ANLP", "ANSP", "INLP"],
    minLevel: 13,
    positions: ["CD"],
    keyAttributes: ["Awareness", "Positioning", "Anticipation", "Interceptions"],
    reference: "The Baresi role — reads danger before it develops, covers space intelligently",
  },

  // ── WD ──────────────────────────────────────────────────────────────────
  "Inverted Full-Back": {
    archetypes: ["Controller", "Passer", "Engine"],
    personalities: ["ANSP", "ANLP", "INSP"],
    minLevel: 12,
    positions: ["WD"],
    keyAttributes: ["Pass Accuracy", "Composure", "Decisions", "Positioning"],
    reference: "The Cancelo role — tucks inside in possession, creates midfield overloads",
  },
  "Overlapping Full-Back": {
    archetypes: ["Sprinter", "Engine", "Passer"],
    personalities: ["AXSC", "ANSC", "INSC"],
    minLevel: 11,
    positions: ["WD"],
    keyAttributes: ["Pace", "Crossing", "Stamina", "Acceleration"],
    reference: "The Cafu role — bombs forward, delivers crosses, recovers with pace",
  },
  "Wing-Back": {
    archetypes: ["Engine", "Dribbler", "Sprinter"],
    personalities: ["ANSC", "INSC", "AXSC"],
    minLevel: 12,
    positions: ["WD", "WM"],
    keyAttributes: ["Stamina", "Pace", "Crossing", "Tackling"],
    reference: "The Hakimi role — full width in both phases, tireless up and down the flank",
  },

  // ── DM ──────────────────────────────────────────────────────────────────
  "Regista": {
    archetypes: ["Controller", "Passer", "Creator"],
    personalities: ["INSP", "ANLP", "ANSP"],
    minLevel: 13,
    positions: ["DM", "CM"],
    keyAttributes: ["Tempo", "Vision", "Pass Range", "Composure"],
    reference: "The Pirlo role — deep-lying orchestrator who dictates the tempo of the game",
  },
  "Anchor": {
    archetypes: ["Cover", "Destroyer", "Controller"],
    personalities: ["ANSC", "ANLC", "INSC"],
    minLevel: 12,
    positions: ["DM"],
    keyAttributes: ["Positioning", "Discipline", "Interceptions", "Awareness"],
    reference: "The Busquets role — positional discipline, shields the back four invisibly",
  },
  "Ball-Winner": {
    archetypes: ["Destroyer", "Engine", "Powerhouse"],
    personalities: ["AXSC", "ANSC", "INSC"],
    minLevel: 11,
    positions: ["DM", "CM"],
    keyAttributes: ["Tackling", "Stamina", "Pressing", "Aggression"],
    reference: "The Kante role — aggressive pressing, disrupts play, covers every blade of grass",
  },

  // ── CM ──────────────────────────────────────────────────────────────────
  "Mezzala": {
    archetypes: ["Dribbler", "Engine", "Striker"],
    personalities: ["IXSP", "IXSC", "INSP"],
    minLevel: 12,
    positions: ["CM"],
    keyAttributes: ["Carries", "Movement", "Take-ons", "Stamina"],
    reference: "The Barella role — half-space runner who arrives in the box with intent",
  },
  "Box-to-Box": {
    archetypes: ["Engine", "Destroyer", "Powerhouse"],
    personalities: ["ANSC", "INSC", "ANLC"],
    minLevel: 12,
    positions: ["CM"],
    keyAttributes: ["Stamina", "Tackling", "Pass Accuracy", "Intensity"],
    reference: "The Lampard role — covers both penalty areas, contributes at both ends",
  },
  "Deep Playmaker": {
    archetypes: ["Controller", "Passer", "Creator"],
    personalities: ["ANLP", "INSP", "ANSP"],
    minLevel: 13,
    positions: ["CM", "DM"],
    keyAttributes: ["Tempo", "Pass Range", "Vision", "Composure"],
    reference: "The Xavi role — receives deep, orchestrates possession with metronomic passing",
  },

  // ── WM ──────────────────────────────────────────────────────────────────
  "Wide Playmaker": {
    archetypes: ["Creator", "Passer", "Dribbler"],
    personalities: ["INSP", "IXSP", "IXLP"],
    minLevel: 12,
    positions: ["WM", "AM"],
    keyAttributes: ["Vision", "Creativity", "Pass Accuracy", "First Touch"],
    reference: "The Silva role — drifts inside from wide, creates from half-spaces",
  },
  "Traditional Winger": {
    archetypes: ["Sprinter", "Dribbler", "Passer"],
    personalities: ["IXSC", "AXSC", "IXSP"],
    minLevel: 11,
    positions: ["WM", "WF"],
    keyAttributes: ["Pace", "Crossing", "Take-ons", "Acceleration"],
    reference: "The Beckham role — hugs the touchline, delivers precision crosses",
  },

  // ── AM ──────────────────────────────────────────────────────────────────
  "Trequartista": {
    archetypes: ["Creator", "Dribbler", "Controller"],
    personalities: ["IXSP", "INSP", "IXLP"],
    minLevel: 14,
    positions: ["AM"],
    keyAttributes: ["Creativity", "Unpredictability", "Vision", "Guile"],
    reference: "The Zidane role — free-roaming artist, unpredictable and unplayable on his day",
  },
  "Advanced Playmaker": {
    archetypes: ["Controller", "Creator", "Passer"],
    personalities: ["INSP", "ANLP", "IXSP"],
    minLevel: 13,
    positions: ["AM", "CM"],
    keyAttributes: ["Vision", "Decisions", "Pass Accuracy", "Composure"],
    reference: "The De Bruyne role — links midfield to attack, controls the final third",
  },
  "Shadow Striker": {
    archetypes: ["Sprinter", "Striker", "Engine"],
    personalities: ["INSC", "IXSC", "AXSC"],
    minLevel: 12,
    positions: ["AM", "CF"],
    keyAttributes: ["Movement", "Pace", "Short Range", "Acceleration"],
    reference: "The Muller role — late runs into the box, always finds space between the lines",
  },

  // ── WF ──────────────────────────────────────────────────────────────────
  "Inside Forward": {
    archetypes: ["Striker", "Dribbler", "Sprinter"],
    personalities: ["IXSP", "IXSC", "INSP"],
    minLevel: 13,
    positions: ["WF", "WM"],
    keyAttributes: ["Short Range", "Take-ons", "Pace", "First Touch"],
    reference: "The Salah role — cuts inside on opposite foot, lethal finisher from wide",
  },
  "Inverted Winger": {
    archetypes: ["Creator", "Dribbler", "Passer"],
    personalities: ["INSP", "IXSP", "IXLP"],
    minLevel: 12,
    positions: ["WF", "WM"],
    keyAttributes: ["Vision", "Creativity", "Take-ons", "Through Balls"],
    reference: "The Bernardo Silva role — creates from inside, vision and technique over pace",
  },
  "Wide Forward": {
    archetypes: ["Sprinter", "Striker", "Dribbler"],
    personalities: ["AXSC", "IXSC", "INSC"],
    minLevel: 12,
    positions: ["WF"],
    keyAttributes: ["Pace", "Acceleration", "Movement", "Short Range"],
    reference: "The Mbappe role — stretches the defense, devastating pace in behind",
  },

  // ── CF ──────────────────────────────────────────────────────────────────
  "Target Man": {
    archetypes: ["Target", "Powerhouse", "Striker"],
    personalities: ["INLC", "AXLC", "ANLC"],
    minLevel: 12,
    positions: ["CF"],
    keyAttributes: ["Heading", "Aerial Duels", "Shielding", "Jumping"],
    reference: "The Giroud role — holds up play, wins aerial duels, brings others into the game",
  },
  "Poacher": {
    archetypes: ["Striker", "Sprinter"],
    personalities: ["INSC", "IXSC", "AXSC"],
    minLevel: 13,
    positions: ["CF"],
    keyAttributes: ["Short Range", "Movement", "Penalties", "Reactions"],
    reference: "The Inzaghi role — lives on the shoulder, clinical finishing inside the box",
  },
  "False 9": {
    archetypes: ["Creator", "Controller", "Dribbler"],
    personalities: ["IXSP", "INSP", "IXLP"],
    minLevel: 14,
    positions: ["CF", "AM"],
    keyAttributes: ["Vision", "Creativity", "First Touch", "Guile"],
    reference: "The Messi role — drops deep, links play, creates space for runners",
  },
  "Complete Forward": {
    archetypes: ["Engine", "Striker", "Target"],
    personalities: ["ANLC", "INLC", "ANSC"],
    minLevel: 14,
    positions: ["CF"],
    keyAttributes: ["Stamina", "Short Range", "Heading", "Movement"],
    reference: "The Benzema role — does everything, all-round threat across all phases",
  },
};

/**
 * Score a player for a given tactical role using football intelligence.
 *
 * Scoring breakdown:
 * - Base: player level (0-20)
 * - Archetype fit: +120 (primary), +80 (secondary), +40 (tertiary)
 * - Personality fit: +60 (primary), +40 (secondary), +20 (tertiary)
 * - Position exactness: +30 if position matches role's preferred positions
 * - Level threshold: -50 penalty if below role's minimum level
 */
export function scorePlayerForRole(
  player: {
    level: number | null;
    archetype: string | null;
    personality_type: string | null;
    position: string | null;
  },
  roleName: string
): number {
  const intel = ROLE_INTELLIGENCE[roleName];
  let score = player.level ?? 0;

  if (!intel) return score;

  // Archetype fit (graduated: best match = +120, second = +80, third = +40)
  if (player.archetype && intel.archetypes.length > 0) {
    const idx = intel.archetypes.indexOf(player.archetype);
    if (idx === 0) score += 120;
    else if (idx === 1) score += 80;
    else if (idx === 2) score += 40;
  }

  // Personality fit (graduated: best match = +60, second = +40, third = +20)
  if (player.personality_type && intel.personalities.length > 0) {
    const idx = intel.personalities.indexOf(player.personality_type);
    if (idx === 0) score += 60;
    else if (idx === 1) score += 40;
    else if (idx === 2) score += 20;
  }

  // Position exactness bonus
  if (player.position && intel.positions.includes(player.position)) {
    score += 30;
  }

  // Level threshold penalty
  if (intel.minLevel && (player.level ?? 0) < intel.minLevel) {
    score -= 50;
  }

  return score;
}

/**
 * Get the historical reference string for a tactical role.
 * Returns null if the role has no intelligence mapping.
 */
export function getRoleReference(roleName: string): string | null {
  return ROLE_INTELLIGENCE[roleName]?.reference ?? null;
}
