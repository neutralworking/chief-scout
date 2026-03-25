/**
 * Tactical role definitions — mirrors pipeline/27_player_ratings.py TACTICAL_ROLES.
 *
 * 36 roles (4 per position), each mapped to a pillar (technical/tactical/mental/physical).
 * Grouped by position for lookup.
 */

export type Pillar = 'technical' | 'tactical' | 'mental' | 'physical';

export interface RoleDefinition {
  name: string;
  position: string;
  pillar: Pillar;
  primaryModel: string;
  secondaryModel: string;
  tooltip: string;
  description: string;
  examples: string;
  origin?: string;
}

const ROLE_DEFINITIONS: RoleDefinition[] = [
  // GK
  { name: "Libero GK", position: "GK", pillar: "technical", primaryModel: "GK", secondaryModel: "Passer", tooltip: "Distribution specialist — builds attacks from the back", description: "Distribution specialist who starts attacks from the back with pinpoint passing under pressure.", examples: "Ederson, Ter Stegen", origin: "Italian/English" },
  { name: "Sweeper Keeper", position: "GK", pillar: "tactical", primaryModel: "GK", secondaryModel: "Cover", tooltip: "High line, sweeps behind defence, reads danger early", description: "Plays a high line, sweeps behind the defence, and reads danger before it develops.", examples: "Neuer, Alisson", origin: "English" },
  { name: "Comandante", position: "GK", pillar: "mental", primaryModel: "GK", secondaryModel: "Commander", tooltip: "Organizer — commands the area, marshals the backline", description: "The organizer — commands the penalty area, marshals the backline, and leads by presence and voice.", examples: "Buffon, Casillas, Cech", origin: "Portuguese/Italian" },
  { name: "Shotstopper", position: "GK", pillar: "physical", primaryModel: "GK", secondaryModel: "Target", tooltip: "Reflexes, presence, dominates the six-yard box", description: "Traditional shot-stopper who dominates the six-yard box with reflexes, agility, and physical presence.", examples: "Kahn, Courtois, Onana", origin: "English" },

  // CD
  { name: "Libero", position: "CD", pillar: "technical", primaryModel: "Passer", secondaryModel: "Cover", tooltip: "Ball-playing CB — progressive passing from deep", description: "Ball-playing centre-back who steps into midfield to build attacks and reads danger before it develops.", examples: "Beckenbauer, Stones, Laporte", origin: "Italian" },
  { name: "Sweeper", position: "CD", pillar: "tactical", primaryModel: "Cover", secondaryModel: "Controller", tooltip: "Last man — reads play two moves ahead, covers space", description: "Last man who reads the game and cleans up behind the defensive line with anticipation and positioning.", examples: "Sammer, Hummels, Marquinhos", origin: "English" },
  { name: "Zagueiro", position: "CD", pillar: "mental", primaryModel: "Commander", secondaryModel: "Destroyer", tooltip: "Commanding CB — leads, organizes, sets the defensive tone", description: "Commanding centre-back who leads by example, wins aerial battles, and organises the backline.", examples: "Thiago Silva, Van Dijk, Ramos", origin: "Brazilian" },
  { name: "Stopper", position: "CD", pillar: "physical", primaryModel: "Powerhouse", secondaryModel: "Destroyer", tooltip: "Aggressive front-foot defender — wins duels, dominates", description: "Aggressive front stopper who wins duels, presses high, and physically dominates attackers.", examples: "Chiellini, Konate, Rudiger", origin: "German" },

  // WD
  { name: "Lateral", position: "WD", pillar: "technical", primaryModel: "Passer", secondaryModel: "Dribbler", tooltip: "Attacking fullback — crosses, final ball, width", description: "Attacking full-back who bombs forward, delivers crosses, and provides width in the final third.", examples: "TAA, Cafu, Dani Alves", origin: "Portuguese" },
  { name: "Fluidificante", position: "WD", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Cover", tooltip: "Covers full flank in both phases, tireless discipline", description: "The one who makes it fluid — fullback who covers the full flank in both phases with tireless discipline.", examples: "Zanetti, Robertson, Hakimi", origin: "Italian" },
  { name: "Invertido", position: "WD", pillar: "mental", primaryModel: "Controller", secondaryModel: "Passer", tooltip: "Inverted FB — reads when to tuck inside, becomes midfielder", description: "Inverted full-back who tucks inside into midfield to create overloads and control possession.", examples: "Lahm, Cancelo, Rico Lewis", origin: "Spanish" },
  { name: "Corredor", position: "WD", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Engine", tooltip: "Pace-based fullback — explosive in transition", description: "Pace-based full-back who explodes into transition and covers ground with raw speed.", examples: "Walker, Theo Hernandez, Alphonso Davies", origin: "Spanish/Portuguese" },

  // DM
  { name: "Regista", position: "DM", pillar: "technical", primaryModel: "Passer", secondaryModel: "Controller", tooltip: "Deep playmaker — dictates tempo with passing quality", description: "Deep-lying playmaker who dictates tempo from a withdrawn position with vision and precise passing.", examples: "Pirlo, Jorginho, Xabi Alonso", origin: "Italian" },
  { name: "Anchor", position: "DM", pillar: "tactical", primaryModel: "Cover", secondaryModel: "Destroyer", tooltip: "Shield — positions, intercepts, guards the gate", description: "Defensive sentinel who sits in front of the back line, breaks up play, and shields the defence.", examples: "Makelele, Casemiro, Fabinho", origin: "French" },
  { name: "Pivote", position: "DM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Cover", tooltip: "Midfield brain — organizes shape, reads everything", description: "The midfield brain — organizes shape, reads everything, and controls tempo through intelligence.", examples: "Busquets, Rodri, Fernandinho", origin: "Spanish" },
  { name: "Volante", position: "DM", pillar: "physical", primaryModel: "Powerhouse", secondaryModel: "Destroyer", tooltip: "Ball-winner — aggressive, physical, disrupts", description: "High-energy defensive midfielder who wins the ball back aggressively and drives forward with it.", examples: "Gattuso, Kante, Caicedo", origin: "Brazilian" },

  // CM
  { name: "Mezzala", position: "CM", pillar: "technical", primaryModel: "Passer", secondaryModel: "Creator", tooltip: "Half-space creator — technical quality between the lines", description: "Half-space specialist who drifts wide to create, arriving late in dangerous positions between the lines.", examples: "Barella, Kovacic, Modric", origin: "Italian" },
  { name: "Tuttocampista", position: "CM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Cover", tooltip: "All-pitch midfielder — covers every blade, arrives in box", description: "Complete midfielder who covers every blade of grass — tackles, passes, scores, and leads.", examples: "Lampard, Gerrard, Bellingham", origin: "Italian" },
  { name: "Metodista", position: "CM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Passer", tooltip: "Orchestrator — controls rhythm with intelligent passing", description: "Methodical midfield conductor who controls the rhythm of play with short, intelligent passing.", examples: "Xavi, Kroos, Pedri", origin: "Italian" },
  { name: "Relayeur", position: "CM", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Engine", tooltip: "Tireless shuttle — pace and power to link phases", description: "Tireless shuttle who links defence to attack, winning the ball and carrying it forward at pace.", examples: "Valverde, Toure, Vidal", origin: "French" },

  // WM
  { name: "Winger", position: "WM", pillar: "technical", primaryModel: "Dribbler", secondaryModel: "Passer", tooltip: "Beats defenders with skill and trickery, delivers from wide", description: "Classic touchline winger who beats defenders with pace and trickery, delivering crosses into the box.", examples: "Garrincha, Figo, Saka", origin: "English" },
  { name: "Tornante", position: "WM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Cover", tooltip: "Full-flank wide mid — works both phases, selfless", description: "The returner — wide midfielder who covers the full flank in both phases with selfless discipline.", examples: "Moses, Kostic, Perisic", origin: "Italian" },
  { name: "False Winger", position: "WM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Cover", tooltip: "Starts wide, drifts inside intelligently to create overloads", description: "Starts wide but drifts inside intelligently, reading the game to create overloads and find space.", examples: "Bernardo Silva, Foden, Kulusevski", origin: "English" },
  { name: "Shuttler", position: "WM", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Engine", tooltip: "Raw pace and stamina to cover the flank end to end", description: "Raw pace and stamina to cover the flank end to end, providing width and direct running.", examples: "Sterling, Sane, Chiesa", origin: "English" },

  // AM
  { name: "Trequartista", position: "AM", pillar: "technical", primaryModel: "Dribbler", secondaryModel: "Creator", tooltip: "Free-roaming 10 — dribbling genius in the final third", description: "Free-roaming number 10 who creates magic in the final third with dribbling, vision, and imagination.", examples: "Baggio, Zidane, Messi", origin: "Italian" },
  { name: "Seconda Punta", position: "AM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Striker", tooltip: "Second striker — reads space, links play through movement", description: "Second striker who reads space between the lines, linking midfield and attack through intelligent movement.", examples: "Del Piero, Griezmann, Firmino", origin: "Italian" },
  { name: "Enganche", position: "AM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Creator", tooltip: "The hook — sees everything, threads impossible passes", description: "The hook — a classic playmaker who stands still, sees everything, and threads passes others can't imagine.", examples: "Riquelme, Dybala, Ozil", origin: "Argentine" },
  { name: "Boxcrasher", position: "AM", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Striker", tooltip: "Dynamic AM who arrives in the box with pace and power", description: "Dynamic attacking midfielder who arrives in the box with pace and power, converting half-chances.", examples: "Havertz, Bruno Fernandes, Ramsey", origin: "English" },

  // WF
  { name: "Inside Forward", position: "WF", pillar: "technical", primaryModel: "Dribbler", secondaryModel: "Sprinter", tooltip: "Cuts inside on strong foot to shoot or create", description: "Wide attacker who cuts inside onto their stronger foot to shoot or create, combining pace with directness.", examples: "Robben, Salah, Yamal", origin: "English" },
  { name: "Raumdeuter", position: "WF", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Striker", tooltip: "Space interpreter — presses and finds pockets to score", description: "Space interpreter who presses relentlessly and finds pockets of space to score from wide positions.", examples: "Son, Mane", origin: "German" },
  { name: "Inventor", position: "WF", pillar: "mental", primaryModel: "Creator", secondaryModel: "Dribbler", tooltip: "Creates something from nothing — vision from wide", description: "The creator who makes something from nothing, combining vision and dribbling from wide areas.", examples: "Grealish, Neymar", origin: "English" },
  { name: "Extremo", position: "WF", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Striker", tooltip: "Electric pace and power — stretches the defence", description: "Devastating wide forward who uses electric pace and power to stretch defences and score from wide areas.", examples: "Henry, Mbappe, Vinicius Jr", origin: "Portuguese" },

  // CF
  { name: "Poacher", position: "CF", pillar: "technical", primaryModel: "Striker", secondaryModel: "Dribbler", tooltip: "Pure finisher — movement, instinct, clinical in the box", description: "Pure goalscorer who lives in the box — sharp movement, clinical finishing, instinct for where the ball will land.", examples: "Gerd Muller, Inzaghi, Haaland", origin: "English" },
  { name: "Spearhead", position: "CF", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Destroyer", tooltip: "Leads the press from front, relentless work rate", description: "Leads the press from the front with relentless work rate, setting the tempo for the whole team.", examples: "Vardy, Suarez, Werner", origin: "English" },
  { name: "Falso Nove", position: "CF", pillar: "mental", primaryModel: "Creator", secondaryModel: "Controller", tooltip: "False 9 — drops deep, creates, pulls CBs out of shape", description: "False nine who drops deep to create, pulling centre-backs out of position and opening space for runners.", examples: "Messi (2009), Benzema, Firmino", origin: "Spanish" },
  { name: "Prima Punta", position: "CF", pillar: "physical", primaryModel: "Target", secondaryModel: "Powerhouse", tooltip: "Target striker — aerial, holds up, physical reference point", description: "Target striker who holds up the ball, wins aerial duels, and brings teammates into play around the box.", examples: "Toni, Giroud, Lewandowski", origin: "Italian" },
];

// Indexed by role name for O(1) lookup
const ROLE_MAP = new Map<string, RoleDefinition>();
for (const role of ROLE_DEFINITIONS) {
  // Store by name — last one wins in the flat map.
  // Callers with position should use getRoleDefinition().
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
