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

  "Shot Stopper": {
    role: "Shot Stopper",
    culturalName: "Torwart",
    origin: "German",
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

  // ── CD ──────────────────────────────────────────────────────────────────

  "Ball-Playing CB": {
    role: "Ball-Playing CB",
    culturalName: "Libero",
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

  Stopper: {
    role: "Stopper",
    culturalName: "Vorstopper",
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

  "Ball-Carrying CB": {
    role: "Ball-Carrying CB",
    culturalName: "Zagueiro",
    origin: "Brazilian",
    position: "CD",
    iconPlayer: "Virgil van Dijk",
    nationality: "Netherlands",
    peakScore: 93,
    peakEra: "2018–2020",
    peakClub: "Liverpool",
    peakFormation: "4-3-3",
    snapshot:
      "Van Dijk transformed Liverpool from top-four hopefuls into Champions League and Premier League winners by combining physical dominance with the composure to carry the ball 30 yards into midfield. At his peak, opponents simply could not dribble past him — he went the entire 2018–19 season without being beaten one-on-one. His progressive passing and ability to step into midfield channels made him the modern template for the ball-carrying centre-back.",
    keyTraits: ["Progressive carries", "Physical dominance", "Composure under pressure", "Recovery pace"],
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

  "Overlapping Full-Back": {
    role: "Overlapping Full-Back",
    culturalName: "Lateral",
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

  "Wing-Back": {
    role: "Wing-Back",
    culturalName: "Carrilero",
    origin: "Spanish",
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
    culturalName: "Sentinelle",
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

  "Ball-Winner": {
    role: "Ball-Winner",
    culturalName: "Volante",
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

  "Destroyer-Creator": {
    role: "Destroyer-Creator",
    position: "DM",
    iconPlayer: "Patrick Vieira",
    nationality: "France",
    peakScore: 94,
    peakEra: "1998–2004",
    peakClub: "Arsenal",
    peakFormation: "4-4-2",
    snapshot:
      "Vieira was the complete midfielder — 6'4\" of power, grace, and fury who could tackle like a destroyer and pass like a playmaker. He anchored Arsenal's Invincibles and France's 1998 World Cup winners, dominating the centre of the pitch in both directions. His duels with Keane defined an era. No midfielder since has combined his physical intensity with his technical quality and range of passing from deep.",
    keyTraits: ["Physical dominance", "Tackling", "Passing range", "Leadership"],
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

  "Box-to-Box": {
    role: "Box-to-Box",
    culturalName: "Tuttocampista",
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

  "Deep Playmaker": {
    role: "Deep Playmaker",
    culturalName: "Metodista",
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

  // ── WM ──────────────────────────────────────────────────────────────────

  "Wide Playmaker": {
    role: "Wide Playmaker",
    culturalName: "Fantasista",
    origin: "Italian",
    position: "WM",
    iconPlayer: "David Silva",
    nationality: "Spain",
    peakScore: 93,
    peakEra: "2010–2014",
    peakClub: "Manchester City",
    peakFormation: "4-2-3-1",
    snapshot:
      "Silva was the conjurer — nominally starting wide but constantly drifting inside to find pockets of space between opposition lines. His first touch killed the ball dead in the tightest spaces, and his vision produced through balls that only he could see. At City under Mancini and Pellegrini, he was the creative heartbeat of two title-winning sides, linking play with a subtlety that made the complex look effortless. The quintessential wide playmaker: imagination over pace.",
    keyTraits: ["First touch", "Vision", "Half-space intelligence", "Weight of pass"],
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

  "Direct Winger": {
    role: "Direct Winger",
    position: "WM",
    iconPlayer: "Ryan Giggs",
    nationality: "Wales",
    peakScore: 93,
    peakEra: "1993–1999",
    peakClub: "Manchester United",
    peakFormation: "4-4-2",
    snapshot:
      "Young Giggs was electrifying — a winger who received the ball on the left and simply ran at defenders with terrifying pace and balance. His FA Cup semi-final goal against Arsenal in 1999, dribbling past five players, was the definitive Direct Winger moment. What elevated Giggs was his ability to beat men on either side, cutting inside or going to the byline with equal menace. Before he reinvented himself as a central midfielder, he was the most exciting wide player in English football.",
    keyTraits: ["Dribbling at pace", "Balance", "Acceleration", "Unpredictability"],
  },

  "Traditional Winger": {
    role: "Traditional Winger",
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

  "Advanced Playmaker": {
    role: "Advanced Playmaker",
    position: "AM",
    iconPlayer: "Kevin De Bruyne",
    nationality: "Belgium",
    peakScore: 95,
    peakEra: "2017–2023",
    peakClub: "Manchester City",
    peakFormation: "4-3-3 / 3-2-2-3",
    snapshot:
      "De Bruyne elevated the Advanced Playmaker role to its modern peak — linking midfield to attack with passes that were simultaneously powerful, precise, and perfectly weighted. His crossing from deep, through balls into channels, and long-range shooting made him impossible to defend against because no single strategy could nullify all his weapons. Four Premier League titles in five years, with De Bruyne consistently the most creative player in the league, proved his dominance was sustained, not sporadic.",
    keyTraits: ["Passing power and precision", "Crossing from deep", "Vision", "Long-range shooting"],
  },

  "Shadow Striker": {
    role: "Shadow Striker",
    culturalName: "Seconda Punta",
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

  // ── WF ──────────────────────────────────────────────────────────────────

  "Inside Forward": {
    role: "Inside Forward",
    position: "WF",
    iconPlayer: "Arjen Robben",
    nationality: "Netherlands",
    peakScore: 94,
    peakEra: "2009–2014",
    peakClub: "Bayern Munich",
    peakFormation: "4-2-3-1",
    snapshot:
      "Everyone knew Robben would cut inside from the right onto his left foot — and nobody could stop him. That one move, executed with explosive acceleration, balletic balance, and a curling finish into the far corner, was the most devastating single action in modern football. At Bayern under Heynckes and Guardiola, he was the decisive match-winner in the biggest games, including the 2013 Champions League final. The Inside Forward role exists in its current form because of Robben.",
    keyTraits: ["Cut inside finish", "Explosive acceleration", "Left-foot curl", "Big-game decisiveness"],
  },

  "Inverted Winger": {
    role: "Inverted Winger",
    culturalName: "Inventor",
    origin: "English",
    position: "WF",
    iconPlayer: "Bernardo Silva",
    nationality: "Portugal",
    peakScore: 92,
    peakEra: "2018–2024",
    peakClub: "Manchester City",
    peakFormation: "4-3-3 / 3-2-2-3",
    snapshot:
      "Bernardo Silva proved that a wide forward could dominate without pace. Operating as an Inverted Winger under Guardiola, he drifted inside to create numerical superiority in the half-spaces, finding pockets that shouldn't exist and playing passes that shouldn't be possible. His work rate off the ball was as elite as his technique on it — he pressed like a midfielder and created like a 10 while nominally playing wide. The 2022–23 treble season, where he was arguably City's best player, was the role's masterclass.",
    keyTraits: ["Technical precision", "Half-space occupation", "Work rate off the ball", "Vision"],
  },

  "Wide Forward": {
    role: "Wide Forward",
    culturalName: "Extremo",
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

  "Target Man": {
    role: "Target Man",
    culturalName: "Prima Punta",
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

  "False 9": {
    role: "False 9",
    culturalName: "Falso Nove",
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

  "Complete Forward": {
    role: "Complete Forward",
    position: "CF",
    iconPlayer: "Ronaldo Nazário",
    nationality: "Brazil",
    peakScore: 97,
    peakEra: "1996–2002",
    peakClub: "Barcelona / Inter / Real Madrid",
    peakFormation: "4-4-2 / 3-5-2",
    snapshot:
      "R9 at his peak was the most complete forward football has ever produced — he could score from anywhere, create for others, dribble past entire defences, head the ball, and play with his back to goal. His 1996–97 season at Barcelona (47 goals) and the 2002 World Cup (8 goals, including the final) bookended a peak interrupted by devastating injuries but never diminished in brilliance. When fully fit, Ronaldo possessed a combination of pace, power, technique, and finishing that no centre-forward before or since has matched.",
    keyTraits: ["Explosive pace with the ball", "Finishing from any angle", "Dribbling power", "Complete skill set"],
  },

  "Pressing Forward": {
    role: "Pressing Forward",
    position: "CF",
    iconPlayer: "Roberto Firmino",
    nationality: "Brazil",
    peakScore: 91,
    peakEra: "2017–2020",
    peakClub: "Liverpool",
    peakFormation: "4-3-3",
    snapshot:
      "Firmino redefined what a centre-forward could be in Klopp's gegenpressing system — a striker whose primary job was defending. His pressing triggers, ability to win the ball back in the opponent's third, and selfless movement to create space for Salah and Mane made Liverpool's front three the most feared in Europe. The 2018–19 Champions League win and 2019–20 Premier League title were built on Firmino's willingness to sacrifice his own numbers for the team's success. He proved that the Pressing Forward was not a compromise but a weapon.",
    keyTraits: ["Pressing intelligence", "Work rate", "Link-up play", "Selfless movement"],
  },

  Raumdeuter: {
    role: "Raumdeuter",
    origin: "German",
    position: "CF",
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
