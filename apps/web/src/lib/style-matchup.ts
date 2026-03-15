/**
 * Style Matchup Intelligence — generates scouting narratives from
 * tactical style enum combinations for match previews.
 */

export type TacticalStyle =
  | "Tika-Taka" | "Total" | "Gegenpress" | "Garra Charrua"
  | "Joga Bonito" | "Fluid" | "Pragmatic" | "POMO" | "Catennacio";

export type OffensiveStyle =
  | "Overload" | "Positional" | "Flair" | "Possession" | "Relational"
  | "Wing Play" | "Balanced" | "Direct" | "Counter" | "Cautious";

export type DefensiveStyle =
  | "Full Press" | "High Press" | "Hybrid Press" | "Balanced" | "Adaptive"
  | "Compact" | "Structured" | "Aggressive" | "Low Block" | "Park The Bus";

interface ClubStyle {
  name: string;
  formation?: string | null;
  tacticalStyle?: TacticalStyle | null;
  offensiveStyle?: OffensiveStyle | null;
  defensiveStyle?: DefensiveStyle | null;
}

interface StyleMatchup {
  headline: string;
  narrative: string;
  keyBattle: string;
  tempo: "high" | "medium" | "low";
  spectacle: number; // 1-5 entertainment rating
}

// ── Offensive intensity ranking ──────────────────────────────────────────────

const OFFENSIVE_INTENSITY: Record<string, number> = {
  "Overload": 9, "Flair": 8, "Positional": 7, "Possession": 6,
  "Relational": 6, "Wing Play": 5, "Balanced": 5, "Direct": 7,
  "Counter": 4, "Cautious": 2,
};

const DEFENSIVE_INTENSITY: Record<string, number> = {
  "Full Press": 10, "High Press": 8, "Hybrid Press": 7, "Aggressive": 7,
  "Balanced": 5, "Adaptive": 5, "Compact": 4, "Structured": 3,
  "Low Block": 2, "Park The Bus": 1,
};

// ── Matchup narratives ──────────────────────────────────────────────────────

const STYLE_CLASHES: Record<string, string> = {
  "Gegenpress_vs_Catennacio":
    "Relentless pressure meets immovable defence. The pressing team must find gaps in a deep block — patience vs intensity.",
  "Gegenpress_vs_Gegenpress":
    "A mirror match of intensity. Both teams will press high, expect turnovers, transitions, and chaos in midfield.",
  "Tika-Taka_vs_Gegenpress":
    "Possession vs pressing — the classic modern tactical duel. Can the ball-players resist the press, or will they be suffocated?",
  "Tika-Taka_vs_Catennacio":
    "The irresistible force meets the immovable object. Patient build-up against a disciplined low block.",
  "Tika-Taka_vs_Tika-Taka":
    "A chess match. Both teams want the ball — the team that controls transitions between possession phases wins.",
  "Total_vs_Pragmatic":
    "Total football's fluidity against pragmatic structure. Versatility vs discipline.",
  "Joga Bonito_vs_Garra Charrua":
    "Flair meets fight. Brazilian creativity against South American grit — expect drama.",
  "Fluid_vs_POMO":
    "Free-flowing movement against post-modern tactical complexity. Instinct vs system.",
  "Pragmatic_vs_Catennacio":
    "Two pragmatic schools — efficiency and clean sheets. Don't expect fireworks, expect fine margins.",
};

const OFFENSIVE_CLASHES: Record<string, string> = {
  "Possession_vs_Counter":
    "The possession team will dominate the ball but must beware the counter-punch. One mistake could be fatal.",
  "Direct_vs_Possession":
    "Directness aims to bypass the build-up. Long balls and second balls vs patient circulation.",
  "Wing Play_vs_Compact":
    "Width against compactness. The wide team must stretch a narrow block — full-backs are key.",
  "Overload_vs_Low Block":
    "Numerical superiority in the final third against disciplined defensive shape. Can they unlock the door?",
  "Flair_vs_Structured":
    "Individual brilliance against collective discipline. One moment of magic could decide it.",
  "Positional_vs_Counter":
    "Positional play aims to control space, but leaves gaps for rapid transitions. A tactical tightrope.",
};

function getStyleClash(home: TacticalStyle, away: TacticalStyle): string | null {
  return STYLE_CLASHES[`${home}_vs_${away}`]
    ?? STYLE_CLASHES[`${away}_vs_${home}`]
    ?? null;
}

