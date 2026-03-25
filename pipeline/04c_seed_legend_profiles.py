"""
04c_seed_legend_profiles.py — Seed curated skillsets and playing styles for legends.

Assigns compound archetypes (Primary-Secondary), best_role, best_role_score,
and playing_style (via scouting_notes) for ~200 legends with peak >= 90.

Usage:
    python pipeline/04c_seed_legend_profiles.py              # run
    python pipeline/04c_seed_legend_profiles.py --dry-run    # preview
    python pipeline/04c_seed_legend_profiles.py --player ID  # single player
"""

import argparse
import psycopg2

from config import POSTGRES_DSN

# ─────────────────────────────────────────────────────────────────────────────
# (person_id): (archetype, best_role, best_role_score, playing_style)
#
# Compound rules enforced:
#   Mental:   Controller, Commander, Creator
#   Physical: Target, Sprinter, Powerhouse
#   Tactical: Cover, Engine, Destroyer
#   Technical: Dribbler, Passer, Striker
#   GK:       GK
# Primary-Secondary must come from DIFFERENT categories.
# ─────────────────────────────────────────────────────────────────────────────

LEGEND_SEEDS = {
    # ══════════════════════════════════════════════════════════════════════════
    # GOAT TIER (95-96)
    # ══════════════════════════════════════════════════════════════════════════

    10296: (
        "Dribbler-Creator", "Complete Forward", 96,
        "Supreme dribbler who could beat entire teams single-handedly. "
        "Combined low centre of gravity with magical close control and devastating finishing."
    ),  # Diego Maradona

    16251: (
        "Striker-Creator", "Complete Forward", 96,
        "The most complete forward in history — scored over 1,000 goals with breathtaking athleticism. "
        "Combined explosive finishing with vision, creativity, and an instinct for the spectacular."
    ),  # Pelé

    16832: (
        "Striker-Sprinter", "Complete Forward", 96,
        "Explosive pace married to clinical finishing — the most devastating striker of his generation. "
        "Could score from anywhere, at any speed, in any situation."
    ),  # Ronaldo Nazário

    8224: (
        "Commander-Engine", "Complete Forward", 95,
        "The original total footballer — led Real Madrid from the front with relentless energy. "
        "Commanded every area of the pitch, equally capable of scoring, creating, and defending."
    ),  # Alfredo Di Stéfano

    10992: (
        "Striker-Powerhouse", "Prima Punta", 95,
        "Lethal left foot with unrivalled finishing instinct. "
        "Compact, powerful, and devastatingly clinical inside the box — scored at nearly a goal a game."
    ),  # Ferenc Puskás

    11165: (
        "Controller-Cover", "Libero", 95,
        "Invented the modern libero — composed on the ball, elegant in possession, "
        "and read the game two moves ahead. Redefined what a defender could be."
    ),  # Franz Beckenbauer

    11267: (
        "Dribbler-Sprinter", "Extremo", 95,
        "Dribbling wizard with bent legs and a joyful soul. "
        "Terrorised defenders with feints, pace, and an unpredictable style that could not be coached or contained."
    ),  # Garrincha

    12783: (
        "Creator-Dribbler", "Falso Nove", 95,
        "Total football visionary who could play anywhere and dominate everywhere. "
        "Combined balletic technique with tactical genius — the turn, the drag-back, the impossible pass."
    ),  # Johan Cruyff

    13869: (
        "GK-Commander", "Torwart", 95,
        "The Black Spider — the only goalkeeper to win the Ballon d'Or. "
        "Revolutionary shot-stopper who commanded his area with authority and invented the art of goalkeeping."
    ),  # Lev Yashin

    16077: (
        "Cover-Commander", "Lateral", 95,
        "The perfect defender — anticipated danger before it materialised. "
        "Elegant, intelligent, and virtually impossible to beat one-on-one across 25 years at the top."
    ),  # Paolo Maldini

    18787: (
        "Creator-Dribbler", "Metodista", 95,
        "Balletic first touch, devastating turn. Controlled tempo with effortless elegance "
        "and produced magic in the biggest moments. Made the impossible look routine."
    ),  # Zinedine Zidane

    # ══════════════════════════════════════════════════════════════════════════
    # BALLON D'OR TIER (93-94)
    # ══════════════════════════════════════════════════════════════════════════

    9086: (
        "Striker-Engine", "Metodista", 94,
        "Thunderous long-range shooting combined with graceful movement. "
        "A gentleman who could score from 30 yards and orchestrate play with quiet authority."
    ),  # Bobby Charlton

    9279: (
        "Engine-Sprinter", "Lateral", 94,
        "The overlapping master — explosive pace up and down the right flank for 90 minutes. "
        "An attacking full-back ahead of his time who won everything at club and international level."
    ),  # Cafú

    10507: (
        "GK-Controller", "Sweeper Keeper", 94,
        "Commanding presence with exceptional composure and distribution. "
        "Towering figure who organised defences and launched attacks with pinpoint accuracy."
    ),  # Edwin van der Sar

    10830: (
        "Striker-Sprinter", "Complete Forward", 94,
        "The Black Panther — devastating pace, powerful shooting, and predatory instincts. "
        "Portugal's greatest ever goalscorer with explosive acceleration and clinical finishing."
    ),  # Eusébio

    11140: (
        "Cover-Controller", "Sweeper", 94,
        "Reading the game incarnate — intercepted danger with surgical precision. "
        "Never needed to tackle because he was always in position first. The thinking man's defender."
    ),  # Franco Baresi

    11306: (
        "Dribbler-Creator", "Inside Forward", 94,
        "Mercurial talent who could do things with a football that defied physics. "
        "Mesmerising close control, devastating acceleration, and an eye for the spectacular."
    ),  # George Best

    11401: (
        "GK-Commander", "Torwart", 94,
        "The ultimate commanding goalkeeper — vocal, authoritative, and almost impossible to beat. "
        "Exceptional reflexes combined with unshakeable concentration across a 25-year career."
    ),  # Gianluigi Buffon

    13961: (
        "Cover-Powerhouse", "Lateral", 94,
        "Physical, intelligent defender who combined athletic power with tactical nous. "
        "Capable at centre-back and full-back, with the pace and strength to shut down any attacker."
    ),  # Lilian Thuram

    15082: (
        "Passer-Creator", "Trequartista", 94,
        "Passing genius with supernatural vision — could thread a ball through any defence. "
        "Operated in a different dimension, making the game look effortless with disguised passes and perfect weight."
    ),  # Michael Laudrup

    15114: (
        "Striker-Creator", "Trequartista", 94,
        "Set-piece maestro with extraordinary vision and finishing. "
        "Dominated European football with lethal free kicks, intelligent runs, and an innate sense of goal."
    ),  # Michel Platini

    16676: (
        "Passer-Powerhouse", "Enganche", 94,
        "The left foot of God — devastating crossing, fierce shooting, and the banana free kick. "
        "A creative force with physical presence who terrorised defenders with his technique."
    ),  # Rivellino

    16831: (
        "Dribbler-Creator", "Fantasista", 94,
        "Football's greatest entertainer — samba skills, no-look passes, and elastico feints. "
        "Made the impossible routine and the routine spectacular. Joy of the beautiful game personified."
    ),  # Ronaldinho

    17905: (
        "Sprinter-Striker", "Inside Forward", 94,
        "Explosive pace cutting in from the left flank with devastating finishing. "
        "Glided past defenders before slotting home with ice-cold precision — reinvented the inside forward role."
    ),  # Thierry Henry

    18779: (
        "Creator-Striker", "Trequartista", 94,
        "The White Pelé — sublime technique with deadly finishing from playmaking positions. "
        "Orchestrated attacks with vision, scored with precision, and defined Brazilian flair."
    ),  # Zico

    # ── Peak 93 ───────────────────────────────────────────────────────────────

    8449: (
        "Passer-Controller", "Regista", 93,
        "The maestro regista — conducted play from deep with metronomic passing range. "
        "Redefined the deep-lying playmaker role with languid elegance and devastating set pieces."
    ),  # Andrea Pirlo

    8482: (
        "Dribbler-Controller", "Mezzala", 93,
        "Silk in motion — glided past opponents with close control and perfect body feints. "
        "Combined dribbling mastery with game intelligence to unlock the tightest defences."
    ),  # Andrés Iniesta

    8691: (
        "Striker-Sprinter", "Inside Forward", 93,
        "Le cut inside man — devastating left foot after jinking in from the right wing. "
        "Explosive pace, direct running, and a signature move that defenders could never stop."
    ),  # Arjen Robben

    9090: (
        "Cover-Commander", "Sweeper", 93,
        "The ultimate reading defender — elegant interceptions and impeccable positioning. "
        "Captained England with composure under pressure and never lost his cool."
    ),  # Bobby Moore

    9657: (
        "Powerhouse-Controller", "Tuttocampista", 93,
        "The complete midfielder — combined physical power with technical excellence. "
        "Could dominate in any league, any position, with rocket shots and tactical intelligence."
    ),  # Clarence Seedorf

    9896: (
        "Engine-Dribbler", "Lateral", 93,
        "Relentless attacking full-back with Brazilian flair and tireless energy. "
        "Overlapped constantly, delivered pinpoint crosses, and created chaos down the right."
    ),  # Dani Alves

    10474: (
        "Dribbler-Creator", "Inside Forward", 93,
        "Low centre of gravity, devastating acceleration, and silky close control. "
        "Drifted past defenders as if they weren't there — the most complete dribbler of his generation."
    ),  # Eden Hazard

    11157: (
        "Destroyer-Commander", "Volante", 93,
        "The complete defensive midfielder — combined aerial presence with fierce tackling. "
        "A leader who swept up in front of the back four before transforming into a world-class centre-back."
    ),  # Frank Rijkaard

    11254: (
        "Cover-Controller", "Libero", 93,
        "The elegant libero — read the game with intelligence and carried the ball forward with composure. "
        "A gentleman defender who anticipated everything and tackled only when absolutely necessary."
    ),  # Gaetano Scirea

    11263: (
        "Sprinter-Striker", "Inside Forward", 93,
        "Explosive pace and thunderous left foot — transformed from a winger into a goal machine. "
        "Raw speed, powerful running, and an ability to score in the biggest moments."
    ),  # Gareth Bale

    11381: (
        "Sprinter-Commander", "Lateral", 93,
        "The original overlapping full-back who revolutionised the position. "
        "Combined blistering pace with powerful forward runs and a captain's mentality."
    ),  # Giacinto Facchetti

    11404: (
        "Creator-Passer", "Trequartista", 93,
        "The Golden Boy of Italian football — sublime vision and delicate touch. "
        "Played with artistry and imagination, threading passes with impeccable precision."
    ),  # Gianni Rivera

    11944: (
        "GK-Cover", "Torwart", 93,
        "Lightning reflexes and instinctive shot-stopping — the ultimate big-game goalkeeper. "
        "Made impossible saves look routine with cat-like agility and fearless positioning."
    ),  # Iker Casillas

    13292: (
        "Sprinter-Creator", "Trequartista", 93,
        "Explosive acceleration married to balletic grace — devastating in transition. "
        "Covered the pitch at speed with the ball at his feet, combining pace with creative vision."
    ),  # Kaká

    14024: (
        "Commander-Engine", "Tuttocampista", 93,
        "The ultimate all-action midfielder — could tackle, shoot, pass, and lead with equal authority. "
        "Dominated World Cups as both a midfielder and a sweeper with relentless energy and drive."
    ),  # Lothar Matthäus

    14145: (
        "Dribbler-Creator", "Fantasista", 93,
        "Mesmerising ball carrier with the vision to pick the perfect final ball. "
        "Glided past opponents on either flank before delivering crosses or through balls of devastating accuracy."
    ),  # Luis Figo

    14435: (
        "Destroyer-Powerhouse", "Zagueiro", 93,
        "An immovable force at the heart of defence — combined raw power with aggressive tackling. "
        "Dominated attackers physically and could play in midfield or defence with equal authority."
    ),  # Marcel Desailly

    14482: (
        "Striker-Controller", "Complete Forward", 93,
        "The most technically gifted striker of his era — acrobatic volleys, clinical finishing, and composure. "
        "Could score the impossible with balletic grace and ice-cold precision."
    ),  # Marco van Basten

    16179: (
        "Passer-Controller", "Metodista", 93,
        "Invisible metronome — controlled games from central midfield with economical passing. "
        "Lethal late runs into the box and venomous long-range shooting disguised a quiet genius."
    ),  # Paul Scholes

    16279: (
        "GK-Commander", "Torwart", 93,
        "The Great Dane — imposing presence, thunderous distribution, and fearless shot-stopping. "
        "Commanded his area with vocal authority and made decisive saves in the biggest moments."
    ),  # Peter Schmeichel

    16921: (
        "Dribbler-Powerhouse", "Tuttocampista", 93,
        "The complete footballer — combined dreadlocked swagger with genuine versatility. "
        "Could dominate as a striker, midfielder, or sweeper with power, technique, and flair."
    ),  # Ruud Gullit

    17666: (
        "Commander-Striker", "Mezzala", 93,
        "The captain who could do everything — thunderous shooting, driving runs, and last-ditch tackles. "
        "Dragged Liverpool to glory through sheer force of will and spectacular goals."
    ),  # Steven Gerrard

    18294: (
        "Commander-Engine", "Fantasista", 93,
        "The heart and soul of Il Grande Torino — boundless energy with commanding leadership. "
        "Dominated matches from the left wing with pace, power, and inspirational performances."
    ),  # Valentino Mazzola

    18570: (
        "Controller-Passer", "Metodista", 93,
        "The metronome of tiki-taka — unrivalled passing accuracy and spatial awareness. "
        "Controlled the tempo of every game with short, precise passes and impeccable positioning."
    ),  # Xavi Hernández

    # ══════════════════════════════════════════════════════════════════════════
    # WORLD CLASS TIER (92)
    # ══════════════════════════════════════════════════════════════════════════

    9381: (
        "Engine-Commander", "Lateral", 92,
        "Scored the greatest World Cup final goal — an overlapping run from right-back finished with power. "
        "Combined attacking verve with defensive discipline and captained Brazil to glory."
    ),  # Carlos Alberto

    9599: (
        "Striker-Powerhouse", "Prima Punta", 92,
        "Battering ram striker — raw power, aerial dominance, and thunderous shooting. "
        "Bullied defenders with physicality and scored goals with sheer brute force."
    ),  # Christian Vieri

    9943: (
        "Destroyer-Commander", "Stopper", 92,
        "Aggressive, uncompromising centre-back who led from the front. "
        "Combined fierce tackling with aerial dominance and the authority to captain Argentina."
    ),  # Daniel Passarella

    10064: (
        "Passer-Controller", "Winger", 92,
        "The greatest crosser in football history — pinpoint delivery from the right flank. "
        "Devastating free kicks, metronomic passing range, and an ability to bend the ball with surgical precision."
    ),  # David Beckham

    10230: (
        "Striker-Controller", "Falso Nove", 92,
        "The Iceman — sublime first touch, outrageous technique, and ice-cold finishing. "
        "Played the game at his own tempo, creating moments of genius with nonchalant brilliance."
    ),  # Dennis Bergkamp

    10327: (
        "GK-Commander", "Torwart", 92,
        "Unflappable composure over a 22-year international career. "
        "Captained Italy to a World Cup with quiet authority and near-perfect consistency."
    ),  # Dino Zoff

    10876: (
        "Cover-Powerhouse", "Zagueiro", 92,
        "Won the Ballon d'Or as a centre-back through pure defensive excellence. "
        "Anticipation, timing, and positioning married to physical resilience and winning mentality."
    ),  # Fabio Cannavaro

    11123: (
        "Creator-Striker", "Seconda Punta", 92,
        "Il Capitano — visionary playmaker trapped in a striker's body. "
        "Scored impossible goals, delivered impossible passes, and embodied Roma for 25 years."
    ),  # Francesco Totti

    11218: (
        "Striker-Powerhouse", "Prima Punta", 92,
        "Batigol — ferocious shooting power, aerial presence, and relentless goal instinct. "
        "Smashed in goals from every angle with his right foot, left foot, and head."
    ),  # Gabriel Batistuta

    11364: (
        "Cover-Passer", "Sweeper", 92,
        "Ball-playing centre-back with elite positioning and exceptional passing range. "
        "Read the game effortlessly and launched attacks with precise long-range distribution."
    ),  # Gerard Piqué

    11368: (
        "Striker-Cover", "Poacher", 92,
        "Der Bomber — the greatest penalty-box predator in history. "
        "Scored from impossible angles in impossible positions with an instinct that defied explanation."
    ),  # Gerd Müller

    11410: (
        "Striker-Powerhouse", "Prima Punta", 92,
        "Rombo di tuono — thunder and lightning in a striker's frame. "
        "Devastating left foot, fierce competitiveness, and a goal-scoring record that defined an era."
    ),  # Gigi Riva

    11454: (
        "Creator-Striker", "Seconda Punta", 92,
        "Il Balilla — technically sublime forward who combined dribbling wizardry with clinical finishing. "
        "Italy's first superstar, equally adept at creating and converting chances."
    ),  # Giuseppe Meazza

    11498: (
        "GK-Cover", "Torwart", 92,
        "Made the greatest save in World Cup history against Pelé. "
        "Extraordinary reflexes, brave positioning, and an uncanny ability to produce miracles at key moments."
    ),  # Gordon Banks

    12098: (
        "Destroyer-Powerhouse", "Zagueiro", 92,
        "Intimidating physical presence — dominated attackers with brute strength and fierce tackling. "
        "A wall of muscle who made centre-forwards fear for their safety."
    ),  # Jaap Stam

    12225: (
        "Sprinter-Striker", "Inside Forward", 92,
        "The hurricane — explosive pace and finishing that lit up the 1970 World Cup. "
        "Scored in every round of the tournament with blistering runs and clinical accuracy."
    ),  # Jairzinho

    12459: (
        "Engine-Commander", "Lateral", 92,
        "The ultimate utility defender — tireless running, tactical intelligence, and consistency personified. "
        "Played over 1,100 professional matches with relentless energy and defensive discipline."
    ),  # Javier Zanetti

    12789: (
        "Engine-Striker", "Tuttocampista", 92,
        "Total Football's enforcer — combined box-to-box energy with fierce tackling and penalty-box goals. "
        "The engine behind Cruyff's genius, arriving late to score crucial goals."
    ),  # Johan Neeskens

    13329: (
        "Striker-Sprinter", "Complete Forward", 92,
        "Explosive pace married to predatory finishing — a deadly combination of speed and precision. "
        "Led the line for Bayern and West Germany with clinical efficiency and electric acceleration."
    ),  # Karl-Heinz Rummenigge

    4379: (
        "Cover-Powerhouse", "Zagueiro", 92,
        "Ball-carrying centre-back with explosive forward runs and powerful aerial presence. "
        "Could score spectacular goals from defence and dominated opponents physically."
    ),  # Lúcio

    14167: (
        "Passer-Creator", "Metodista", 92,
        "Spain's original maestro — sublime passing range and vision from central midfield. "
        "Controlled games with effortless elegance and was the first Spaniard to win the Ballon d'Or."
    ),  # Luis Suárez Miramontes

    14843: (
        "Cover-Commander", "Libero", 92,
        "The last great libero — combined sweeper intelligence with aggressive forward surges. "
        "Won the Ballon d'Or as a defender by reading the game and driving attacks from deep."
    ),  # Matthias Sammer

    15611: (
        "Destroyer-Powerhouse", "Zagueiro", 92,
        "Fearless, aggressive, and utterly committed — headed everything and tackled with ferocity. "
        "The ultimate warrior defender who threw his body on the line every single match."
    ),  # Nemanja Vidić

    15750: (
        "Dribbler-Sprinter", "Lateral", 92,
        "The original attacking full-back — decades ahead of his time with overlapping runs and skill. "
        "Combined Brazilian flair with defensive intelligence, pioneering the modern wing-back role."
    ),  # Nílton Santos

    15886: (
        "GK-Commander", "Torwart", 92,
        "Ferocious intensity and commanding presence between the posts. "
        "Intimidated opponents with explosive reactions and an aggressive, dominating personality."
    ),  # Oliver Kahn

    16067: (
        "Sprinter-Dribbler", "Extremo", 92,
        "Blistering pace on the left wing with six European Cup medals to show for it. "
        "The quickest winger of his era, terrorising defenders with direct, explosive running."
    ),  # Paco Gento

    16133: (
        "Commander-Powerhouse", "Tuttocampista", 92,
        "Imposing physical presence and irresistible forward momentum from midfield. "
        "Dominated with long strides, crunching tackles, and the authority of a born leader."
    ),  # Patrick Vieira

    16287: (
        "GK-Cover", "Torwart", 92,
        "Shot-stopping specialist with incredible reflexes and brave positioning. "
        "Made spectacular saves look routine and maintained elite consistency over 20 years."
    ),  # Petr Čech

    16320: (
        "Cover-Controller", "Invertido", 92,
        "Tactical genius who revolutionised the full-back position — could play anywhere across the back four and midfield. "
        "Read the game impeccably and used the ball with the intelligence of a playmaker."
    ),  # Philipp Lahm

    16675: (
        "Striker-Creator", "Seconda Punta", 92,
        "Left foot of devastating power combined with acrobatic creativity. "
        "Could score bicycle kicks, free kicks, and solo goals with equal ease — a true showman."
    ),  # Rivaldo

    16721: (
        "Creator-Dribbler", "Trequartista", 92,
        "Il Divin Codino — the ponytail, the step-overs, the impossible goals. "
        "Played with artistry that transcended tactics, creating magic with every touch."
    ),  # Roberto Baggio

    16722: (
        "Sprinter-Striker", "Lateral", 92,
        "The bullet left-back — thunderous free kicks, explosive overlapping runs, and devastating shooting power. "
        "Redefined what a full-back could do going forward with raw pace and rocket shots."
    ),  # Roberto Carlos

    16745: (
        "Striker-Controller", "Complete Forward", 92,
        "Elegant technique married to clinical finishing — scored with both feet from any position. "
        "Controlled the ball beautifully before finishing with precision and composure."
    ),  # Robin van Persie

    16810: (
        "Striker-Sprinter", "Poacher", 92,
        "The ultimate penalty-box predator — explosive in tight spaces with lethal finishing. "
        "Low centre of gravity, razor-sharp movement, and an instinct for the goal that was almost supernatural."
    ),  # Romário

    16871: (
        "Commander-Destroyer", "Tuttocampista", 92,
        "Ferocious competitiveness and iron will from the centre of midfield. "
        "Drove Manchester United through force of personality, crunching tackles, and absolute refusal to lose."
    ),  # Roy Keane

    16947: (
        "Dribbler-Sprinter", "Winger", 92,
        "Lightning pace on the left wing over a 24-year career at the top. "
        "Mesmerising close control at full speed, devastating in one-on-one situations."
    ),  # Ryan Giggs

    17338: (
        "Striker-Sprinter", "Poacher", 92,
        "Clinical finisher with electric acceleration in the penalty box. "
        "Scored goals of every type — tap-ins, long range, headers — with predatory instinct and composure."
    ),  # Sergio Agüero

    17569: (
        "Dribbler-Controller", "Winger", 92,
        "The Wizard of Dribble — mesmerised defenders with feints, body swerves, and close control. "
        "Played at the top level into his 50s through sheer skill and footballing intelligence."
    ),  # Stanley Matthews

    18372: (
        "Commander-Cover", "Zagueiro", 92,
        "Imperious leader at the heart of defence — vocal, courageous, and utterly dependable. "
        "Organised back lines with authority and produced key moments in the biggest matches."
    ),  # Vincent Kompany

    18566: (
        "Passer-Controller", "Regista", 92,
        "Deep-lying metronome with extraordinary passing range and composure. "
        "Controlled the tempo from the base of midfield with pinpoint long balls and effortless distribution."
    ),  # Xabi Alonso

    18637: (
        "Powerhouse-Controller", "Tuttocampista", 92,
        "Unstoppable combination of power, pace, and technique from central midfield. "
        "Could bulldoze through defences on mazy runs and score spectacular goals."
    ),  # Yaya Touré

    18796: (
        "Striker-Target", "Complete Forward", 92,
        "Acrobatic genius in a towering frame — spectacular goals from impossible positions. "
        "Combined aerial dominance with martial arts-inspired technique and supreme self-confidence."
    ),  # Zlatan Ibrahimović

    # ══════════════════════════════════════════════════════════════════════════
    # PEAK 91
    # ══════════════════════════════════════════════════════════════════════════

    7882: (
        "Creator-Dribbler", "Seconda Punta", 91,
        "La Máquina's orchestrator — fluid movement, imaginative passing, and technical brilliance. "
        "Operated between the lines with the creativity and vision of a classical inside forward."
    ),  # Adolfo Pedernera

    8008: (
        "Striker-Powerhouse", "Prima Punta", 91,
        "The Premier League's greatest ever goalscorer — power, heading, and lethal right-foot shooting. "
        "Led the line with physical presence and predatory instinct."
    ),  # Alan Shearer

    8083: (
        "Cover-Controller", "Sweeper", 91,
        "The silent partner of Milan's legendary defence — impeccable positioning and clean tackling. "
        "Read the game expertly alongside Baresi and Maldini for over a decade."
    ),  # Alessandro Costacurta

    8085: (
        "Creator-Striker", "Seconda Punta", 91,
        "Pinturicchio — elegant movement, curving finishes, and moments of pure artistry. "
        "Floated into space to create and score with a painter's delicacy."
    ),  # Alessandro Del Piero

    8091: (
        "Cover-Controller", "Sweeper", 91,
        "Poise personified at centre-back — elegant, composed, and effortlessly dominant. "
        "Made defending look like an art form with perfect timing and graceful ball-playing."
    ),  # Alessandro Nesta

    8451: (
        "Passer-Engine", "Lateral", 91,
        "Versatile left-back with a thunderbolt right foot and tireless forward runs. "
        "Scored the winning penalty in the 1990 World Cup Final — equally adept defending and attacking."
    ),  # Andreas Brehme

    8762: (
        "Cover-Sprinter", "Lateral", 91,
        "Lightning-quick recovery pace and rock-solid defensive discipline. "
        "The complete modern full-back — attack-minded yet almost impossible to beat one-on-one."
    ),  # Ashley Cole

    9373: (
        "Destroyer-Commander", "Zagueiro", 91,
        "Heart and soul of Barcelona — ferocious tackling, aerial presence, and inspirational leadership. "
        "Threw himself into every challenge with the intensity of a man defending his home."
    ),  # Carles Puyol

    9408: (
        "Striker-Destroyer", "Complete Forward", 91,
        "The Apache — relentless pressing, fierce combativeness, and clinical finishing. "
        "Never stopped running, never stopped fighting, and terrified defenders with his aggression."
    ),  # Carlos Tévez

    9474: (
        "Passer-Creator", "Mezzala", 91,
        "Prodigious passing talent — Arsenal's youngest captain who controlled games with distribution. "
        "Eye for the killer ball, late runs into the box, and metronomic tempo control."
    ),  # Cesc Fàbregas

    9661: (
        "Destroyer-Passer", "Anchor", 91,
        "The position was named after him — the ultimate ball-winning shield in front of the back four. "
        "Won possession and recycled it simply, allowing the artists ahead of him to create."
    ),  # Claude Makélélé

    10118: (
        "Creator-Passer", "Enganche", 91,
        "The magician of the left foot — disguised passes, silky dribbles, and vision beyond compare. "
        "Controlled games from the number 10 role with understated genius and delicate touch."
    ),  # David Silva

    10176: (
        "Creator-Engine", "Mezzala", 91,
        "Dynamic playmaker who combined creative vision with tireless work rate. "
        "Drove Porto and Barcelona to Champions League glory with goals, assists, and sheer dynamism."
    ),  # Deco

    10272: (
        "Passer-Creator", "Metodista", 91,
        "The maestro of the 1958 and 1962 World Cup triumphs — dipping free kicks and surgical passing. "
        "Orchestrated play with elegant technique and pioneered the folha seca free kick."
    ),  # Didi

    10275: (
        "Powerhouse-Striker", "Prima Punta", 91,
        "The Drogba effect — power, presence, and an unmatched ability to deliver in finals. "
        "Bullied defenders with physicality and scored crucial goals when everything was on the line."
    ),  # Didier Drogba

    1900: (
        "Creator-Passer", "Enganche", 91,
        "Gifted playmaker with a velvet left foot and exceptional creative vision. "
        "Dictated tempo with imaginative through balls and curling set pieces."
    ),  # Diego Ribas

    10312: (
        "Striker-Controller", "Falso Nove", 91,
        "Languid elegance and effortless technique — controlled the ball like it was part of him. "
        "Deceivingly lazy movement hid razor-sharp finishing and exquisite first touch."
    ),  # Dimitar Berbatov

    10479: (
        "Engine-Powerhouse", "Tuttocampista", 91,
        "The Pitbull — ferocious energy, aggressive pressing, and unstoppable box-to-box running. "
        "Wore protective goggles and terrorised opponents with relentless intensity."
    ),  # Edgar Davids

    10540: (
        "Cover-Commander", "Libero", 91,
        "South America's greatest ever defender — read the game with preternatural intelligence. "
        "Dominated aerially, organised the backline, and carried the ball forward with composure."
    ),  # Elías Figueroa

    10634: (
        "Sprinter-Striker", "Poacher", 91,
        "The Vulture — ghosted into the box with intelligent movement and clinical finishing. "
        "Deceptive pace, deadly in the penalty area, and lethal with precise, placed finishes."
    ),  # Emilio Butragueño

    11008: (
        "Sprinter-Striker", "Poacher", 91,
        "Electric pace and predatory movement — unstoppable when in full flight. "
        "Blistering acceleration left defenders for dead before finishing with composure."
    ),  # Fernando Torres

    11077: (
        "Dribbler-Creator", "Complete Forward", 91,
        "Magical Hungarian forward with balletic dribbling and creative vision. "
        "Won the 1967 Ballon d'Or with spectacular individual skills and imaginative play."
    ),  # Flórián Albert

    11138: (
        "Dribbler-Creator", "Fantasista", 91,
        "Explosive winger with close control, pace, and a low centre of gravity. "
        "Terrorised full-backs with unpredictable dribbling and delivered in the biggest games."
    ),  # Franck Ribéry

    11153: (
        "Striker-Engine", "Mezzala", 91,
        "Super Frank — arrived late in the box with impeccable timing to score prolifically from midfield. "
        "Combined tireless running with clinical finishing and an extraordinary goal record."
    ),  # Frank Lampard

    11199: (
        "Commander-Dribbler", "Trequartista", 91,
        "Captained West Germany to the 1954 Miracle of Bern with tactical intelligence and leadership. "
        "A creative organiser who inspired those around him in the biggest moments."
    ),  # Fritz Walter

    11379: (
        "Creator-Dribbler", "Trequartista", 91,
        "The Maradona of the Carpathians — devastating left foot with flair and shooting power. "
        "Created and scored spectacular goals with a combination of vision, technique, and audacity."
    ),  # Gheorghe Hagi

    11796: (
        "Striker-Sprinter", "Poacher", 91,
        "Ice-cold finisher with explosive movement and lethal precision in the box. "
        "Scored with clinical efficiency — headers, volleys, and tap-ins with equal composure."
    ),  # Hernán Crespo

    11828: (
        "Striker-Powerhouse", "Inside Forward", 91,
        "Fiery Bulgarian with a devastating left foot and combative spirit. "
        "Could dribble past opponents before unleashing powerful shots — a true match-winner."
    ),  # Hristo Stoichkov

    11846: (
        "Striker-Sprinter", "Poacher", 91,
        "The acrobatic poacher — invented the scorpion kick and scored with supernatural agility. "
        "Penalty-box predator with gymnastic finishing and relentless goal instinct."
    ),  # Hugo Sánchez

    12325: (
        "Creator-Passer", "Enganche", 91,
        "Golden left foot with sublime vision and set-piece mastery. "
        "Orchestrated attacks with weighted through balls and delivered crosses of devastating accuracy."
    ),  # James Rodríguez

    12457: (
        "Destroyer-Commander", "Anchor", 91,
        "Ferocious ball-winner who could play as a defensive midfielder or emergency centre-back. "
        "Combined aggressive tackling with intelligent positioning and selfless tactical discipline."
    ),  # Javier Mascherano

    12825: (
        "Passer-Creator", "Enganche", 91,
        "The first £100-a-week footballer — passing accuracy and vision decades ahead of his time. "
        "Delivered inch-perfect balls with either foot and dictated the tempo with elegant authority."
    ),  # Johnny Haynes

    13141: (
        "Passer-Powerhouse", "Metodista", 91,
        "La Brujita — powerful passing range combined with physical presence in midfield. "
        "Sprayed long-range passes with either foot and drove forward with determined physicality."
    ),  # Juan Sebastián Verón

    14447: (
        "Dribbler-Sprinter", "Lateral", 91,
        "Brazilian flair at left-back — jinking runs, outrageous skill, and infectious energy. "
        "Overlapped with the joy of a winger and defended with the recovery pace of a sprinter."
    ),  # Marcelo

    15040: (
        "Creator-Passer", "Enganche", 91,
        "The Assist King — supreme vision, delicate touch, and the ability to see passes others couldn't imagine. "
        "Controlled attacking play with languid elegance and pinpoint final balls."
    ),  # Mesut Özil

    15067: (
        "Powerhouse-Engine", "Tuttocampista", 91,
        "The Bison — combined immense physical power with tireless box-to-box energy. "
        "Drove through midfield with explosive force, scored spectacular goals, and dominated physically."
    ),  # Michael Essien

    15087: (
        "Sprinter-Striker", "Poacher", 91,
        "Explosive acceleration and nerveless finishing — lethal before his body betrayed him. "
        "Lightning pace in behind and clinical one-on-one conversion made him a teenage phenomenon."
    ),  # Michael Owen

    15944: (
        "Dribbler-Creator", "Seconda Punta", 91,
        "Argentine genius with mesmerising close control and a fiery temperament. "
        "Dribbled past opponents with impudent skill and scored with audacious technique."
    ),  # Omar Sívori

    16052: (
        "Creator-Dribbler", "Trequartista", 91,
        "El Payaso — nimble playmaker with magical close control and exquisite vision. "
        "Floated across the pitch creating chances with subtle flicks and intricate combinations."
    ),  # Pablo Aimar

    16201: (
        "Controller-Passer", "Metodista", 91,
        "Brazilian elegance in Italian football — metronomic passing and quiet tactical authority. "
        "Controlled games from midfield with languid grace and pinpoint distribution."
    ),  # Paulo Roberto Falcão

    16211: (
        "Engine-Creator", "Fantasista", 91,
        "Relentless runner with a hammer left foot and creative spark. "
        "Combined box-to-box energy with devastating shooting power and playmaking ability."
    ),  # Pavel Nedvěd

    16670: (
        "Cover-Controller", "Sweeper", 91,
        "Composed, elegant, and deceptively quick — the Rolls-Royce centre-back. "
        "Read the game with intelligence and brought the ball out of defence with serene composure."
    ),  # Rio Ferdinand

    16714: (
        "Dribbler-Sprinter", "Winger", 91,
        "Silky French winger with devastating pace and close control on the left flank. "
        "Glided past defenders before delivering crosses or cutting inside to score."
    ),  # Robert Pirès

    6219: (
        "Dribbler-Sprinter", "Extremo", 91,
        "Samba skills with electrifying pace — step-overs, elasticos, and jinking runs at full speed. "
        "Dazzled audiences with raw talent and explosive dribbling."
    ),  # Robinho

    16908: (
        "Creator-Passer", "Trequartista", 91,
        "The poet of Portuguese football — sublime vision, feathered passes, and artistic playmaking. "
        "Floated between the lines, creating chances with an artist's imagination."
    ),  # Rui Costa

    17159: (
        "Striker-Creator", "Seconda Punta", 91,
        "The elegant Mazzola heir — combined clinical finishing with creative intelligence. "
        "Operated between the lines with a goal-scorer's instinct and a playmaker's vision."
    ),  # Sandro Mazzola

    17496: (
        "Creator-Engine", "Trequartista", 91,
        "Doctor Socrates — the philosopher footballer with a velvet touch and towering intellect. "
        "Controlled games with back-heels, vision, and democratic leadership on and off the pitch."
    ),  # Sócrates

    17509: (
        "Destroyer-Sprinter", "Zagueiro", 91,
        "Raw pace and power at centre-back — recovered any situation with explosive speed. "
        "Dominant in the air, frighteningly quick over the ground, and a big-game defender."
    ),  # Sol Campbell

    18469: (
        "Striker-Engine", "Complete Forward", 91,
        "Streetwise forward who could play anywhere across the front line. "
        "Combined explosive power with technical skill, overhead kicks, and an insatiable appetite for goals."
    ),  # Wayne Rooney

    # ══════════════════════════════════════════════════════════════════════════
    # PEAK 90
    # ══════════════════════════════════════════════════════════════════════════

    111: (
        "Striker-Powerhouse", "Prima Punta", 90,
        "The Emperor — devastating left foot and raw power in his prime. "
        "Bulldozed defenders before finishing with thunderous precision."
    ),  # Adriano

    8514: (
        "Striker-Sprinter", "Poacher", 90,
        "Clinical finisher with explosive movement and lethal composure. "
        "Scored consistently across Serie A and the Champions League with predatory instinct."
    ),  # Andriy Shevchenko

    8543: (
        "Creator-Striker", "Inside Forward", 90,
        "La Máquina's left-winger — intelligent movement and clinical finishing. "
        "Combined creative vision with goal-scoring ability in River Plate's legendary forward line."
    ),  # Ángel Labruna

    8681: (
        "Passer-Controller", "Metodista", 90,
        "Long-range specialist with metronomic passing from deep midfield. "
        "Scored spectacular goals from distance and distributed with Dutch precision."
    ),  # Arie Haan

    649: (
        "Engine-Powerhouse", "Tuttocampista", 90,
        "El Guerrero — relentless warrior who covered every blade of grass. "
        "Combined aggressive tackling with lung-busting runs and spectacular long-range goals."
    ),  # Arturo Vidal

    8915: (
        "Controller-Engine", "Metodista", 90,
        "Metronomic tempo control from central midfield with tireless work rate. "
        "Controlled the ball, controlled the game, and delivered in World Cup finals."
    ),  # Bastian Schweinsteiger

    9037: (
        "Cover-Powerhouse", "Sweeper", 90,
        "Tenacious man-marker who became a tactical innovator as a coach. "
        "Tight defensive discipline, relentless pressing, and impeccable positioning."
    ),  # Berti Vogts

    9960: (
        "Destroyer-Commander", "Volante", 90,
        "Roma's heart — fierce tackling, passionate leadership, and surprising technical quality. "
        "Dominated midfield with aggressive ball-winning and captained with vocal authority."
    ),  # Daniele De Rossi

    10127: (
        "Striker-Sprinter", "Poacher", 90,
        "El Guaje — deceptive movement and clinical finishing with either foot. "
        "Ghosted into scoring positions with intelligent runs and scored with composure."
    ),  # David Villa

    10187: (
        "Creator-Dribbler", "Trequartista", 90,
        "The Genius — mercurial talent with spectacular dribbling and match-winning ability. "
        "Could produce moments of individual brilliance that decided the biggest games."
    ),  # Dejan Savićević

    10218: (
        "Striker-Sprinter", "Poacher", 90,
        "The King — electric pace and fearless finishing with both feet and head. "
        "Scored spectacular goals with acrobatic athleticism and clinical precision."
    ),  # Denis Law

    1914: (
        "Commander-Cover", "Zagueiro", 90,
        "Uruguayan rock — fierce aerial presence, impeccable timing, and inspirational leadership. "
        "Marshalled backlines with authority and scored crucial goals from set pieces."
    ),  # Diego Godín

    10352: (
        "Cover-Sprinter", "Lateral", 90,
        "The complete right-back of the 1958 and 1962 World Cups — defensive solidity with attacking flair. "
        "Recovery pace, tactical awareness, and an ability to shut down the best wingers in the world."
    ),  # Djalma Santos

    10435: (
        "Powerhouse-Commander", "Tuttocampista", 90,
        "The complete footballer — could play anywhere with dominant physicality and supreme skill. "
        "Tragically lost in the Munich air disaster at 21, already one of England's greatest."
    ),  # Duncan Edwards

    10742: (
        "Cover-Commander", "Lateral", 90,
        "Quietly brilliant left-back — composed, intelligent, and selflessly reliable. "
        "Read the game with calm authority and provided defensive solidity for Barcelona's golden era."
    ),  # Éric Abidal

    11000: (
        "Commander-Destroyer", "Zagueiro", 90,
        "Iron defender who also scored crucial goals — powerful heading, fierce tackles, and leadership. "
        "Captained Real Madrid with authority and contributed goals from set pieces."
    ),  # Fernando Hierro

    11006: (
        "Destroyer-Dribbler", "Volante", 90,
        "El Príncipe — aristocratic elegance from the base of midfield. "
        "Won the ball with timing, then glided forward on mazy dribbles with effortless grace."
    ),  # Fernando Redondo

    11257: (
        "Engine-Striker", "Mezzala", 90,
        "Dynamic midfielder who combined box-to-box energy with prolific goal-scoring. "
        "Arrived late in the box with perfect timing and finished with composure."
    ),  # Gaizka Mendieta

    11337: (
        "Sprinter-Striker", "Complete Forward", 90,
        "King George — explosive pace, raw power, and devastating finishing. "
        "The only African to win the Ballon d'Or, combining athleticism with clinical goal-scoring."
    ),  # George Weah

    11388: (
        "Creator-Dribbler", "Trequartista", 90,
        "The little magician — diminutive playmaker with outrageous close control and vision. "
        "Scored spectacular goals with creativity and skill that belied his stature."
    ),  # Gianfranco Zola

    11428: (
        "Destroyer-Commander", "Zagueiro", 90,
        "The chiellini tackle — aggressive, uncompromising, and a born competitor. "
        "Led through physicality and winning mentality, dominating attackers for two decades."
    ),  # Giorgio Chiellini

    11558: (
        "Striker-Powerhouse", "Prima Punta", 90,
        "The most prolific scorer in Serie A history at the time — powerful aerial presence and clinical finishing. "
        "Combined physical dominance with predatory instincts in the penalty box."
    ),  # Gunnar Nordahl

    11559: (
        "Creator-Passer", "Metodista", 90,
        "Long-haired maestro who controlled games with visionary passing and creative flair. "
        "Orchestrated play from deep with elegant technique and devastating through balls."
    ),  # Günter Netzer

    12369: (
        "Striker-Engine", "Complete Forward", 90,
        "Belgium's greatest — combined aerial presence with tireless running and goal-scoring prowess. "
        "Led the line with intelligence and work rate across an illustrious international career."
    ),  # Jan Ceulemans

    12639: (
        "Dribbler-Sprinter", "Extremo", 90,
        "Jinky — electrifying winger with mazy dribbling and explosive acceleration. "
        "Tormented defenders with outrageous skill and fearless direct running."
    ),  # Jimmy Johnstone

    12799: (
        "Dribbler-Sprinter", "Winger", 90,
        "Dignified winger with pace, power, and sublime skill on the ball. "
        "Drove at defenders with a combination of athleticism and technique that was irresistible."
    ),  # John Barnes

    12803: (
        "Striker-Target", "Complete Forward", 90,
        "The Gentle Giant — dominated as both a centre-forward and centre-back. "
        "Aerial supremacy, powerful shooting, and surprising finesse in a towering frame."
    ),  # John Charles

    12822: (
        "Commander-Destroyer", "Zagueiro", 90,
        "Captain, leader, legend — organised defences with vocal authority and fierce heading. "
        "Won every aerial duel and threw his body in front of anything heading for goal."
    ),  # John Terry

    12979: (
        "Engine-Powerhouse", "Volante", 90,
        "Uruguay's first great defensive midfielder — tireless energy and combative tackling. "
        "Dominated the 1930 World Cup with relentless ball-winning and midfield authority."
    ),  # José Andrade

    13000: (
        "Creator-Dribbler", "Inside Forward", 90,
        "Argentine genius of the 1940s — dribbling artistry and creative vision. "
        "Mesmerised opponents with tricks and flicks across South American football."
    ),  # José Manuel Moreno

    13118: (
        "Creator-Dribbler", "Seconda Punta", 90,
        "The hero of the 1950 Maracanazo — intelligence, vision, and ice-cold composure. "
        "Orchestrated play between the lines with Uruguayan grit and sublime passing."
    ),  # Juan Alberto Schiaffino

    3677: (
        "Creator-Passer", "Enganche", 90,
        "The last pure number 10 — unhurried brilliance, disguised passes, and metronomic tempo. "
        "Controlled games with a cigarette-break tempo, making everyone else play to his rhythm."
    ),  # Juan Román Riquelme

    13432: (
        "Striker-Creator", "Seconda Punta", 90,
        "King Kenny — sublime close control, intelligent movement, and clinical finishing. "
        "Combined goal-scoring with creative link-up play that made everyone around him better."
    ),  # Kenny Dalglish

    13474: (
        "Sprinter-Striker", "Complete Forward", 90,
        "Mighty Mouse — explosive pace, tireless work rate, and infectious enthusiasm. "
        "Ran at defenders with fearless energy and converted chances with predatory instinct."
    ),  # Kevin Keegan

    13750: (
        "Cover-Passer", "Libero", 90,
        "Elegant French centre-back — composed distribution from the back and immaculate reading of play. "
        "Played the ball out of defence with class and intercepted danger before it developed."
    ),  # Laurent Blanc

    4476: (
        "Sprinter-Dribbler", "Lateral", 90,
        "Brazilian juggernaut at right-back — explosive pace, powerful forward runs, and physical dominance. "
        "Bombed forward with unstoppable momentum and delivered end product."
    ),  # Maicon

    14427: (
        "Sprinter-Dribbler", "Winger", 90,
        "Electric pace down the left wing — direct, explosive, and devastating in transition. "
        "Knocked the ball past defenders and used sheer speed to create chaos."
    ),  # Marc Overmars

    15857: (
        "Sprinter-Striker", "Inside Forward", 90,
        "Devastating pace and explosive finishing — Soviet football's greatest ever player. "
        "Burned past defenders with blistering speed before slotting home with precision."
    ),  # Oleg Blokhin

    15995: (
        "Destroyer-Powerhouse", "Zagueiro", 90,
        "Uncompromising Argentine centre-back — fierce in the tackle and dominant in the air. "
        "Led the backline with aggression and physicality across World Cup-winning campaigns."
    ),  # Óscar Ruggeri

    16078: (
        "Destroyer-Powerhouse", "Zagueiro", 90,
        "The Uruguayan wall — aggressive, physical, and utterly uncompromising. "
        "Dominated Serie A with fierce tackling, aerial power, and intimidating presence."
    ),  # Paolo Montero

    16079: (
        "Striker-Sprinter", "Poacher", 90,
        "Golden Boy of the 1982 World Cup — burst to life with a hat-trick against Brazil. "
        "Clinical poacher with sharp movement and lethal finishing in the penalty box."
    ),  # Paolo Rossi

    16162: (
        "Creator-Dribbler", "Trequartista", 90,
        "Gazza — outrageous natural talent with close control, vision, and flashes of genius. "
        "Could produce moments of sublime skill — the flick, the volley, the mazy run — that lived forever."
    ),  # Paul Gascoigne

    16259: (
        "Controller-Passer", "Regista", 90,
        "The cerebral midfielder who became the game's greatest coach. "
        "Controlled tempo with short, precise passes and extraordinary positional intelligence."
    ),  # Pep Guardiola

    16462: (
        "Dribbler-Sprinter", "Extremo", 90,
        "Dutch winger with electric pace, balletic dribbling, and an eye for goal. "
        "Terrorised defences in the 1978 World Cup Final with direct, explosive running."
    ),  # Rob Rensenbrink

    16508: (
        "Striker-Controller", "Seconda Punta", 90,
        "Intelligent movement and ice-cold finishing — floated between the lines with impeccable timing. "
        "Scored over 300 goals for Real Madrid with composure, anticipation, and clinical precision."
    ),  # Raúl

    16530: (
        "Creator-Sprinter", "Inside Forward", 90,
        "Little Napoleon — combined dribbling skill with explosive pace and creative vision. "
        "Lit up the 1958 World Cup and became the first Frenchman to win the Ballon d'Or."
    ),  # Raymond Kopa

    16829: (
        "Passer-Cover", "Libero", 90,
        "The goal-scoring centre-back — devastating free kicks and long-range passing from defence. "
        "Redefined what a defender could contribute with pinpoint distribution and set-piece mastery."
    ),  # Ronald Koeman

    16922: (
        "Cover-Controller", "Libero", 90,
        "Elegant Dutch sweeper — glided out of defence with composure and vision. "
        "Read the game with intelligence and distributed with the poise of a midfielder."
    ),  # Ruud Krol

    16923: (
        "Striker-Cover", "Poacher", 90,
        "The ultimate penalty-box predator — instinctive movement and ruthless finishing. "
        "Scored goals from inside the six-yard box with predatory timing and clinical composure."
    ),  # Ruud van Nistelrooy

    17125: (
        "Sprinter-Striker", "Complete Forward", 90,
        "Explosive pace, clinical finishing, and relentless work rate up front. "
        "Dominated across multiple leagues with speed, skill, and a hunger for goals."
    ),  # Samuel Eto'o

    17153: (
        "Target-Striker", "Prima Punta", 90,
        "The most prolific header of a football ever — scored with supernatural aerial ability. "
        "Leapt above defenders to power headers home with astonishing consistency."
    ),  # Sándor Kocsis

    17892: (
        "Controller-Dribbler", "Mezzala", 90,
        "Press-resistant maestro with a velvet touch and 360-degree awareness. "
        "Received the ball under pressure, pirouetted away from opponents, and progressed play with elegance."
    ),  # Thiago Alcântara

    18149: (
        "Controller-Passer", "Metodista", 90,
        "The metronomic master — controlled tempo with unrivalled passing precision. "
        "Made the game look simple with economical movement and laser-guided distribution."
    ),  # Toni Kroos

    18762: (
        "Sprinter-Striker", "Inside Forward", 90,
        "Explosive Polish attacker with pace and lethal finishing in big games. "
        "Combined speed with goal-scoring ability to shine at two World Cups and in Serie A."
    ),  # Zbigniew Boniek

    18805: (
        "Creator-Engine", "Mezzala", 90,
        "Dynamic Croatian playmaker who combined creative flair with tireless running. "
        "Drove forward with skill and energy, delivering key passes and goals in midfield."
    ),  # Zvonimir Boban
}


