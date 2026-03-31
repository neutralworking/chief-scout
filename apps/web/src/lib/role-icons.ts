/**
 * Role Icons — The all-time greatest player for each tactical role.
 *
 * Each role has an "icon" — the player who achieved the highest peak
 * performance in that role. The snapshot profiles explain what made
 * them the definitive exemplar: formation fit, traits, technical and
 * tactical qualities, and the context of their peak.
 *
 * Scores are on a 0–99 scale reflecting peak role mastery.
 * Cultural names reference the SACROSANCT tactical role taxonomy.
 */

export interface RoleIcon {
  /** Role name — matches ROLE_INTELLIGENCE keys */
  role: string;
  /** Cultural/foreign name from SACROSANCT taxonomy */
  culturalName?: string;
  /** Cultural origin of the role name */
  origin?: string;
  /** Primary position code */
  position: string;
  /** The all-time greatest player at this role */
  iconPlayer: string;
  /** Player nationality */
  nationality: string;
  /** Peak role score (0–99) */
  peakScore: number;
  /** Peak era (years) */
  peakEra: string;
  /** Club/team where they peaked */
  peakClub: string;
  /** Formation that best showcased the role */
  peakFormation: string;
  /** 2–3 sentence snapshot of what made them the GOAT at this role */
  snapshot: string;
  /** 3–4 defining traits that powered the peak score */
  keyTraits: string[];
}