function getOffensiveClash(homeOff: OffensiveStyle, awayDef: DefensiveStyle): string | null {
  return OFFENSIVE_CLASHES[`${homeOff}_vs_${awayDef}`] ?? null;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function generateStyleMatchup(home: ClubStyle, away: ClubStyle): StyleMatchup {
  const homeTac = home.tacticalStyle;
  const awayTac = away.tacticalStyle;
  const homeOff = home.offensiveStyle;
  const awayOff = away.offensiveStyle;
  const homeDef = home.defensiveStyle;
  const awayDef = away.defensiveStyle;

  // Headline
  const headline = homeTac && awayTac
    ? `${homeTac} vs ${awayTac}`
    : homeOff && awayOff
      ? `${homeOff} vs ${awayOff}`
      : `${home.name} vs ${away.name}`;

  // Narrative — try specific matchup, then generic
  let narrative = "";
  if (homeTac && awayTac) {
    narrative = getStyleClash(homeTac, awayTac) ?? "";
  }
  if (!narrative && homeOff && awayDef) {
    narrative = getOffensiveClash(homeOff, awayDef) ?? "";
  }
  if (!narrative && awayOff && homeDef) {
    const reverse = getOffensiveClash(awayOff, homeDef);
    if (reverse) narrative = reverse;
  }
  if (!narrative) {
    narrative = generateGenericNarrative(home, away);
  }

  // Key battle
  const keyBattle = identifyKeyBattle(home, away);

  // Tempo & spectacle
  const homeIntensity = (OFFENSIVE_INTENSITY[homeOff ?? ""] ?? 5) + (DEFENSIVE_INTENSITY[homeDef ?? ""] ?? 5);
  const awayIntensity = (OFFENSIVE_INTENSITY[awayOff ?? ""] ?? 5) + (DEFENSIVE_INTENSITY[awayDef ?? ""] ?? 5);
  const avgIntensity = (homeIntensity + awayIntensity) / 2;

  const tempo: "high" | "medium" | "low" = avgIntensity > 12 ? "high" : avgIntensity > 8 ? "medium" : "low";
  const spectacle = Math.min(5, Math.max(1, Math.round(avgIntensity / 4)));

  return { headline, narrative, keyBattle, tempo, spectacle };
}

function generateGenericNarrative(home: ClubStyle, away: ClubStyle): string {
  const parts: string[] = [];

  if (home.formation && away.formation) {
    parts.push(`${home.name}'s ${home.formation} meets ${away.name}'s ${away.formation}.`);
  }

  if (home.offensiveStyle && away.defensiveStyle) {
    parts.push(`${home.name}'s ${home.offensiveStyle.toLowerCase()} approach will test ${away.name}'s ${away.defensiveStyle.toLowerCase()} shape.`);
  }

  if (parts.length === 0) {
    parts.push(`A tactical contest between two sides with contrasting approaches.`);
  }

  return parts.join(" ");
}

function identifyKeyBattle(home: ClubStyle, away: ClubStyle): string {
  const homeOff = home.offensiveStyle;
  const awayDef = away.defensiveStyle;

  if (homeOff === "Wing Play" || awayDef === "Compact") {
    return "Wide areas — can the full-backs and wingers find space against a narrow block?";
  }
  if (homeOff === "Possession" || homeOff === "Positional") {
    return "Midfield control — the battle for possession and territorial dominance.";
  }
  if (awayDef === "High Press" || awayDef === "Full Press") {
    return "Build-up under pressure — can the back line play through the press?";
  }
  if (homeOff === "Direct" || homeOff === "Counter") {
    return "Transitions — who wins the second balls and controls the counterattack?";
  }
  if (awayDef === "Low Block" || awayDef === "Park The Bus") {
    return "Final third creativity — breaking down a deep, disciplined defence.";
  }
  return "Midfield — whoever controls the middle third controls the match.";
}

/**
 * Get a style label for a club formation.
 * E.g., "4-3-3 Gegenpress" or just "4-3-3"
 */
export function formatClubStyle(club: ClubStyle): string {
  const parts: string[] = [];
  if (club.formation) parts.push(club.formation);
  if (club.tacticalStyle) parts.push(club.tacticalStyle);
  return parts.join(" · ") || "Unknown";
}
