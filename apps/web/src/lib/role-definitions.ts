/**
 * Tactical role definitions — mirrors pipeline/27_player_ratings.py TACTICAL_ROLES.
 *
 * Each role has a short description a fan would understand plus example players.
 * Grouped by position for lookup.
 */

export interface RoleDefinition {
  name: string;
  position: string;
  description: string;
  examples: string;
}

const ROLE_DEFINITIONS: RoleDefinition[] = [
  // GK
  { name: "Torwart", position: "GK", description: "Traditional shot-stopper who commands the box, dominates crosses, and organises the defence.", examples: "Kahn, Buffon, Courtois" },
  { name: "Sweeper Keeper", position: "GK", description: "Plays a high line, sweeps behind the defence, and acts as an extra outfield player when the team has the ball.", examples: "Neuer, Alisson" },
  { name: "Ball-Playing GK", position: "GK", description: "Distribution specialist who starts attacks from the back with pinpoint passing under pressure.", examples: "Ederson, Ter Stegen" },

  // CD
  { name: "Libero", position: "CD", description: "Ball-playing centre-back who steps into midfield to build attacks and reads danger before it develops.", examples: "Beckenbauer, Stones" },
  { name: "Vorstopper", position: "CD", description: "Aggressive front stopper who wins duels, presses high, and physically dominates attackers.", examples: "Baresi, Chiellini, Konaté" },
  { name: "Sweeper", position: "CD", description: "Last man who reads the game and cleans up behind the defensive line with anticipation and positioning.", examples: "Sammer, Hummels, Marquinhos" },
  { name: "Zagueiro", position: "CD", description: "Commanding centre-back who leads by example, wins aerial battles, and organises the backline.", examples: "Lúcio, Thiago Silva" },

  // WD
  { name: "Lateral", position: "WD", description: "Attacking full-back who bombs forward, delivers crosses, and provides width in the final third.", examples: "Cafu, TAA" },
  { name: "Invertido", position: "WD", description: "Inverted full-back who tucks inside into midfield to create overloads and control possession.", examples: "Lahm, Cancelo, Rico Lewis" },
  { name: "Carrilero", position: "WD", description: "Tireless lane runner who covers the entire flank with pace, providing both defensive cover and attacking thrust.", examples: "Facchetti, Zanetti, Hakimi" },

  // DM
  { name: "Sentinelle", position: "DM", description: "Defensive sentinel who sits in front of the back line, breaks up play, and shields the defence.", examples: "Makélélé, Casemiro" },
  { name: "Regista", position: "DM", description: "Deep-lying playmaker who dictates tempo from a withdrawn position with vision and precise passing.", examples: "Pirlo, Jorginho" },
  { name: "Volante", position: "DM", description: "High-energy defensive midfielder who wins the ball back aggressively and drives forward with it.", examples: "Gattuso, Kanté, Caicedo" },

  // CM
  { name: "Metodista", position: "CM", description: "Methodical midfield conductor who controls the rhythm of play with short, intelligent passing.", examples: "Xavi, Kroos, Pedri" },
  { name: "Tuttocampista", position: "CM", description: "Complete midfielder who covers every blade of grass — tackles, passes, scores, and leads.", examples: "Lampard, Gerrard, Bellingham" },
  { name: "Mezzala", position: "CM", description: "Half-space specialist who drifts wide to create, arriving late in dangerous positions between the lines.", examples: "Barella" },
  { name: "Relayeur", position: "CM", description: "Tireless shuttle who links defence to attack, winning the ball and carrying it forward at pace.", examples: "Valverde" },

  // WM
  { name: "Fantasista", position: "WM", description: "Wide creative artist who drifts inside to unlock defences with flair, vision, and delicate technique.", examples: "Silva, Bernardo, Foden" },
  { name: "Winger", position: "WM", description: "Classic touchline winger who beats defenders with pace and trickery, delivering crosses into the box.", examples: "Garrincha, Figo, Saka" },
  { name: "Raumdeuter", position: "WM", description: "Space interpreter who finds pockets of space others miss, ghosting into scoring positions off the ball.", examples: "Thomas Müller" },

  // AM
  { name: "Trequartista", position: "AM", description: "Free-roaming number 10 who creates magic in the final third with dribbling, vision, and imagination.", examples: "Baggio, Zidane, Messi" },
  { name: "Enganche", position: "AM", description: "The hook — a classic playmaker who stands still, sees everything, and threads passes others can't imagine.", examples: "Riquelme, Dybala" },
  { name: "Seconda Punta", position: "AM", description: "Second striker who drops deep to link play, then arrives in the box to finish chances.", examples: "Del Piero, Havertz" },

  // WF
  { name: "Inside Forward", position: "WF", description: "Wide attacker who cuts inside onto their stronger foot to shoot or create, combining pace with directness.", examples: "Robben, Salah, Yamal" },
  { name: "Extremo", position: "WF", description: "Devastating wide forward who uses electric pace and power to stretch defences and score from wide areas.", examples: "Henry, Mbappé" },
  { name: "Inverted Winger", position: "WF", description: "Creative wide player who drifts inside to find space, combining dribbling with playmaking ability.", examples: "Saka, Grealish" },

  // CF
  { name: "Prima Punta", position: "CF", description: "Target striker who holds up the ball, wins aerial duels, and brings teammates into play around the box.", examples: "Toni, Giroud" },
  { name: "Poacher", position: "CF", description: "Pure goalscorer who lives in the box — sharp movement, clinical finishing, instinct for where the ball will land.", examples: "Gerd Müller, Inzaghi, Haaland" },
  { name: "Complete Forward", position: "CF", description: "Total striker who can score from anywhere, create for others, and lead the line with intelligence and power.", examples: "R9, Van Basten, Benzema" },
  { name: "Falso Nove", position: "CF", description: "False nine who drops deep to create, pulling centre-backs out of position and opening space for runners.", examples: "Messi (2009), Firmino" },
  { name: "Seconda Punta", position: "CF", description: "Second striker who roams between the lines, linking midfield and attack with clever movement and finishing.", examples: "Totti, Griezmann" },
];

// Indexed by role name for O(1) lookup
const ROLE_MAP = new Map<string, RoleDefinition>();
for (const role of ROLE_DEFINITIONS) {
  // Some names appear in multiple positions (Seconda Punta in AM + CF).
  // Store both but the last one wins in the flat map — callers with position should use getRoleDefinition().
  ROLE_MAP.set(role.name, role);
}

/**
 * Look up a role definition by name, optionally filtering by position.
 */
export function getRoleDefinition(roleName: string | null, position?: string | null): RoleDefinition | null {
  if (!roleName) return null;

  // If position is provided, find exact match
  if (position) {
    const match = ROLE_DEFINITIONS.find(r => r.name === roleName && r.position === position);
    if (match) return match;
  }

  // Fall back to name-only lookup
  return ROLE_MAP.get(roleName) ?? null;
}