def main():
    parser = argparse.ArgumentParser(
        description="Seed curated skillsets and playing styles for legends."
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--player", type=int, help="Update a single player by person_id")
    args = parser.parse_args()

    conn = psycopg2.connect(POSTGRES_DSN)
    cur = conn.cursor()

    seeds = LEGEND_SEEDS
    if args.player:
        seeds = {k: v for k, v in seeds.items() if k == args.player}
        if not seeds:
            print(f"  Player {args.player} not found in seed data.")
            return

    print(f"  Legend seed: {len(seeds)} players to process")

    # ── Fetch current state ───────────────────────────────────────────────
    pids = list(seeds.keys())
    cur.execute(
        "SELECT person_id, archetype, best_role, best_role_score "
        "FROM player_profiles WHERE person_id = ANY(%s)",
        (pids,),
    )
    current_profiles = {r[0]: r[1:] for r in cur.fetchall()}

    cur.execute(
        "SELECT person_id, scouting_notes "
        "FROM player_status WHERE person_id = ANY(%s)",
        (pids,),
    )
    current_notes = {r[0]: r[1] for r in cur.fetchall()}

    # ── Check for missing profiles ────────────────────────────────────────
    missing = [pid for pid in pids if pid not in current_profiles]
    if missing:
        print(f"  WARNING: {len(missing)} players have no player_profiles row: {missing[:10]}...")

    # ── Apply updates ─────────────────────────────────────────────────────
    profile_updates = 0
    style_updates = 0

    for pid, (archetype, best_role, score, style) in sorted(
        seeds.items(), key=lambda x: -x[1][2]
    ):
        old = current_profiles.get(pid, (None, None, None))
        old_notes = current_notes.get(pid, None)

        profile_changed = old[0] != archetype or old[1] != best_role or old[2] != score
        style_changed = not old_notes or old_notes.strip() == ""

        if not profile_changed and not style_changed:
            continue

        if profile_changed:
            print(
                f"  {pid}: {old[0] or 'NULL':25s} → {archetype:25s} | "
                f"{old[1] or 'NULL':20s} → {best_role:20s} | "
                f"{old[2] or 0} → {score}"
            )
            profile_updates += 1

            if not args.dry_run:
                cur.execute(
                    """
                    UPDATE player_profiles
                    SET archetype = %s, best_role = %s, best_role_score = %s
                    WHERE person_id = %s
                    """,
                    (archetype, best_role, score, pid),
                )

        if style_changed:
            style_updates += 1
            if not args.dry_run:
                cur.execute(
                    """
                    INSERT INTO player_status (person_id, scouting_notes)
                    VALUES (%s, %s)
                    ON CONFLICT (person_id) DO UPDATE
                    SET scouting_notes = EXCLUDED.scouting_notes
                    WHERE player_status.scouting_notes IS NULL
                       OR player_status.scouting_notes = ''
                    """,
                    (pid, style),
                )

    print(f"\n  Profile updates: {profile_updates}")
    print(f"  Style updates:   {style_updates}")

    if args.dry_run:
        print("  [DRY RUN — no changes written]")
        conn.rollback()
    else:
        conn.commit()
        print("  Committed.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
