/**
 * Tactical role definitions — mirrors pipeline 27 + DB slot_roles.
 *
 * 38 roles validated bottom-up against real tactical systems.
 * Variable count per position (WM: 3, CF: 7).
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
  // GK (4)
  { name: "Comandante", position: "GK", pillar: "mental", primaryModel: "GK", secondaryModel: "Commander", tooltip: "Organises, commands, vocal presence", description: "The organizer — commands the penalty area, marshals the backline, and leads by presence and voice.", examples: "Schmeichel, Buffon, Lloris", origin: "Portuguese/Italian" },
  { name: "Sweeper Keeper", position: "GK", pillar: "tactical", primaryModel: "GK", secondaryModel: "Cover", tooltip: "Sweeps behind high line, comes off line", description: "Plays a high line, sweeps behind the defence, and reads danger before it develops.", examples: "Neuer, Alisson, Van der Sar", origin: "English" },
  { name: "Distributor", position: "GK", pillar: "technical", primaryModel: "GK", secondaryModel: "Passer", tooltip: "Distribution specialist, passing outlet", description: "Distribution specialist who starts attacks from the back with pinpoint passing under pressure.", examples: "Ederson, Valdés", origin: "English" },
  { name: "Shotstopper", position: "GK", pillar: "physical", primaryModel: "GK", secondaryModel: "Powerhouse", tooltip: "Reflexes, dominates the box", description: "Traditional shot-stopper who dominates the six-yard box with reflexes, agility, and physical presence.", examples: "Courtois, Pope, Begović", origin: "English" },

  // CD (4)
  { name: "Centrale", position: "CD", pillar: "mental", primaryModel: "Commander", secondaryModel: "Destroyer", tooltip: "Commanding CB — organises, leads, sets the line", description: "Commanding centre-back who leads by example, wins aerial battles, and organises the backline.", examples: "Van Dijk, Terry, Puyol, Morgan", origin: "Italian" },
  { name: "Distributor", position: "CD", pillar: "technical", primaryModel: "Passer", secondaryModel: "Cover", tooltip: "Ball-playing CB — progressive passing from deep", description: "Ball-playing centre-back who steps into midfield to build attacks with progressive passing.", examples: "Bonucci, Stones, Piqué, Ferdinand", origin: "English" },
  { name: "Stopper", position: "CD", pillar: "physical", primaryModel: "Powerhouse", secondaryModel: "Destroyer", tooltip: "Aggressive, front-foot, wins duels", description: "Aggressive front stopper who wins duels, presses high, and physically dominates attackers.", examples: "Chiellini, Vidić, Stam, Konaté", origin: "German" },
  { name: "Sweeper", position: "CD", pillar: "tactical", primaryModel: "Cover", secondaryModel: "Controller", tooltip: "Last man — reads play, covers space", description: "Last man who reads the game two moves ahead and covers space behind the defensive line.", examples: "Beckenbauer, Varane, Hummels, Picchi", origin: "English" },

  // WD (4)
  { name: "Fullback", position: "WD", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Passer", tooltip: "Gets forward, supports attacks", description: "Gets forward to support attacks, delivers crosses, and provides width in the final third.", examples: "Neville, Irwin, Carvajal, Evra", origin: "English" },
  { name: "Wing-back", position: "WD", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Dribbler", tooltip: "IS the width — covers entire flank", description: "IS the width — covers the entire flank in both phases with pace, dribbling, and tireless running.", examples: "Dani Alves, Hakimi, Maicon, Robertson", origin: "English" },
  { name: "Corner Back", position: "WD", pillar: "tactical", primaryModel: "Cover", secondaryModel: "Destroyer", tooltip: "Stays home, defends, marks", description: "Stays home, defends, and marks — the reliable full-back who prioritises defensive solidity.", examples: "Azpilicueta, Pavard, Mendy, Cáceres", origin: "English" },
  { name: "Invertido", position: "WD", pillar: "mental", primaryModel: "Controller", secondaryModel: "Passer", tooltip: "Tucks inside, becomes midfielder", description: "Inverted full-back who tucks inside into midfield to create overloads and control possession.", examples: "Lahm 2013, Cancelo, TAA, Krol", origin: "Spanish" },

  // DM (5)
  { name: "Regista", position: "DM", pillar: "technical", primaryModel: "Passer", secondaryModel: "Controller", tooltip: "Deep quarterback — dictates with long passing", description: "Deep-lying playmaker who dictates tempo from a withdrawn position with vision and precise passing.", examples: "Pirlo, Jorginho, Gérson", origin: "Italian" },
  { name: "Pivote", position: "DM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Cover", tooltip: "Creative holding mid — controls, distributes", description: "The midfield brain — organizes shape, reads everything, and controls tempo through intelligence.", examples: "Busquets, Rodri, Rijkaard", origin: "Spanish" },
  { name: "Anchor", position: "DM", pillar: "tactical", primaryModel: "Cover", secondaryModel: "Engine", tooltip: "Sits, screens, protects the back line", description: "Positional sentinel who screens the back line, reads danger, and covers space.", examples: "Makélélé, Kanté, Fabinho", origin: "English" },
  { name: "Ballwinner", position: "DM", pillar: "tactical", primaryModel: "Destroyer", secondaryModel: "Engine", tooltip: "Aggressive ball-winner, disrupts and drives", description: "High-energy ball-winner who disrupts opponents aggressively and drives forward after winning possession.", examples: "Gattuso, Kanté, Caicedo", origin: "English" },
  { name: "Segundo Volante", position: "DM", pillar: "physical", primaryModel: "Powerhouse", secondaryModel: "Engine", tooltip: "DM who drives forward, scores from deep", description: "High-energy DM who drives forward with the ball and arrives to score from deep positions.", examples: "Touré, Pogba, Caicedo, Keïta", origin: "Brazilian" },

  // CM (5)
  { name: "Playmaker", position: "CM", pillar: "mental", primaryModel: "Creator", secondaryModel: "Passer", tooltip: "Runs the game with vision and range", description: "Runs the game with vision and range — the orchestrator who sees passes others cannot.", examples: "Scholes, Modric, Didi, Van Hanegem", origin: "English" },
  { name: "Metodista", position: "CM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Passer", tooltip: "Metronome — controls rhythm, never wastes a ball", description: "Metronome who controls the rhythm of play with short, intelligent passing.", examples: "Xavi, Kroos, Carrick, Thiago", origin: "Italian" },
  { name: "Mezzala", position: "CM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Creator", tooltip: "Half-space creator, arrives in the box", description: "Engine-first half-space specialist who arrives late in dangerous positions between the lines.", examples: "Iniesta, Bellingham, Mazzola, Litmanen", origin: "Italian" },
  { name: "Tuttocampista", position: "CM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Cover", tooltip: "Box-to-box, covers every blade", description: "Complete midfielder who covers every blade of grass — tackles, passes, scores, and leads.", examples: "Keane, Vidal, Neeskens, Davids", origin: "Italian" },
  { name: "Ballwinner", position: "CM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Destroyer", tooltip: "Engine-first ball-winner in midfield", description: "Engine-driven midfielder who wins the ball back with intensity and keeps the team ticking.", examples: "Kanté, Gattuso, Vidal", origin: "English" },

  // WM (4)
  { name: "Winger", position: "WM", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Dribbler", tooltip: "Pace and skill from wide", description: "Wide midfielder who beats defenders with pace and dribbling, providing width and direct running.", examples: "Garrincha, Giggs, Beckham, Raphinha", origin: "English" },
  { name: "Tornante", position: "WM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Cover", tooltip: "Tracks back, full-flank both phases", description: "The returner — wide midfielder who covers the full flank in both phases with selfless discipline.", examples: "Zagallo, Park, Gosens, Valverde", origin: "Italian" },
  { name: "False Winger", position: "WM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Creator", tooltip: "Starts wide, drifts inside", description: "Starts wide but drifts inside intelligently, reading the game to create overloads and find space.", examples: "Bernardo Silva, Forsberg", origin: "English" },
  { name: "Wide Playmaker", position: "WM", pillar: "mental", primaryModel: "Creator", secondaryModel: "Passer", tooltip: "Creates from wide — vision, passing, dictates", description: "Creates from wide areas with vision and passing, dictating play from the flank.", examples: "Neymar, Grealish, Rui Costa (wide)", origin: "English" },

  // AM (4)
  { name: "Trequartista", position: "AM", pillar: "technical", primaryModel: "Dribbler", secondaryModel: "Creator", tooltip: "Free-roaming creator in the final third", description: "Free-roaming number 10 who creates magic in the final third with dribbling, vision, and imagination.", examples: "Götze, Muniain, De Bruyne, Pelé 1970", origin: "Italian" },
  { name: "Enganche", position: "AM", pillar: "mental", primaryModel: "Creator", secondaryModel: "Controller", tooltip: "The hook — receives between lines, decisive pass", description: "The hook — a classic playmaker who sees everything and threads passes others can't imagine.", examples: "Sneijder, Tostão, Riquelme", origin: "Argentine" },
  { name: "Incursore", position: "AM", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Striker", tooltip: "Arriving AM — reads space, arrives in the box", description: "The raider — an AM who reads space and arrives in the box with timing, converting half-chances.", examples: "Müller, Lampard, Bruno Fernandes, Havertz", origin: "Italian" },
  { name: "Mediapunta", position: "AM", pillar: "mental", primaryModel: "Controller", secondaryModel: "Creator", tooltip: "Combinational 10 — links through short passing", description: "The half-point — a mobile, intelligent 10 who links play through short combinations and positional intelligence.", examples: "David Silva, Isco, Pedri, Odegaard", origin: "Spanish" },

  // WF (5)
  { name: "Inside Forward", position: "WF", pillar: "technical", primaryModel: "Dribbler", secondaryModel: "Striker", tooltip: "Cuts inside on strong foot to shoot/create", description: "Wide attacker who cuts inside onto their stronger foot to shoot or create.", examples: "Salah, Robben, Mané, Ronaldo 2008", origin: "English" },
{ name: "Winger", position: "WF", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Dribbler", tooltip: "Pace and skill from wide", description: "Wide attacker who beats defenders with pace and dribbling, stretching the defence.", examples: "Vinícius, Overmars, Finidi", origin: "English" },
  { name: "Wide Playmaker", position: "WF", pillar: "mental", primaryModel: "Creator", secondaryModel: "Passer", tooltip: "Creates from wide — vision, passing, dictates", description: "Creates from wide areas with vision and passing, dictating play from the flank.", examples: "Neymar, Grealish, Rui Costa (wide)", origin: "English" },
  { name: "Wide Target Forward", position: "WF", pillar: "physical", primaryModel: "Target", secondaryModel: "Powerhouse", tooltip: "Physical presence from wide — holds up, wins aerials", description: "Physical wide forward who holds up the ball and wins aerial duels from wide positions.", examples: "Mandžukić (LW), Weghorst (wide), Arnautović", origin: "English" },

  // CF (7)
  { name: "Prima Punta", position: "CF", pillar: "technical", primaryModel: "Striker", secondaryModel: "Target", tooltip: "Clinical finisher with aerial presence", description: "The first striker — clinical finishing combined with aerial ability and box instinct.", examples: "Inzaghi, Haaland, Gerd Müller, Toni", origin: "Italian" },
  { name: "Complete Forward", position: "CF", pillar: "technical", primaryModel: "Striker", secondaryModel: "Creator", tooltip: "Scores, creates, links, does everything", description: "The complete package — scores, creates, links play, and can do everything asked of a striker.", examples: "Lewandowski, Kane, Benzema, Rooney", origin: "English" },
  { name: "Falso Nove", position: "CF", pillar: "mental", primaryModel: "Creator", secondaryModel: "Controller", tooltip: "Drops deep, creates space, false 9", description: "False nine who drops deep to create, pulling centre-backs out of position and opening space.", examples: "Messi 2011, Firmino, Cruyff", origin: "Spanish" },
  { name: "Spearhead", position: "CF", pillar: "tactical", primaryModel: "Engine", secondaryModel: "Destroyer", tooltip: "Leads the press from front, work rate", description: "Leads the press from the front with relentless work rate, setting the tempo for the whole team.", examples: "Suárez, Okazaki, Bamford", origin: "English" },
  { name: "Target Forward", position: "CF", pillar: "physical", primaryModel: "Target", secondaryModel: "Powerhouse", tooltip: "Aerial, holds up, physical reference point", description: "Target striker who holds up the ball, wins aerial duels, and brings teammates into play.", examples: "Giroud, Crouch, Mandžukić, Llorente", origin: "English" },
  { name: "Seconda Punta", position: "CF", pillar: "mental", primaryModel: "Creator", secondaryModel: "Striker", tooltip: "Second striker — creative, plays off the main striker", description: "Second striker who plays off the main forward — creative, intelligent, links midfield to attack.", examples: "Yorke, Forlán, Del Piero, Griezmann", origin: "Italian" },
  { name: "Shadow Striker", position: "CF", pillar: "physical", primaryModel: "Sprinter", secondaryModel: "Striker", tooltip: "Pace, runs in behind, ghosts past the line", description: "Pace-based striker who runs in behind the defence and ghosts past the defensive line.", examples: "Vardy, Werner, Aubameyang, Belanov", origin: "English" },
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
