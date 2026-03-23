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
  "Libero GK": {
    archetypes: ["GK", "Passer", "Controller"],
    personalities: ["ANSP", "ANLP", "INSP"],
    minLevel: 12,
    positions: ["GK"],
    keyAttributes: ["Pass Range", "Composure", "Footwork", "Anticipation"],
    reference: "The Ederson role — distribution specialist who starts attacks from the back",
  },
  "Sweeper Keeper": {
    archetypes: ["GK", "Passer", "Controller"],
    personalities: ["ANSP", "ANLP", "ANSC"],
    minLevel: 12,
    positions: ["GK"],
    keyAttributes: ["Footwork", "Pass Range", "Composure", "Anticipation"],
    reference: "The Neuer role — sweeper-keeper who commands the high line and distributes",
  },
  "Comandante": {
    archetypes: ["GK", "Commander", "Cover", "Controller"],
    personalities: ["ANLC", "INLC", "ANSC"],
    minLevel: 12,
    positions: ["GK"],
    keyAttributes: ["Communication", "Leadership", "Handling", "Positioning"],
    reference: "The Buffon / Casillas role — commands the area, marshals the defence, leads by presence",
  },
  "Shotstopper": {
    archetypes: ["GK", "Target", "Cover"],
    personalities: ["INSC", "ANSC", "AXSC"],
    minLevel: 12,
    positions: ["GK"],
    keyAttributes: ["Reactions", "Handling", "Agility", "Positioning"],
    reference: "The Courtois role — traditional keeper, shot-stopping specialist",
  },

  // ── CD ──────────────────────────────────────────────────────────────────
  "Libero": {
    archetypes: ["Passer", "Cover", "Controller"],
    personalities: ["ANLC", "ANLP", "INLC"],
    minLevel: 13,
    positions: ["CD"],
    keyAttributes: ["Pass Range", "Composure", "Positioning", "Awareness"],
    reference: "The Beckenbauer role — ball-playing CB who steps into midfield to build attacks",
  },
  "Sweeper": {
    archetypes: ["Cover", "Controller"],
    personalities: ["ANLP", "ANSP", "INLP"],
    minLevel: 13,
    positions: ["CD"],
    keyAttributes: ["Awareness", "Positioning", "Anticipation", "Interceptions"],
    reference: "The Baresi role — reads danger before it develops, covers space intelligently",
  },
  "Zagueiro": {
    archetypes: ["Commander", "Destroyer", "Cover"],
    personalities: ["ANLC", "INLC", "ANSC"],
    minLevel: 12,
    positions: ["CD"],
    keyAttributes: ["Leadership", "Tackling", "Heading", "Communication"],
    reference: "The Thiago Silva role — commanding CB who leads by example and organises the backline",
  },
  "Vorstopper": {
    archetypes: ["Powerhouse", "Destroyer", "Cover"],
    personalities: ["ANSC", "INSC", "AXSC"],
    minLevel: 11,
    positions: ["CD"],
    keyAttributes: ["Tackling", "Aggression", "Heading", "Marking"],
    reference: "The Chiellini role — aggressive front stopper who presses high and dominates duels",
  },

  // ── WD ──────────────────────────────────────────────────────────────────
  "Lateral": {
    archetypes: ["Passer", "Dribbler", "Engine"],
    personalities: ["AXSC", "ANSC", "IXSC"],
    minLevel: 11,
    positions: ["WD"],
    keyAttributes: ["Pace", "Crossing", "Stamina", "Take-ons"],
    reference: "The Cafu / TAA role — attacking full-back who delivers from the final third",
  },
  "Fluidificante": {
    archetypes: ["Engine", "Cover", "Sprinter"],
    personalities: ["ANSC", "INSC", "AXSC"],
    minLevel: 11,
    positions: ["WD"],
    keyAttributes: ["Stamina", "Pace", "Tackling", "Acceleration"],
    reference: "The Zanetti / Hakimi role — tireless lane runner covering the entire flank",
  },
  "Invertido": {
    archetypes: ["Controller", "Passer", "Cover"],
    personalities: ["ANSP", "ANLP", "INSP"],
    minLevel: 12,
    positions: ["WD"],
    keyAttributes: ["Pass Accuracy", "Composure", "Decisions", "Positioning"],
    reference: "The Lahm / Cancelo role — inverted full-back who tucks inside to control midfield",
  },
  "Corredor": {
    archetypes: ["Sprinter", "Engine", "Cover"],
    personalities: ["AXSC", "INSC", "ANSC"],
    minLevel: 11,
    positions: ["WD"],
    keyAttributes: ["Pace", "Acceleration", "Stamina", "Tackling"],
    reference: "The Walker / Davies role — explosive pace fullback who covers ground in transition",
  },

  // ── DM ──────────────────────────────────────────────────────────────────
  "Regista": {
    archetypes: ["Passer", "Controller", "Creator"],
    personalities: ["INSP", "ANLP", "ANSP"],
    minLevel: 13,
    positions: ["DM", "CM"],
    keyAttributes: ["Tempo", "Vision", "Pass Range", "Composure"],
    reference: "The Pirlo role — deep-lying orchestrator who dictates the tempo of the game",
  },
  "Sentinelle": {
    archetypes: ["Cover", "Destroyer", "Controller"],
    personalities: ["ANSC", "ANLC", "INSC"],
    minLevel: 12,
    positions: ["DM"],
    keyAttributes: ["Positioning", "Discipline", "Interceptions", "Awareness"],
    reference: "The Makélélé role — shields the defence, breaks up play, guards the gate",
  },
  "Pivote": {
    archetypes: ["Controller", "Cover", "Passer", "Commander"],
    personalities: ["ANLP", "ANSP", "ANLC"],
    minLevel: 13,
    positions: ["DM"],
    keyAttributes: ["Positioning", "Awareness", "Pass Accuracy", "Composure"],
    reference: "The Busquets / Rodri role — midfield brain who organizes shape and reads everything",
  },
  "Volante": {
    archetypes: ["Powerhouse", "Destroyer", "Engine"],
    personalities: ["AXSC", "ANSC", "INSC"],
    minLevel: 11,
    positions: ["DM"],
    keyAttributes: ["Tackling", "Stamina", "Aggression", "Carries"],
    reference: "The Gattuso / Kanté role — high-energy ball-winner who drives forward after recovering",
  },

  // ── CM ──────────────────────────────────────────────────────────────────
  "Mezzala": {
    archetypes: ["Passer", "Creator", "Dribbler"],
    personalities: ["IXSP", "IXSC", "INSP"],
    minLevel: 12,
    positions: ["CM"],
    keyAttributes: ["Carries", "Movement", "Take-ons", "Stamina"],
    reference: "The Barella role — half-space runner who arrives in the box with intent",
  },
  "Tuttocampista": {
    archetypes: ["Engine", "Cover", "Destroyer"],
    personalities: ["ANSC", "INSC", "ANLC"],
    minLevel: 12,
    positions: ["CM"],
    keyAttributes: ["Stamina", "Tackling", "Short Range", "Pass Accuracy"],
    reference: "The Lampard / Gerrard role — all-pitch midfielder who tackles, passes, scores, and leads",
  },
  "Metodista": {
    archetypes: ["Controller", "Passer", "Creator"],
    personalities: ["ANLP", "INSP", "ANSP"],
    minLevel: 13,
    positions: ["CM"],
    keyAttributes: ["Tempo", "Pass Accuracy", "Vision", "Composure"],
    reference: "The Xavi / Kroos role — methodical conductor who controls the rhythm with intelligent passing",
  },
  "Relayeur": {
    archetypes: ["Sprinter", "Engine", "Passer"],
    personalities: ["ANSC", "INSC", "AXSC"],
    minLevel: 12,
    positions: ["CM"],
    keyAttributes: ["Stamina", "Tackling", "Carries", "Pace"],
    reference: "The Valverde role — tireless shuttle who links defence to attack at pace",
  },

  // ── WM ──────────────────────────────────────────────────────────────────
  "Winger": {
    archetypes: ["Dribbler", "Passer", "Sprinter"],
    personalities: ["IXSC", "AXSC", "IXSP"],
    minLevel: 11,
    positions: ["WM"],
    keyAttributes: ["Pace", "Crossing", "Take-ons", "Acceleration"],
    reference: "The Garrincha / Figo role — beats defenders with pace and trickery on the touchline",
  },
  "Tornante": {
    archetypes: ["Engine", "Cover", "Sprinter", "Destroyer"],
    personalities: ["ANSC", "INSC", "AXSC"],
    minLevel: 11,
    positions: ["WM"],
    keyAttributes: ["Stamina", "Tackling", "Pace", "Crossing"],
    reference: "The Moses / Kostic role — selfless wide midfielder who covers the full flank in both phases",
  },
  "False Winger": {
    archetypes: ["Controller", "Cover", "Passer", "Dribbler"],
    personalities: ["ANSP", "INSP", "ANLP"],
    minLevel: 13,
    positions: ["WM"],
    keyAttributes: ["Decisions", "Composure", "Pass Accuracy", "Movement"],
    reference: "The Bernardo Silva / Foden role — starts wide, drifts inside to create overloads intelligently",
  },
  "Shuttler": {
    archetypes: ["Sprinter", "Engine", "Dribbler", "Cover"],
    personalities: ["AXSC", "IXSC", "ANSC"],
    minLevel: 11,
    positions: ["WM"],
    keyAttributes: ["Pace", "Stamina", "Acceleration", "Take-ons"],
    reference: "The Sterling / Sané role — raw pace and stamina to cover the flank end to end",
  },

  // ── AM ──────────────────────────────────────────────────────────────────
  "Trequartista": {
    archetypes: ["Dribbler", "Creator", "Controller"],
    personalities: ["IXSP", "INSP", "IXLP"],
    minLevel: 14,
    positions: ["AM"],
    keyAttributes: ["Creativity", "Unpredictability", "Vision", "Guile"],
    reference: "The Zidane role — free-roaming artist, unpredictable and unplayable on his day",
  },
  "Seconda Punta": {
    archetypes: ["Engine", "Striker", "Sprinter"],
    personalities: ["IXSP", "INSC", "IXSC"],
    minLevel: 12,
    positions: ["AM"],
    keyAttributes: ["Movement", "Take-ons", "Short Range", "Creativity"],
    reference: "The Del Piero / Griezmann role — drops deep to link play, then arrives in the box to finish",
  },
  "Enganche": {
    archetypes: ["Controller", "Creator", "Passer"],
    personalities: ["INSP", "IXSP", "ANLP"],
    minLevel: 14,
    positions: ["AM"],
    keyAttributes: ["Vision", "Creativity", "Composure", "Guile"],
    reference: "The Riquelme role — the hook, sees everything, threads passes others cannot imagine",
  },
  "Boxcrasher": {
    archetypes: ["Sprinter", "Striker", "Engine", "Dribbler"],
    personalities: ["AXSC", "INSC", "IXSC"],
    minLevel: 12,
    positions: ["AM"],
    keyAttributes: ["Movement", "Pace", "Short Range", "Stamina"],
    reference: "The Havertz / Bruno Fernandes role — dynamic AM who arrives in the box with pace and power",
  },

  // ── WF ──────────────────────────────────────────────────────────────────
  "Inside Forward": {
    archetypes: ["Dribbler", "Sprinter", "Striker"],
    personalities: ["IXSP", "IXSC", "INSP"],
    minLevel: 13,
    positions: ["WF", "WM"],
    keyAttributes: ["Short Range", "Take-ons", "Pace", "First Touch"],
    reference: "The Salah role — cuts inside on opposite foot, lethal finisher from wide",
  },
  "Raumdeuter": {
    archetypes: ["Engine", "Striker", "Cover"],
    personalities: ["ANLC", "INSC", "ANSC"],
    minLevel: 13,
    positions: ["WF"],
    keyAttributes: ["Anticipation", "Movement", "Positioning", "Awareness"],
    reference: "The Muller role — reads space before it opens, arrives in the box with perfect timing",
  },
  "Inventor": {
    archetypes: ["Creator", "Dribbler", "Passer", "Sprinter"],
    personalities: ["INSP", "IXSP", "IXLP"],
    minLevel: 13,
    positions: ["WF"],
    keyAttributes: ["Creativity", "Vision", "Take-ons", "Through Balls"],
    reference: "The Grealish / Neymar role — creates something from nothing with vision from wide",
  },
  "Extremo": {
    archetypes: ["Sprinter", "Striker", "Dribbler"],
    personalities: ["AXSC", "IXSC", "INSC"],
    minLevel: 12,
    positions: ["WF"],
    keyAttributes: ["Pace", "Acceleration", "Short Range", "Movement"],
    reference: "The Henry / Mbappé role — devastating wide forward who scores from wide areas with electric pace",
  },

  // ── CF ──────────────────────────────────────────────────────────────────
  "Poacher": {
    archetypes: ["Striker", "Dribbler", "Sprinter"],
    personalities: ["ANSC", "INSC", "IXSC"],
    minLevel: 13,
    positions: ["CF"],
    keyAttributes: ["Short Range", "Movement", "Penalties", "Reactions"],
    reference: "The Inzaghi role — lives on the shoulder, clinical finishing inside the box",
  },
  "Spearhead": {
    archetypes: ["Engine", "Destroyer", "Striker", "Sprinter"],
    personalities: ["ANSC", "INSC", "AXSC"],
    minLevel: 12,
    positions: ["CF"],
    keyAttributes: ["Pressing", "Stamina", "Intensity", "Movement"],
    reference: "The Vardy / Suárez role — leads the press from the front with relentless work rate",
  },
  "Falso Nove": {
    archetypes: ["Creator", "Controller", "Dribbler"],
    personalities: ["IXSP", "INSP", "IXLP"],
    minLevel: 14,
    positions: ["CF", "AM"],
    keyAttributes: ["Vision", "Creativity", "First Touch", "Guile"],
    reference: "The Messi 2009 / Firmino role — false nine who drops deep and pulls CBs out of position",
  },
  "Prima Punta": {
    archetypes: ["Target", "Powerhouse", "Striker"],
    personalities: ["INLC", "AXLC", "ANLC"],
    minLevel: 12,
    positions: ["CF"],
    keyAttributes: ["Heading", "Hold-up", "Strength", "Aerial Duels"],
    reference: "The Toni / Giroud role — target striker who wins aerial duels and brings others into play",
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

// ── Formation Blueprints ──────────────────────────────────────────────────────
// Each formation has a defining team/manager and specific role assignments
// with blueprint players. When a formation has a blueprint, it overrides the
// generic role cycling with historically-informed role + archetype combos.

export interface SlotBlueprint {
  /** Tactical role name (must match ROLE_INTELLIGENCE keys) */
  role: string;
  /** The archetype player for this specific slot in this specific formation */
  blueprint: string;
  /** Short description of what this slot demands in this system */
  demand: string;
}

export interface FormationBlueprint {
  /** The defining manager and team */
  definedBy: string;
  /** One-line tactical philosophy */
  philosophy: string;
  /** Era / years this formation was iconic */
  era: string;
  /** Ordered slot blueprints by position (GK first, CF last) */
  slots: Record<string, SlotBlueprint[]>;
}

/**
 * Formation blueprints keyed by formation name (matching formations.name in DB).
 * Each blueprint defines the archetypal team and specific role demands per slot.
 *
 * Not every formation needs one — historical/obscure formations use generic roles.
 * These are the formations where a specific team/system defined the archetype.
 */
export const FORMATION_BLUEPRINTS: Record<string, FormationBlueprint> = {
  "4-3-3": {
    definedBy: "Guardiola's Barcelona (2008–12)",
    philosophy: "Positional play — third-man combinations, half-space overloads, suffocating press on loss",
    era: "2008–2012",
    slots: {
      GK: [{ role: "Sweeper Keeper", blueprint: "Valdés", demand: "Comfortable receiving under pressure, distributes to CBs" }],
      CD: [
        { role: "Ball-Playing CB", blueprint: "Piqué", demand: "Progressive passer, steps into midfield in build-up" },
        { role: "Ball-Playing CB", blueprint: "Puyol", demand: "Aggressive cover, wins the ball back high" },
      ],
      WD: [
        { role: "Inverted Full-Back", blueprint: "Dani Alves", demand: "Overlaps AND inverts — creates 3v2 in half-spaces" },
        { role: "Overlapping Full-Back", blueprint: "Abidal", demand: "Width in possession, tucks narrow defensively" },
      ],
      DM: [{ role: "Regista", blueprint: "Busquets", demand: "The pivot — receives between the lines, sets the tempo, never loses it" }],
      CM: [
        { role: "Deep Playmaker", blueprint: "Xavi", demand: "Metronomic passing, positional discipline, receives on the half-turn" },
        { role: "Mezzala", blueprint: "Iniesta", demand: "Carries into the final third, unpredictable, arrives in the box" },
      ],
      WF: [
        { role: "Inside Forward", blueprint: "Messi", demand: "Cuts inside from the right, finishes or creates — the system's apex" },
        { role: "Traditional Winger", blueprint: "Henry/Villa", demand: "Stretches the defence wide left, runs in behind, clinical finishing" },
      ],
      CF: [{ role: "Falso Nove", blueprint: "Messi (2011)", demand: "Drops deep, drags CBs out, creates space for runners" }],
    },
  },

  "4-4-2": {
    definedBy: "Ferguson's Manchester United (1996–2001)",
    philosophy: "Width, pace, direct transitions — get it wide, get it in, score from crosses and counters",
    era: "1996–2001",
    slots: {
      GK: [{ role: "Shot Stopper", blueprint: "Schmeichel", demand: "Commands the box, distributes quickly, big-game presence" }],
      CD: [
        { role: "Stopper", blueprint: "Stam", demand: "Front-foot aggression, wins aerial duels, physically dominant" },
        { role: "Ball-Playing CB", blueprint: "Johnsen", demand: "Reads the game, covers, comfortable on the ball" },
      ],
      WD: [
        { role: "Overlapping Full-Back", blueprint: "Gary Neville", demand: "Overlaps the winger, delivers crosses, tracks back relentlessly" },
        { role: "Overlapping Full-Back", blueprint: "Irwin", demand: "Metronomic crossing, set-piece delivery, defensive solidity" },
      ],
      CM: [
        { role: "Box-to-Box", blueprint: "Keane", demand: "Covers every blade of grass, tackles, drives forward, demands standards" },
        { role: "Deep Playmaker", blueprint: "Scholes", demand: "Switches play, long-range passing, arrives late in the box" },
      ],
      WM: [
        { role: "Wide Provider", blueprint: "Beckham", demand: "Hugs the right touchline, delivers crosses, set-piece specialist, vision from wide" },
        { role: "Direct Winger", blueprint: "Giggs", demand: "Beats full-backs 1v1, dribbles past men, stretches play, direct and unpredictable" },
      ],
      CF: [
        { role: "Poacher", blueprint: "Solskjær", demand: "Lives on the shoulder, clinical inside the six-yard box, fox in the box" },
        { role: "Complete Forward", blueprint: "Cole/Yorke", demand: "Link play, movement, pressing — interchangeable with the partner" },
      ],
    },
  },

  "3-5-2": {
    definedBy: "Conte's Juventus / Chelsea (2011–17)",
    philosophy: "Defensive solidity, explosive wing-backs, vertical through the middle",
    era: "2011–2017",
    slots: {
      GK: [{ role: "Shot Stopper", blueprint: "Buffon", demand: "Commands the back three, vocal organiser, shot-stopping specialist" }],
      CD: [
        { role: "Ball-Playing CB", blueprint: "Bonucci", demand: "Long diagonal switches, steps out with the ball, quarterback from deep" },
        { role: "Stopper", blueprint: "Barzagli", demand: "Tight marking, recovery pace, aggressive in the duel" },
        { role: "Sweeper", blueprint: "Chiellini", demand: "Last-ditch defending, reads danger, sweeps behind the line" },
      ],
      CM: [
        { role: "Box-to-Box", blueprint: "Vidal", demand: "Arrives in the box, tackles in his own, relentless motor" },
        { role: "Regista", blueprint: "Pirlo", demand: "Deep-lying orchestrator — the system flows through him" },
      ],
      WM: [
        { role: "Wing-Back", blueprint: "Lichsteiner", demand: "Tireless up and down the right, aggressive in both phases" },
        { role: "Wing-Back", blueprint: "Asamoah/Alonso", demand: "Provides width on the left, crosses and defensive cover" },
      ],
      AM: [{ role: "Trequartista", blueprint: "Pogba", demand: "Drives forward from deep, arrives in the box, unpredictable creative force" }],
      CF: [
        { role: "Prima Punta", blueprint: "Llorente/Mandzukic", demand: "Holds it up, wins aerial duels, brings others into play" },
        { role: "Poacher", blueprint: "Tévez", demand: "Runs in behind, presses from the front, clinical finisher" },
      ],
    },
  },

  "4-2-3-1": {
    definedBy: "Klopp's Dortmund / Mourinho's Real Madrid",
    philosophy: "Gegenpressing + vertical transitions — win it, play it forward, go",
    era: "2010–2014",
    slots: {
      GK: [{ role: "Sweeper Keeper", blueprint: "Weidenfeller / Casillas", demand: "Quick distribution to start counters, sweeps behind the high line" }],
      CD: [
        { role: "Ball-Playing CB", blueprint: "Hummels / Ramos", demand: "Progressive passing from deep, comfortable under pressure" },
        { role: "Stopper", blueprint: "Subotic / Pepe", demand: "Aggressive, front-foot defending, wins duels in transition" },
      ],
      WD: [
        { role: "Overlapping Full-Back", blueprint: "Piszczek / Carvajal", demand: "Overlaps, delivers, recovers — the modern full-back" },
        { role: "Overlapping Full-Back", blueprint: "Schmelzer / Marcelo", demand: "Width on the left, crosses, supports the winger" },
      ],
      DM: [
        { role: "Ball-Winner", blueprint: "Bender / Khedira", demand: "Wins the ball, triggers the press, simple forward passes" },
        { role: "Anchor", blueprint: "Gündogan / Xabi Alonso", demand: "Dictates tempo when possession is established, shields the back line" },
      ],
      WF: [
        { role: "Inside Forward", blueprint: "Reus / Di María", demand: "Cuts inside at speed, arrives in the box, creates chances from half-spaces" },
        { role: "Inside Forward", blueprint: "Kuba / Ronaldo", demand: "Direct running, takes on full-backs, lethal in transition" },
      ],
      AM: [{ role: "Advanced Playmaker", blueprint: "Götze / Özil", demand: "Links midfield to attack, finds the killer pass, intelligent movement" }],
      CF: [{ role: "Complete Forward", blueprint: "Lewandowski / Benzema", demand: "Holds up, runs behind, presses, scores — does everything" }],
    },
  },

  "3-4-3": {
    definedBy: "Conte's Chelsea (2016–17)",
    philosophy: "Defensive structure with explosive wing-backs and lethal front three",
    era: "2016–2017",
    slots: {
      GK: [{ role: "Shot Stopper", blueprint: "Courtois", demand: "Commands the area, big frame, minimal distribution demands" }],
      CD: [
        { role: "Ball-Playing CB", blueprint: "Luiz", demand: "Long-range passing from deep, steps into midfield on the ball" },
        { role: "Stopper", blueprint: "Cahill", demand: "Aggressive in the air, tight marking, vocal" },
        { role: "Sweeper", blueprint: "Azpilicueta", demand: "Reads the game, covers, versatile — the intelligent defender" },
      ],
      CM: [
        { role: "Ball-Winner", blueprint: "Kanté", demand: "Wins the ball everywhere, covers impossible ground, triggers transitions" },
        { role: "Box-to-Box", blueprint: "Matic", demand: "Screens the defence, carries forward, physical presence" },
      ],
      WM: [
        { role: "Wing-Back", blueprint: "Moses", demand: "Direct running on the right, stretches play, defensive discipline" },
        { role: "Wing-Back", blueprint: "Alonso", demand: "Goal threat from left wing-back, set-piece delivery, bombs forward" },
      ],
      WF: [
        { role: "Inside Forward", blueprint: "Pedro", demand: "Movement, pressing, works the channels — intelligent not flashy" },
        { role: "Inside Forward", blueprint: "Hazard", demand: "The X-factor — dribbles, creates, scores, pulls defences apart" },
      ],
      CF: [{ role: "Prima Punta", blueprint: "Costa", demand: "Physical, aggressive, holds the line — scores ugly goals and loves it" }],
    },
  },

  "4-1-2-1-2": {
    definedBy: "Ancelotti's AC Milan (2003–07)",
    philosophy: "Technical excellence through the middle — the diamond controls the game",
    era: "2003–2007",
    slots: {
      GK: [{ role: "Shot Stopper", blueprint: "Dida", demand: "Shot-stopping specialist, commands the box on set pieces" }],
      CD: [
        { role: "Ball-Playing CB", blueprint: "Nesta", demand: "Reads the game before it happens, elegant interceptions, never dives in" },
        { role: "Stopper", blueprint: "Stam/Costacurta", demand: "Physical presence, aerial dominance, sweeps up" },
      ],
      WD: [
        { role: "Overlapping Full-Back", blueprint: "Cafu", demand: "Bombs forward on the right, relentless energy, crosses" },
        { role: "Overlapping Full-Back", blueprint: "Maldini", demand: "The greatest left-back ever — defends with intelligence, attacks with timing" },
      ],
      DM: [{ role: "Anchor", blueprint: "Pirlo", demand: "Deep-lying playmaker who dictates from in front of the defence" }],
      CM: [
        { role: "Box-to-Box", blueprint: "Gattuso", demand: "Destroys in the tackle, covers for Pirlo, never stops running" },
        { role: "Mezzala", blueprint: "Seedorf", demand: "Power and technique — drives from deep, shoots from distance" },
      ],
      AM: [{ role: "Trequartista", blueprint: "Kaká", demand: "The most explosive no. 10 — receives, turns, accelerates into the final third" }],
      CF: [
        { role: "Complete Forward", blueprint: "Shevchenko", demand: "Clinical finisher, intelligent movement, scores from anywhere" },
        { role: "Prima Punta", blueprint: "Inzaghi", demand: "Pure poacher — lives offside, scores tap-ins, ghosts into the box" },
      ],
    },
  },

  "4-5-1": {
    definedBy: "Benítez's Liverpool (2005–09)",
    philosophy: "Compact defensive shape, quick transitions, devastating set pieces",
    era: "2005–2009",
    slots: {
      GK: [{ role: "Shot Stopper", blueprint: "Reina", demand: "Distribution to start counters, commands the box, penalty specialist" }],
      CD: [
        { role: "Stopper", blueprint: "Carragher", demand: "Organises the line, blocks everything, never beaten in the air" },
        { role: "Ball-Playing CB", blueprint: "Hyypiä", demand: "Calm on the ball, reads the game, steps out when needed" },
      ],
      WD: [
        { role: "Overlapping Full-Back", blueprint: "Finnan", demand: "Reliable, disciplined, provides width without overcommitting" },
        { role: "Overlapping Full-Back", blueprint: "Riise", demand: "Thunderbolt left foot, overlaps with purpose, set-piece weapon" },
      ],
      DM: [{ role: "Anchor", blueprint: "Mascherano", demand: "Bite in the tackle, positional discipline, protects the centre-backs" }],
      CM: [
        { role: "Box-to-Box", blueprint: "Gerrard", demand: "Drives forward, scores from distance, drags the team by the collar" },
        { role: "Deep Playmaker", blueprint: "Xabi Alonso", demand: "Switches play, controls tempo, the metronome from deep" },
      ],
      WM: [
        { role: "Traditional Winger", blueprint: "Kuyt", demand: "Relentless work rate, presses from wide, arrives in the box" },
        { role: "Wide Playmaker", blueprint: "Luis García", demand: "Creates from wide left, drifts inside, scores important goals" },
      ],
      CF: [{ role: "Complete Forward", blueprint: "Torres", demand: "Pace in behind, clinical finishing, terrorises high lines" }],
    },
  },

  "3-3-1-3": {
    definedBy: "Bielsa's Athletic Bilbao / Leeds",
    philosophy: "Man-oriented pressing, extreme width, relentless intensity — football as geometry and effort",
    era: "2011–2021",
    slots: {
      GK: [{ role: "Sweeper Keeper", blueprint: "Meslier", demand: "Sweeps behind the suicidally high line, brave with feet" }],
      CD: [
        { role: "Ball-Playing CB", blueprint: "Llorente (Athl.)", demand: "Steps out aggressively, man-marks into midfield if needed" },
        { role: "Stopper", blueprint: "Laporte (Athl.)", demand: "Aggressive, front-foot, follows his man anywhere" },
        { role: "Ball-Playing CB", blueprint: "White", demand: "Carries out from the back, finds the playmaker under pressure" },
      ],
      DM: [{ role: "Anchor", blueprint: "De Roon / Phillips", demand: "Positional anchor, covers the spaces the back three leave exposed" }],
      CM: [
        { role: "Box-to-Box", blueprint: "Herrera / Dallas", demand: "Relentless pressing, man-marks the opponent's creator" },
        { role: "Mezzala", blueprint: "Muniain", demand: "Arrives in the box from deep, creative in tight spaces" },
      ],
      AM: [{ role: "Advanced Playmaker", blueprint: "Isco (Athl.) / Raphinha", demand: "Links the midfield three to the front three, final-third creator" }],
      WF: [
        { role: "Wide Forward", blueprint: "Harrison", demand: "Direct, pace, stretches the defence — Bielsa's outlet on the break" },
        { role: "Inside Forward", blueprint: "Susaeta / Bamford", demand: "Works the channels, presses relentlessly, movement over technique" },
      ],
      CF: [{ role: "Complete Forward", blueprint: "Llorente (Athl.) / Bamford", demand: "Holds up, presses, runs — the system's willing runner" }],
    },
  },

  "4-2-4": {
    definedBy: "Brazil (1958–62)",
    philosophy: "The original attacking revolution — four forwards, two wing-halves, beautiful chaos",
    era: "1958–1962",
    slots: {
      GK: [{ role: "Shot Stopper", blueprint: "Gilmar", demand: "Organises the back line, bravery under aerial bombardment" }],
      CD: [
        { role: "Stopper", blueprint: "Bellini", demand: "Aerial dominance, organises, sweeps" },
        { role: "Sweeper", blueprint: "Orlando", demand: "Covers behind, reads danger, last line before the keeper" },
      ],
      WD: [
        { role: "Overlapping Full-Back", blueprint: "Djalma Santos", demand: "The original attacking full-back — forward runs, crosses, creates width" },
        { role: "Overlapping Full-Back", blueprint: "Nilton Santos", demand: "Invented the overlapping run — joins attacks while covering the left" },
      ],
      CM: [
        { role: "Box-to-Box", blueprint: "Zito", demand: "Engine — covers the gaps the forwards leave, physical presence" },
        { role: "Deep Playmaker", blueprint: "Didi", demand: "The conductor — falling leaf free kicks, dictates the rhythm" },
      ],
      WF: [
        { role: "Traditional Winger", blueprint: "Garrincha", demand: "The joy of football — beats men for fun, crosses, scores, entertains" },
        { role: "Inside Forward", blueprint: "Zagallo", demand: "The original inverted winger — tucks inside, creates overloads in midfield" },
      ],
      CF: [
        { role: "Complete Forward", blueprint: "Pelé", demand: "The complete forward — shoots, heads, dribbles, creates, defines the position" },
        { role: "Poacher", blueprint: "Vavá", demand: "Finisher — feeds off Pelé and Garrincha's service, clinical in the box" },
      ],
    },
  },

  "4-3-1-2": {
    definedBy: "Simeone's Atlético Madrid (2013–16)",
    philosophy: "Compact 4-4-2 defensive block that transforms into a 4-3-1-2 in transition",
    era: "2013–2016",
    slots: {
      GK: [{ role: "Shot Stopper", blueprint: "Courtois", demand: "Big frame, saves everything, minimal distribution — the wall" }],
      CD: [
        { role: "Stopper", blueprint: "Godín", demand: "Warrior — aerial monster, blood and thunder, organises the block" },
        { role: "Ball-Playing CB", blueprint: "Miranda", demand: "Calmer head, reads the game, can play out under pressure" },
      ],
      WD: [
        { role: "Overlapping Full-Back", blueprint: "Juanfran", demand: "Defends first, overlaps second — disciplined and tireless" },
        { role: "Overlapping Full-Back", blueprint: "Filipe Luís", demand: "Crosses from deep, supports the press, defends the channel" },
      ],
      DM: [{ role: "Ball-Winner", blueprint: "Gabi", demand: "Bite, aggression, tactical intelligence — the midfield policeman" }],
      CM: [
        { role: "Box-to-Box", blueprint: "Tiago", demand: "Links defence to attack, keeps it simple, covers the wide areas" },
        { role: "Ball-Winner", blueprint: "Koke", demand: "Presses, creates, works — the system's most versatile piece" },
      ],
      AM: [{ role: "Seconda Punta", blueprint: "Arda Turan", demand: "Drifts between the lines, finds pockets, feeds the strikers" }],
      CF: [
        { role: "Prima Punta", blueprint: "Costa", demand: "Physical, aggressive, holds it up, bullies centre-backs" },
        { role: "Poacher", blueprint: "Villa/Griezmann", demand: "Runs off the target man, finishes clinically, intelligent movement" },
      ],
    },
  },

  "4-6-0": {
    definedBy: "Spain / Guardiola experiments (2012)",
    philosophy: "Total positional play — no fixed striker, everyone rotates, suffocate with the ball",
    era: "2012",
    slots: {
      GK: [{ role: "Sweeper Keeper", blueprint: "Casillas / Valdés", demand: "Part of the build-up, comfortable under extreme press" }],
      CD: [
        { role: "Ball-Playing CB", blueprint: "Piqué", demand: "Progressive from deep, steps into midfield, brave on the ball" },
        { role: "Ball-Playing CB", blueprint: "Ramos/Mascherano", demand: "Covers, steps out, can play in multiple positions" },
      ],
      WD: [
        { role: "Inverted Full-Back", blueprint: "Alba / Alves", demand: "Creates width AND inverts — the system's shape-shifter" },
        { role: "Inverted Full-Back", blueprint: "Alba", demand: "Underlapping runs, arrives in the box, combination play" },
      ],
      CM: [
        { role: "Deep Playmaker", blueprint: "Xavi", demand: "The metronome — never loses it, always available, tempo" },
        { role: "Mezzala", blueprint: "Iniesta", demand: "Carries, creates, arrives — football's most complete midfielder" },
      ],
      DM: [{ role: "Regista", blueprint: "Busquets", demand: "The pivot — everything goes through him, invisible but essential" }],
      AM: [{ role: "Trequartista", blueprint: "Fàbregas / Silva", demand: "The false striker — occupies CB attention, creates for runners" }],
      WF: [
        { role: "Inside Forward", blueprint: "Pedro / Navas", demand: "Makes runs in behind when the no. 10 drops — constant movement" },
        { role: "Inverted Winger", blueprint: "Silva / Mata", demand: "Drifts inside, finds pockets, creates with vision not pace" },
      ],
    },
  },
};

/**
 * Get the formation blueprint for a given formation name.
 */
export function getFormationBlueprint(formationName: string): FormationBlueprint | null {
  return FORMATION_BLUEPRINTS[formationName] ?? null;
}

/**
 * Get the slot blueprint for a specific position index within a formation.
 * Returns the blueprint for that slot, or null if the formation has no blueprint
 * or the position/index doesn't have a specific assignment.
 */
export function getSlotBlueprint(
  formationName: string,
  position: string,
  index: number
): SlotBlueprint | null {
  const bp = FORMATION_BLUEPRINTS[formationName];
  if (!bp) return null;
  const posSlots = bp.slots[position];
  if (!posSlots || index >= posSlots.length) return null;
  return posSlots[index];
}