export const ROLE_ICONS: Record<string, RoleIcon> = {
  // ── GK ──────────────────────────────────────────────────────────────────

  "Libero GK": {
    role: "Libero GK",
    position: "GK",
    iconPlayer: "Marc-André ter Stegen",
    nationality: "Germany",
    peakScore: 90,
    peakEra: "2015–2019",
    peakClub: "Barcelona",
    peakFormation: "4-3-3",
    snapshot:
      "Ter Stegen redefined the goalkeeper as a ball-playing distributor under Guardiola's positional play principles. His ability to receive under pressure, play sharp passes into tight spaces, and act as an extra outfield player made him essential to Barcelona's build-up. In the 2018–19 Champions League knockout rounds, his saves were as vital as his distribution — the complete Libero GK.",
    keyTraits: ["Distribution under pressure", "Footwork", "Composure on the ball", "Line management"],
  },

  "Sweeper Keeper": {
    role: "Sweeper Keeper",
    position: "GK",
    iconPlayer: "Manuel Neuer",
    nationality: "Germany",
    peakScore: 96,
    peakEra: "2012–2016",
    peakClub: "Bayern Munich",
    peakFormation: "4-3-3 / 3-5-2",
    snapshot:
      "Neuer redefined goalkeeping by operating as a sweeper 30 yards off his line while maintaining elite shot-stopping. Under Guardiola's positional play he became Bayern's first outfield player, starting attacks with precision distribution. His 2014 World Cup cemented him as the prototype — no keeper before or since has combined sweeping range, footwork, and reflexes at this level.",
    keyTraits: ["Sweeping range", "Distribution under pressure", "Anticipation", "Commanding presence"],
  },

  Comandante: {
    role: "Comandante",
    origin: "Italian",
    position: "GK",
    iconPlayer: "Gianluigi Buffon",
    nationality: "Italy",
    peakScore: 97,
    peakEra: "2003–2006",
    peakClub: "Juventus",
    peakFormation: "4-4-2 / 3-5-2",
    snapshot:
      "Buffon at his peak was the most complete traditional goalkeeper in history — supernatural reflexes, impeccable positioning, and a presence that made strikers doubt themselves. Behind Cannavaro and Nesta in Italy's 2006 World Cup, he conceded just two goals in seven matches, one an own goal. His longevity across 25 years at the top only amplifies the peak: when it mattered most, nobody was harder to beat.",
    keyTraits: ["Reflexes", "Positioning", "Big-game temperament", "Aerial command"],
  },

  Shotstopper: {
    role: "Shotstopper",
    position: "GK",
    iconPlayer: "Oliver Kahn",
    nationality: "Germany",
    peakScore: 94,
    peakEra: "1999–2002",
    peakClub: "Bayern Munich",
    peakFormation: "4-4-2",
    snapshot:
      "Kahn was the purest shot-stopper in the modern era — a goalkeeper whose reflexes, physical presence, and raw athleticism made him virtually unbeatable in one-on-one situations. His 2002 World Cup, where he carried Germany to the final almost single-handedly, was the definitive Shotstopper performance. His vocal commanding style and six-yard-box dominance defined the role.",
    keyTraits: ["Reflexes", "Physical presence", "Six-yard-box dominance", "Shot-stopping athleticism"],
  },

  // ── CD ──────────────────────────────────────────────────────────────────

  Libero: {
    role: "Libero",
    origin: "Italian",
    position: "CD",
    iconPlayer: "Franz Beckenbauer",
    nationality: "Germany",
    peakScore: 97,
    peakEra: "1972–1976",
    peakClub: "Bayern Munich",
    peakFormation: "Libero system",
    snapshot:
      "Beckenbauer didn't just play the Libero — he invented it. Operating behind the back line with total freedom, he carried the ball into midfield, sprayed passes across the pitch, and orchestrated attacks from deep. Three consecutive European Cups and a World Cup as captain proved the concept. Every ball-playing centre-back since is measured against Der Kaiser's blueprint of defensive intelligence fused with creative vision.",
    keyTraits: ["Progressive carrying", "Passing range", "Spatial awareness", "Leadership"],
  },

  Sweeper: {
    role: "Sweeper",
    position: "CD",
    iconPlayer: "Franco Baresi",
    nationality: "Italy",
    peakScore: 96,
    peakEra: "1988–1994",
    peakClub: "AC Milan",
    peakFormation: "4-4-2 / 3-5-2",
    snapshot:
      "Baresi read the game two passes ahead, sweeping behind Milan's line with an elegance that made defending look effortless. Under Sacchi and Capello he anchored the greatest defensive unit in history — Milan conceded 14 goals in 34 Serie A matches in 1993–94. His positioning was so precise he rarely needed to tackle; he simply appeared where the ball was going. The 1994 World Cup final, played six weeks after knee surgery, encapsulates his competitive fury.",
    keyTraits: ["Positional intelligence", "Reading of play", "Interceptions", "Composure"],
  },

  Stopper: {
    role: "Stopper",
    culturalName: "Stopper",
    origin: "German",
    position: "CD",
    iconPlayer: "Fabio Cannavaro",
    nationality: "Italy",
    peakScore: 95,
    peakEra: "2004–2006",
    peakClub: "Juventus / Italy",
    peakFormation: "4-4-2",
    snapshot:
      "At 5'9\" Cannavaro had no right to dominate aerially, yet his timing, leap, and reading of the game made him the world's best defender. His 2006 Ballon d'Or — the last defender to win it — was earned through a World Cup where he was physically untouchable, winning every duel and marshalling Italy's backline to near-perfection. Pure front-foot aggression married to anticipation that bordered on clairvoyance.",
    keyTraits: ["Aerial timing", "Tackling precision", "Anticipation", "Aggression"],
  },

  // ── WD ──────────────────────────────────────────────────────────────────

  "Inverted Full-Back": {
    role: "Inverted Full-Back",
    culturalName: "Invertido",
    origin: "Spanish",
    position: "WD",
    iconPlayer: "Philipp Lahm",
    nationality: "Germany",
    peakScore: 95,
    peakEra: "2013–2014",
    peakClub: "Bayern Munich",
    peakFormation: "4-1-2-1-2 / 4-3-3",
    snapshot:
      "When Guardiola moved Lahm from right-back to a hybrid midfield role, he created the template for the inverted full-back. Lahm's football intelligence let him seamlessly tuck inside from the flank, creating a midfield diamond in possession and a back four in defence. His positional discipline was robotic — he always knew where to be. The 2013–14 treble-chasing Bayern side proved that a full-back could be the tactical keystone of an entire system.",
    keyTraits: ["Tactical intelligence", "Positional versatility", "Passing accuracy", "Defensive discipline"],
  },

  Lateral: {
    role: "Lateral",
    origin: "Portuguese",
    position: "WD",
    iconPlayer: "Cafu",
    nationality: "Brazil",
    peakScore: 95,
    peakEra: "1997–2002",
    peakClub: "Roma / Brazil",
    peakFormation: "3-5-2 / 4-4-2",
    snapshot:
      "Cafu was the ultimate overlapping full-back — inexhaustible energy, blistering pace, and the end product to match. He appeared in three consecutive World Cup finals, winning two, bombing forward relentlessly while never neglecting his defensive duties. At Roma he was Serie A's best right-back, combining with Totti to create a devastating right flank. His ability to sustain lung-busting overlapping runs for 90 minutes set the standard every modern attacking full-back chases.",
    keyTraits: ["Stamina", "Pace", "Crossing", "Recovery runs"],
  },

  Fluidificante: {
    role: "Fluidificante",
    origin: "Italian",
    position: "WD",
    iconPlayer: "Javier Zanetti",
    nationality: "Argentina",
    peakScore: 93,
    peakEra: "1998–2010",
    peakClub: "Inter Milan",
    peakFormation: "3-5-2",
    snapshot:
      "Zanetti's 858 appearances for Inter tell the story of the ultimate wing-back — a player who could operate on either flank with equal effectiveness, covering every blade of grass for over a decade. Under Mourinho in 2010 he was essential to Inter's treble, providing tireless width in a 3-5-2 that demanded total commitment from the wing-backs. His consistency, versatility, and engine were unmatched at the position.",
    keyTraits: ["Stamina", "Versatility", "Defensive awareness", "Consistency"],
  },

  Corredor: {
    role: "Corredor",
    origin: "Spanish",
    position: "WD",
    iconPlayer: "Kyle Walker",
    nationality: "England",
    peakScore: 91,
    peakEra: "2017–2022",
    peakClub: "Manchester City",
    peakFormation: "4-3-3 / 3-2-2-3",
    snapshot:
      "Walker's elite pace made him the definitive pace-based full-back of his generation — a defender who could recover any situation with his speed in transition. Under Guardiola he evolved from a raw athletic talent into a disciplined tactical weapon, using his acceleration to push high in possession and recover instantly when City lost the ball. His ability to nullify the world's fastest forwards while also contributing forward made him invaluable.",
    keyTraits: ["Explosive pace", "Recovery speed", "Transition play", "Defensive athleticism"],
  },

  // ── DM ──────────────────────────────────────────────────────────────────

  Regista: {
    role: "Regista",
    origin: "Italian",
    position: "DM",
    iconPlayer: "Andrea Pirlo",
    nationality: "Italy",
    peakScore: 96,
    peakEra: "2003–2006 / 2012–2013",
    peakClub: "AC Milan / Juventus",
    peakFormation: "4-3-1-2 / 3-5-2",
    snapshot:
      "Pirlo is the Regista. Sitting deep in front of the defence, he controlled the tempo of entire matches with metronomic passing, switching play with 60-yard diagonals as casually as five-yard layoffs. At Milan he orchestrated two Champions League finals; at Juventus he proved age-proof, dragging Conte's side to three consecutive Scudetti. His vision and composure under pressure were supernatural — the ball always found him, and he always knew what to do with it.",
    keyTraits: ["Passing range", "Tempo control", "Vision", "Composure"],
  },

  Anchor: {
    role: "Anchor",
    origin: "French",
    position: "DM",
    iconPlayer: "Sergio Busquets",
    nationality: "Spain",
    peakScore: 95,
    peakEra: "2009–2012",
    peakClub: "Barcelona",
    peakFormation: "4-3-3",
    snapshot:
      "Busquets was the invisible genius of Guardiola's Barcelona and Spain's golden generation. While Xavi and Iniesta received the plaudits, Busquets was the tactical fulcrum — always available, always in the right position, recycling possession with zero waste. His ability to receive between the lines under pressure, turn, and play forward was unique. Vicente del Bosque said it best: 'You watch the game, you don't see Busquets. You watch Busquets, you see the whole game.'",
    keyTraits: ["Positional discipline", "Press resistance", "Spatial awareness", "Ball retention"],
  },

  Pivote: {
    role: "Pivote",
    origin: "Spanish",
    position: "DM",
    iconPlayer: "Rodri",
    nationality: "Spain",
    peakScore: 93,
    peakEra: "2022–2024",
    peakClub: "Manchester City",
    peakFormation: "4-3-3 / 3-2-2-3",
    snapshot:
      "Rodri is the modern midfield brain — a deep midfielder who organizes the entire team's shape, reads the game before it happens, and distributes with impeccable precision. His 2024 Ballon d'Or was the recognition of a player who elevated Manchester City and Spain by making both sides function as cohesive tactical units. He wins the ball back, dictates tempo, and controls space simultaneously.",
    keyTraits: ["Tactical organization", "Reading of play", "Distribution", "Shape control"],
  },

  Volante: {
    role: "Volante",
    origin: "Brazilian",
    position: "DM",
    iconPlayer: "N'Golo Kanté",
    nationality: "France",
    peakScore: 94,
    peakEra: "2015–2018",
    peakClub: "Leicester City / Chelsea",
    peakFormation: "4-4-2 / 3-4-3",
    snapshot:
      "Kanté's peak was otherworldly — back-to-back Premier League titles with two different clubs, followed by a World Cup. His ground coverage was so extreme that the joke '70% of the Earth is covered by water, the rest is covered by Kanté' barely felt like hyperbole. He won the ball back more than anyone in Europe while maintaining the stamina to support attacks. In Conte's 3-4-3 at Chelsea, he was the engine that made the entire system function.",
    keyTraits: ["Ball recovery", "Ground coverage", "Pressing intensity", "Stamina"],
  },

  // ── CM ──────────────────────────────────────────────────────────────────

  Mezzala: {
    role: "Mezzala",
    origin: "Italian",
    position: "CM",
    iconPlayer: "Andrés Iniesta",
    nationality: "Spain",
    peakScore: 96,
    peakEra: "2008–2012",
    peakClub: "Barcelona",
    peakFormation: "4-3-3",
    snapshot:
      "Iniesta was the Mezzala perfected — ghosting into half-spaces, carrying the ball through traffic with a first touch that defied physics, and arriving in dangerous positions with the composure to deliver. His 2010 World Cup final goal was merely the punctuation mark on a four-year peak where he was arguably the best player in the world. Alongside Xavi and Busquets he formed the most intelligent midfield triangle football has seen, but it was Iniesta's unpredictability that made it lethal.",
    keyTraits: ["Close control", "Carrying through pressure", "Half-space movement", "Big-game composure"],
  },

  Tuttocampista: {
    role: "Tuttocampista",
    origin: "Italian",
    position: "CM",
    iconPlayer: "Frank Lampard",
    nationality: "England",
    peakScore: 94,
    peakEra: "2004–2010",
    peakClub: "Chelsea",
    peakFormation: "4-3-3",
    snapshot:
      "Lampard scored 211 goals from central midfield — a number that may never be matched. His late runs into the box were timed with the precision of a striker, yet he also averaged 12km per match and contributed defensively. Under Mourinho's Chelsea he was the heartbeat: a midfielder who could tackle in his own box and finish in the opponent's in the same move. His penalty-area intelligence was unrivalled — he saw the goal before anyone else saw the pass.",
    keyTraits: ["Late arriving runs", "Finishing from midfield", "Stamina", "Tactical intelligence"],
  },

  Carrilero: {
    role: "Carrilero",
    origin: "Spanish",
    position: "CM",
    iconPlayer: "Blaise Matuidi",
    nationality: "France",
    peakScore: 88,
    peakEra: "2016–2018",
    peakClub: "Juventus",
    peakFormation: "4-3-1-2",
    snapshot:
      "Matuidi was the ultimate wide shuttle — a midfielder who covered the left channel so completely that his winger could push forward without fear. At Juventus under Allegri, he operated as a left-sided CM in the 4-3-1-2, screening the fullback, pressing the opposition's right-sided attackers, and recycling possession with simple, effective passes. He ran 12km+ every match and never stopped. Valverde at Real Madrid and Herrera at Atletico carry the same DNA: tireless, tactically disciplined, the unglamorous engine that makes attacking systems function.",
    keyTraits: ["Flank screening", "Tireless running", "Tactical discipline", "Pressing intensity"],
  },

  Metodista: {
    role: "Metodista",
    origin: "Italian",
    position: "CM",
    iconPlayer: "Xavi",
    nationality: "Spain",
    peakScore: 97,
    peakEra: "2008–2012",
    peakClub: "Barcelona",
    peakFormation: "4-3-3",
    snapshot:
      "Xavi was the metronome of the greatest club and international sides ever assembled. His passing accuracy consistently exceeded 90% — not through safe sideways passes, but through constant, probing forward movement that suffocated opponents. He completed more passes per 90 minutes than any midfielder in Europe while also pressing relentlessly to win the ball back within seconds. Euro 2008, World Cup 2010, Euro 2012 — Xavi was the player of the tournament in all three. The Deep Playmaker at its absolute zenith.",
    keyTraits: ["Passing accuracy", "Tempo control", "Press resistance", "Spatial scanning"],
  },

  Relayeur: {
    role: "Relayeur",
    origin: "French",
    position: "CM",
    iconPlayer: "Yaya Touré",
    nationality: "Ivory Coast",
    peakScore: 93,
    peakEra: "2011–2014",
    peakClub: "Manchester City",
    peakFormation: "4-2-3-1",
    snapshot:
      "Touré at City was an unstoppable force — a midfielder with the physique of a centre-back, the engine of a defensive midfielder, and the goal threat of a forward. He covered every inch of the pitch at pace, arriving box to box in phases both teams could barely track. His 2013–14 season — 24 goals from central midfield — was the definitive Relayeur performance: tireless, powerful, decisive.",
    keyTraits: ["Physical engine", "Box-to-box stamina", "Goalscoring runs", "Powerful carrying"],
  },

  // ── WM ──────────────────────────────────────────────────────────────────

  Winger: {
    role: "Winger",
    position: "WM",
    iconPlayer: "Garrincha",
    nationality: "Brazil",
    peakScore: 95,
    peakEra: "1958–1962",
    peakClub: "Botafogo / Brazil",
    peakFormation: "4-2-4",
    snapshot:
      "Garrincha was the joy of football made human — born with curved legs that gave him an impossible body swerve no defender could read. In two World Cups he was virtually unbeatable: Brazil never lost a match when Pelé and Garrincha played together. In the 1962 World Cup he dragged Brazil to the title almost single-handedly after Pelé's injury, scoring and creating with abandon. He is the Traditional Winger distilled to its purest essence: take on your man, beat him, deliver the ball, entertain.",
    keyTraits: ["Body feints", "1v1 mastery", "Crossing", "Entertainment"],
  },

  Tornante: {
    role: "Tornante",
    origin: "Italian",
    position: "WM",
    iconPlayer: "Christian Maggio",
    nationality: "Italy",
    peakScore: 85,
    peakEra: "2011–2014",
    peakClub: "Napoli",
    peakFormation: "3-4-3 / 4-3-3",
    snapshot:
      "Maggio epitomised the Tornante — a wide midfielder who worked both phases of the game selflessly, tracking back to help defensively and bombing forward to provide width in attack. Under Mazzarri at Napoli he was a cog in one of the most effective wide systems in Serie A, covering his entire flank tirelessly. The Tornante asks nothing glamorous and delivers everything functional.",
    keyTraits: ["Two-way running", "Defensive work rate", "Width provision", "Stamina"],
  },

  "False Winger": {
    role: "False Winger",
    position: "WM",
    iconPlayer: "David Silva",
    nationality: "Spain",
    peakScore: 93,
    peakEra: "2010–2014",
    peakClub: "Manchester City",
    peakFormation: "4-2-3-1",
    snapshot:
      "Silva was the conjurer — nominally starting wide but constantly drifting inside to find pockets of space between opposition lines. His first touch killed the ball dead in the tightest spaces, and his vision produced through balls that only he could see. At City under Mancini and Pellegrini, he was the creative heartbeat of two title-winning sides, linking play with a subtlety that made the complex look effortless. The quintessential false winger: imagination over pace.",
    keyTraits: ["First touch", "Vision", "Half-space intelligence", "Weight of pass"],
  },

  Shuttler: {
    role: "Shuttler",
    position: "WM",
    iconPlayer: "Ryan Giggs",
    nationality: "Wales",
    peakScore: 93,
    peakEra: "1993–1999",
    peakClub: "Manchester United",
    peakFormation: "4-4-2",
    snapshot:
      "Young Giggs was electrifying — a winger who received the ball on the left and simply ran at defenders with terrifying pace and balance. His FA Cup semi-final goal against Arsenal in 1999, dribbling past five players, was the definitive wide shuttle moment. What elevated Giggs was his ability to beat men on either side, cutting inside or going to the byline with equal menace. His stamina and pace to cover the flank end to end made him the prototype Shuttler.",
    keyTraits: ["Dribbling at pace", "Balance", "Acceleration", "Flank coverage"],
  },

  "Wide Provider": {
    role: "Wide Provider",
    position: "WM",
    iconPlayer: "David Beckham",
    nationality: "England",
    peakScore: 93,
    peakEra: "1997–2003",
    peakClub: "Manchester United",
    peakFormation: "4-4-2",
    snapshot:
      "Beckham's right foot was the most precise delivery instrument in football history. From the right touchline he could find a striker's head from 50 yards with metronomic accuracy, and his set-piece mastery produced goals and assists that defied geometry. The 1999 treble season — capped by those two corner kicks in Barcelona — was the summit of a player whose crossing, free kicks, and work rate from wide made Ferguson's 4-4-2 devastatingly effective.",
    keyTraits: ["Crossing accuracy", "Set-piece delivery", "Work rate", "Passing range"],
  },

  // ── AM ──────────────────────────────────────────────────────────────────

  Trequartista: {
    role: "Trequartista",
    origin: "Italian",
    position: "AM",
    iconPlayer: "Zinedine Zidane",
    nationality: "France",
    peakScore: 97,
    peakEra: "2000–2006",
    peakClub: "Real Madrid / France",
    peakFormation: "4-2-3-1 / 4-3-1-2",
    snapshot:
      "Zidane was football as art — a 6'1\" number 10 who moved with a ballet dancer's grace and controlled the ball as if it were magnetised to his boots. His two goals in the 1998 World Cup final, his volley in the 2002 Champions League final, and his masterclass carrying France to the 2006 World Cup final define the Trequartista: a player who bends the match to his will through sheer individual genius. On his day, he was simply the most talented footballer who ever lived.",
    keyTraits: ["First touch", "Body feints", "Vision", "Big-game dominance"],
  },

  "Seconda Punta": {
    role: "Seconda Punta",
    origin: "Italian",
    position: "AM",
    iconPlayer: "Thomas Müller",
    nationality: "Germany",
    peakScore: 93,
    peakEra: "2010–2015",
    peakClub: "Bayern Munich",
    peakFormation: "4-2-3-1",
    snapshot:
      "Müller scored 10 goals at the 2010 World Cup aged 20 without possessing elite pace, dribbling, or technique. His genius was positional — an intuitive understanding of where space would appear before it existed. As a Shadow Striker behind the centre-forward, he made runs that defenders couldn't track because they defied conventional movement patterns. He coined the term 'Raumdeuter' (space interpreter) and at his peak, no player in the world was more dangerous arriving late in the penalty area.",
    keyTraits: ["Off-the-ball movement", "Spatial intelligence", "Finishing instinct", "Positional versatility"],
  },

  Enganche: {
    role: "Enganche",
    origin: "Argentine",
    position: "AM",
    iconPlayer: "Juan Román Riquelme",
    nationality: "Argentina",
    peakScore: 93,
    peakEra: "2005–2007",
    peakClub: "Villarreal / Boca Juniors",
    peakFormation: "4-3-1-2",
    snapshot:
      "Riquelme was the last great Enganche — a number 10 who stood almost still in the centre of the pitch and yet controlled everything. He saw passes others couldn't conceive, threaded balls through gaps that seemed mathematically impossible, and bent matches to his will through pure intelligence and touch. His 2005–06 Champions League campaign with Villarreal proved a cultured playmaker could still dominate in modern football when given the right system.",
    keyTraits: ["Passing vision", "Thread-the-needle delivery", "Positional intelligence", "Touch"],
  },

  Boxcrasher: {
    role: "Boxcrasher",
    position: "AM",
    iconPlayer: "Frank Lampard",
    nationality: "England",
    peakScore: 94,
    peakEra: "2004–2010",
    peakClub: "Chelsea",
    peakFormation: "4-3-3",
    snapshot:
      "Lampard was the prototype Boxcrasher — an attacking midfielder who arrived in the penalty area with the timing and finishing of a striker while also covering ground defensively. His 211 goals from central midfield are the benchmark for late-arriving, box-crashing play. At Chelsea under Mourinho his runs from deep into the box were timed with such precision that defenders rarely tracked him until it was too late.",
    keyTraits: ["Late arriving runs", "Finishing from midfield", "Box-crashing timing", "Tactical intelligence"],
  },

  // ── WF ──────────────────────────────────────────────────────────────────

  "Inverted Winger": {
    role: "Inverted Winger",
    position: "WF",
    iconPlayer: "Arjen Robben",
    nationality: "Netherlands",
    peakScore: 94,
    peakEra: "2009–2014",
    peakClub: "Bayern Munich",
    peakFormation: "4-2-3-1",
    snapshot:
      "Everyone knew Robben would cut inside from the right onto his left foot — and nobody could stop him. That one move, executed with explosive acceleration, balletic balance, and a curling finish into the far corner, was the most devastating single action in modern football. At Bayern under Heynckes and Guardiola, he was the decisive match-winner in the biggest games, including the 2013 Champions League final. The Inverted Winger role exists in its current form because of Robben.",
    keyTraits: ["Cut inside finish", "Explosive acceleration", "Left-foot curl", "Big-game decisiveness"],
  },

  Raumdeuter: {
    role: "Raumdeuter",
    origin: "German",
    position: "WF",
    iconPlayer: "Thomas Müller",
    nationality: "Germany",
    peakScore: 94,
    peakEra: "2012–2016",
    peakClub: "Bayern Munich",
    peakFormation: "4-2-3-1 / 3-5-2",
    snapshot:
      "Müller coined the term Raumdeuter — 'space interpreter' — because no existing football position described what he did. Operating between the lines, he made runs into spaces that didn't exist yet, arriving in the penalty area with ghostly timing. Under Heynckes and Guardiola at Bayern, he was the player who turned territorial dominance into goals: 2012–13 saw him contribute to 47 goals in a treble-winning season. His movement is unteachable — a sixth sense for where the ball will be, not where it is.",
    keyTraits: ["Space interpretation", "Arrival timing", "Off-ball intelligence", "Positional instinct"],
  },

  Inventor: {
    role: "Inventor",
    origin: "English",
    position: "WF",
    iconPlayer: "Bernardo Silva",
    nationality: "Portugal",
    peakScore: 92,
    peakEra: "2018–2024",
    peakClub: "Manchester City",
    peakFormation: "4-3-3 / 3-2-2-3",
    snapshot:
      "Bernardo Silva proved that a wide forward could dominate without pace. Operating as an Inventor from wide under Guardiola, he drifted inside to create numerical superiority in the half-spaces, finding pockets that shouldn't exist and playing passes that shouldn't be possible. His work rate off the ball was as elite as his technique on it — he pressed like a midfielder and created like a 10 while nominally playing wide. The 2022–23 treble season, where he was arguably City's best player, was the role's masterclass.",
    keyTraits: ["Technical precision", "Half-space occupation", "Work rate off the ball", "Vision"],
  },

  Extremo: {
    role: "Extremo",
    origin: "Portuguese",
    position: "WF",
    iconPlayer: "Kylian Mbappé",
    nationality: "France",
    peakScore: 94,
    peakEra: "2018–2022",
    peakClub: "PSG / France",
    peakFormation: "4-2-3-1 / 3-4-3",
    snapshot:
      "Mbappé at 19 became only the second teenager to score in a World Cup final, and by 23 he had a hat-trick in one — the defining Wide Forward of his generation. His pace is genuinely frightening; defenders cannot get tight because he will burn them in behind, and they cannot drop off because he will run at them. At PSG and with France, his ability to stretch defences from the left flank and finish with either foot at full speed produced a goal record that rivals the all-time greats.",
    keyTraits: ["Devastating pace", "Finishing at speed", "Acceleration", "Movement in behind"],
  },

  // ── CF ──────────────────────────────────────────────────────────────────

  Poacher: {
    role: "Poacher",
    position: "CF",
    iconPlayer: "Gerd Müller",
    nationality: "Germany",
    peakScore: 97,
    peakEra: "1970–1974",
    peakClub: "Bayern Munich / West Germany",
    peakFormation: "4-3-3 / 4-4-2",
    snapshot:
      "Müller scored 365 goals in 427 Bundesliga matches and 68 in 62 internationals — numbers that seemed fictional until they were verified. Der Bomber lived in the six-yard box, scoring with an instinct that defied analysis: he was rarely the fastest, tallest, or most technically gifted player on the pitch, yet he scored more than all of them. His predatory finishing, supernatural reactions, and movement inside the penalty area remain the purest expression of what a Poacher can be. The 1970 World Cup (10 goals) and 1972 European Championship were his zenith.",
    keyTraits: ["Instinctive finishing", "Penalty-area movement", "Reactions", "Positioning"],
  },

  Spearhead: {
    role: "Spearhead",
    position: "CF",
    iconPlayer: "Roberto Firmino",
    nationality: "Brazil",
    peakScore: 91,
    peakEra: "2017–2020",
    peakClub: "Liverpool",
    peakFormation: "4-3-3",
    snapshot:
      "Firmino redefined what a centre-forward could be in Klopp's gegenpressing system — a striker whose primary job was defending. His pressing triggers, ability to win the ball back in the opponent's third, and selfless movement to create space for Salah and Mane made Liverpool's front three the most feared in Europe. The 2018–19 Champions League win and 2019–20 Premier League title were built on Firmino's willingness to sacrifice his own numbers for the team's success. He proved that the Spearhead was not a compromise but a weapon.",
    keyTraits: ["Pressing intelligence", "Work rate", "Link-up play", "Selfless movement"],
  },

  "Falso Nove": {
    role: "Falso Nove",
    origin: "Spanish",
    position: "CF",
    iconPlayer: "Lionel Messi",
    nationality: "Argentina",
    peakScore: 97,
    peakEra: "2009–2012",
    peakClub: "Barcelona",
    peakFormation: "4-3-3",
    snapshot:
      "Messi didn't just play the False 9 — he perfected it to a level that will never be replicated. When Guardiola moved him centrally against Real Madrid in May 2009, football changed. Dropping deep to receive, he dragged centre-backs into midfield, creating space for runners, then burst forward with the ball at his feet to score himself. In 2011–12 he scored 73 goals in a season, 91 in a calendar year, while operating as a creator and a finisher simultaneously. The highest peak any footballer has ever reached in any role.",
    keyTraits: ["Dropping deep to create", "Dribbling through lines", "Vision", "Finishing versatility"],
  },

  "Prima Punta": {
    role: "Prima Punta",
    origin: "Italian",
    position: "CF",
    iconPlayer: "Didier Drogba",
    nationality: "Ivory Coast",
    peakScore: 93,
    peakEra: "2006–2012",
    peakClub: "Chelsea",
    peakFormation: "4-3-3 / 4-4-2",
    snapshot:
      "Drogba was the ultimate big-game Target Man — a 6'2\" force of nature who combined aerial dominance, physical power, and a finisher's instinct that came alive in finals. He scored in four FA Cup finals, the League Cup final, and the 2012 Champions League final where his header forced extra time and his penalty sealed the trophy. Under Mourinho he was Chelsea's reference point, holding the ball up, bullying defenders, and bringing teammates into play before ruthlessly converting chances himself.",
    keyTraits: ["Aerial dominance", "Physical power", "Big-game scoring", "Hold-up play"],
  },
};

/**
 * Get the role icon for a given tactical role name.
 * Returns null if no icon is defined for the role.
 */
export function getRoleIcon(roleName: string): RoleIcon | null {
  return ROLE_ICONS[roleName] ?? null;
}

/**
 * Get all role icons grouped by position.
 */
export function getRoleIconsByPosition(): Record<string, RoleIcon[]> {
  const grouped: Record<string, RoleIcon[]> = {};
  for (const icon of Object.values(ROLE_ICONS)) {
    if (!grouped[icon.position]) grouped[icon.position] = [];
    grouped[icon.position].push(icon);
  }
  return grouped;
}
