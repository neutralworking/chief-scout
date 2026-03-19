"""
35_manual_profiles.py — Manual player profiling for top 5 league first-team players.

Sets correct levels and scouting bios for ~300 key players across the top clubs.
These are DOF-quality assessments, not pipeline-generated.

Usage:
    python 35_manual_profiles.py --dry-run    # preview
    python 35_manual_profiles.py              # apply
"""
from __future__ import annotations

import argparse
from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="Manual player profiling")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()
DRY_RUN = args.dry_run

# ── PROFILES ─────────────────────────────────────────────────────────────────
# Format: (name, club, level, position, bio)
# Names must match people.name exactly (check DB first)
# Level scale: 93-99 generational, 90-92 world class, 87-89 elite, 84-86 very good,
#              80-83 good, 75-79 decent, 70-74 squad player, <70 youth/backup

PROFILES = [
    # ═══════════════════════════════════════════════════════════════════════════
    # ARSENAL
    # ═══════════════════════════════════════════════════════════════════════════
    ("Ben White", "Arsenal", 85, "WD", "Converted right-back with centre-back intelligence. Exceptional in 1v1 duels, reads the game two passes ahead. Inverts into midfield seamlessly under Arteta."),
    ("David Raya", "Arsenal", 87, "GK", "Ball-playing keeper who transformed Arsenal's build-up. Lightning reflexes, dominant in the box, distributes like a midfielder. Penalty save specialist."),
    ("Gabriel Jesus", "Arsenal", 82, "CF", "Relentless pressing forward who sets the tone from the front. Movement creates space for others. Finishing inconsistent but link-up play is elite."),
    ("Gabriel Martinelli", "Arsenal", 84, "WF", "Direct, explosive wide forward. Runs in behind at pace, stretches defences. End product improving but still streaky. Big-game temperament."),
    ("Jurrien Timber", "Arsenal", 84, "WD", "Versatile Dutch defender — plays RB, CB, even midfield. Technically excellent, composed on the ball, aggressive in the press. Injury concerns linger."),
    ("Leandro Trossard", "Arsenal", 83, "WF", "Super sub turned reliable starter. Two-footed, intelligent movement, clinical finisher from tight angles. Thrives as an inside forward."),
    ("Martin Odegaard", "Arsenal", 89, "AM", "Arsenal's creative heartbeat. Elite vision, weight of pass, and work rate off the ball. Captains by example — presses, tackles, and creates."),
    ("Mikel Merino", "Arsenal", 83, "CM", "Box-to-box midfielder with aerial presence. Arrives late in the box, wins headers, provides defensive steel. Adapted well to the Premier League."),
    ("Ethan Nwaneri", "Arsenal", 72, "CM", "Prodigiously talented teenager. Technically gifted with an eye for a pass. Still physically developing but has the raw ability to be special."),
    ("Cristhian Mosquera", "Arsenal", 76, "CD", "Young centre-back prospect. Athletic, quick on the turn, still learning positional discipline at the top level."),
    ("Mohamed Elneny", "Arsenal", 72, "DM", "Reliable squad midfielder. Keeps things ticking, rarely loses the ball, but lacks the dynamism to start regularly at this level."),
    ("Kepa Arrizabalaga", "Arsenal", 75, "GK", "Backup keeper with a point to prove. Shot-stopping has improved but distribution and command of area remain inconsistent."),
    ("Piero Hincapié", "Arsenal", 81, "CD", "Left-footed centre-back comfortable bringing the ball out from the back. Quick recovery pace, reads the game well. Growing into a top-level defender."),
    ("Noni Madueke", "Arsenal", 83, "WF", "Direct, skilful winger who loves cutting inside onto his left. Creates chances out of nothing, occasionally frustrating with decision-making."),
    ("Myles Lewis-Skelly", "Arsenal", 68, "WD", "Exciting academy graduate. Glides past defenders, already showing composure beyond his years. Needs minutes to develop physically."),
    ("Jack Porter", "Arsenal", 62, "GK", "Young academy goalkeeper. Made his debut but firmly third choice. Needs loan experience."),
    ("Eberechi Eze", "Arsenal", 84, "AM", "Silky technical ability, glides past defenders effortlessly. Creates and scores in equal measure. Injury history is the only question mark."),

    # ═══════════════════════════════════════════════════════════════════════════
    # LIVERPOOL
    # ═══════════════════════════════════════════════════════════════════════════
    ("Alexis Mac Allister", "Liverpool", 86, "CM", "World Cup winner who controls tempo. Two-footed, press-resistant, picks the killer pass. Occasional defensive lapses but intelligence compensates."),
    ("Andy Robertson", "Liverpool", 82, "WD", "Relentless left-back. Lung-busting overlaps, dangerous deliveries, and a leader in the dressing room. Pace declining but positional sense growing."),
    ("Cody Gakpo", "Liverpool", 83, "CF", "Versatile forward who can play across the front three. Powerful, direct runner with a thunderous left foot. Best through the middle under Slot."),
    ("Conor Bradley", "Liverpool", 78, "WD", "Northern Irish right-back with boundless energy. Overlaps constantly, delivers quality crosses. Still learning when to stay rather than bomb forward."),
    ("Curtis Jones", "Liverpool", 79, "CM", "Homegrown midfielder with silk on the ball. Carries well, plays incisive passes. Consistency is the barrier to becoming a regular starter."),
    ("Darwin Nunez", "Liverpool", 82, "CF", "Chaotic, electric striker. Devastating pace and movement, finishing wildly inconsistent. On his day, unplayable. On others, infuriating."),
    ("Dominik Szoboszlai", "Liverpool", 83, "CM", "Hungarian playmaker with a cannon of a right foot. Covers huge ground, links midfield to attack. Set-piece specialist with genuine goal threat."),
    ("Federico Chiesa", "Liverpool", 79, "WF", "When fit, an explosive winger who scores big goals. The problem is staying fit. Pace, directness, and finishing ability are all there — availability isn't."),
    ("Giorgi Mamardashvili", "Liverpool", 80, "GK", "Commanding Georgian keeper signed as Alisson's heir. Quick reactions, brave shot-stopper. Distribution still adjusting to Slot's demands."),
    ("Harvey Elliot", "Liverpool", 78, "CM", "Creative midfielder with an eye for a pass. Drifts into pockets, creates chances. Lacks the physicality to dominate midfield battles."),
    ("Joe Gomez", "Liverpool", 80, "CD", "Versatile defender who covers centre-back and full-back. Recovery pace is elite. Injury history has stunted a career that promised more."),
    ("Wataru Endo", "Liverpool", 77, "DM", "Intelligent Japanese midfielder. Reads passing lanes, wins the ball cleanly, distributes simply. Not flashy but effective."),
    ("Stefan Bajcetic", "Liverpool", 72, "DM", "Technically refined young midfielder. Reads the game maturely but needs more physicality and minutes to fulfil potential."),
    ("Milos Kerkez", "Liverpool", 80, "WD", "Aggressive Hungarian left-back. Attacks the space relentlessly, delivers quality crosses. Defensive positioning still a work in progress."),
    ("Jeremie Frimpong", "Liverpool", 84, "WD", "Electric wingback with devastating pace. Creates overloads on the right, scores goals from deep. Defensive awareness the only concern."),
    ("Hugo Ekitike", "Liverpool", 78, "CF", "Elegant French striker. Silky touch, intelligent movement, but needs to add physicality and consistency to match his talent."),

    # ═══════════════════════════════════════════════════════════════════════════
    # MANCHESTER CITY
    # ═══════════════════════════════════════════════════════════════════════════
    ("Ederson", "Manchester City", 86, "GK", "The goalkeeper who redefined the position at City. Sweeper-keeper supreme, outrageous distribution, brave in 1v1s. Shot-stopping occasionally questioned."),
    ("John Stones", "Manchester City", 85, "CD", "Centre-back who plays like a midfielder. Steps into midfield naturally, starts attacks from deep. Injury-prone but exceptional when available."),
    ("Nathan Aké", "Manchester City", 83, "CD", "Reliable left-footed centre-back. Calm under pressure, aerially strong, comfortable on the ball. Not spectacular but consistently solid."),
    ("Mateo Kovacic", "Manchester City", 83, "CM", "Silky ball-carrier who drives through midfield. Press-resistant, technically immaculate. Doesn't score enough but his progression is invaluable."),
    ("Matheus Nunes", "Manchester City", 80, "CM", "Powerful Portuguese midfielder with box-to-box capability. Carries the ball well, aggressive in duels. Decision-making in the final third needs work."),
    ("Jeremy Doku", "Manchester City", 83, "WF", "Explosive Belgian winger. Terrifying pace and dribbling ability, takes on anyone. End product — crossing and finishing — is the limiting factor."),
    ("Omar Marmoush", "Manchester City", 84, "CF", "Egyptian forward who exploded in the Bundesliga. Pace, directness, goal threat from anywhere. Adapting to Pep's system."),
    ("Sávinho", "Manchester City", 82, "WF", "Tricky Brazilian winger with quick feet and an eye for the unexpected. Skips past defenders, delivers dangerous balls. Still raw but exciting."),
    ("Rayan Cherki", "Manchester City", 79, "WF", "Prodigiously talented French playmaker. Can do anything with the ball but consistency and off-ball work have held him back from stardom."),
    ("Marc Guehi", "Manchester City", 83, "CD", "England centre-back with composure beyond his years. Reads the game, leads the line, and plays out from the back. Smart, reliable, modern defender."),
    ("Abdukodir Khusanov", "Manchester City", 77, "CD", "Young Uzbek centre-back. Physically imposing, aggressive in duels. Adapting to the Prem's pace after arriving from Ligue 1."),
    ("Rico Lewis", "Manchester City", 79, "WD", "Pep's inverted full-back prototype. Tiny but incredibly intelligent — reads spaces, receives in pockets, controls tempo from right-back."),
    ("Stefan Ortega", "Manchester City", 79, "GK", "Dependable backup keeper with excellent distribution. Shot-stopping solid, comfortable with the ball at his feet."),
    ("Kalvin Phillips", "Manchester City", 73, "CM", "Fell from England regular to City's bench. Passing range is excellent but lacks the mobility for Pep's system. Needs a fresh start."),
    ("Rayan Ait-Nouri", "Manchester City", 81, "WD", "Marauding Algerian left-back. Explosive going forward, delivers quality crosses. Defensive lapses remain but the attacking output is outstanding."),
    ("James Trafford", "Manchester City", 70, "GK", "English goalkeeper prospect. Needs a loan to develop — not ready for City's first team."),
    ("Antoine Semenyo", "Manchester City", 77, "WF", "Powerful, direct winger. Pace and physicality cause problems but final ball and decision-making need refinement."),

    # ═══════════════════════════════════════════════════════════════════════════
    # CHELSEA
    # ═══════════════════════════════════════════════════════════════════════════
    ("Levi Colwill", "Chelsea", 82, "CD", "Left-footed centre-back with tremendous potential. Comfortable on the ball, aggressive in duels, can play left-back. One of England's best young defenders."),
    ("Malo Gusto", "Chelsea", 82, "WD", "Athletic French right-back. Rapid recovery pace, overlaps with purpose. Defensively sound and still improving."),
    ("Marc Cucurella", "Chelsea", 81, "WD", "Tenacious Spanish left-back. Presses relentlessly, gets forward, and defends with aggression. Crossing quality divides opinion."),
    ("Enzo Fernandez", "Chelsea", 85, "DM", "World Cup winner with elite passing range. Dictates tempo, switches play effortlessly. Still adjusting to the physicality of the Premier League."),
    ("Pedro Neto", "Chelsea", 83, "WF", "Electric Portuguese winger. Devastating pace, direct running, eye-catching skill. When fit, one of the league's most dangerous dribblers."),
    ("Romeo Lavia", "Chelsea", 80, "DM", "Belgian defensive midfielder with an old head on young shoulders. Reads the game intelligently, passes precisely. Injuries robbed his first season."),
    ("Wesley Fofana", "Chelsea", 81, "CD", "When fit, a dominant centre-back. Pace, power, reading of the game. But two ACL injuries mean fitness is a constant question mark."),
    ("Benoit Badiashile", "Chelsea", 77, "CD", "Tall left-footed centre-back. Good on the ball, uses his frame well. Pace is a concern against the Premier League's quickest forwards."),
    ("Robert Sánchez", "Chelsea", 79, "GK", "Commanding keeper with good distribution. Prone to occasional errors that undermine his otherwise solid shot-stopping."),
    ("Tosin Adarabioyo", "Chelsea", 77, "CD", "Free transfer who brings experience and composure. Not spectacular but rarely makes mistakes. Smart defender."),
    ("Mykhaylo Mudryk", "Chelsea", 76, "WF", "Raw Ukrainian winger with explosive pace. End product has been desperately disappointing since his big move. Potential still flickers occasionally."),
    ("Axel Disasi", "Chelsea", 78, "CD", "French centre-back who can also cover right-back. Physically strong, aggressive. Positional errors creep in under sustained pressure."),
    ("Raheem Sterling", "Chelsea", 79, "WF", "Experienced England international. Pace and movement still dangerous but confidence and end product have waned. Still capable of match-winning moments."),
    ("Kendry Paez", "Chelsea", 68, "WF", "Ecuadorian teenage prodigy. Technically gifted with flair and creativity. Far too young to judge but the talent is obvious."),
    ("Ben Chilwell", "Chelsea", 76, "WD", "England left-back frozen out. When fit and playing, a reliable attacking full-back with quality delivery. Career has stalled."),
    ("Trevor Chalobah", "Chelsea", 76, "CD", "Academy product with genuine ability. Strong, quick, plays out from the back. Needs consistent minutes to reach his ceiling."),
    ("Jorrel Hato", "Chelsea", 79, "CD", "Dutch teenager with extraordinary composure. Left-footed, versatile, already looks at home at the top level. One of Europe's most exciting defensive prospects."),
    ("Liam Delap", "Chelsea", 78, "CF", "Old-fashioned English striker. Physical, aggressive, runs the channels. Scoring record improving steadily."),
    ("Josh Acheampong", "Chelsea", 72, "WD", "Explosive academy right-back. Rapid, powerful, takes on defenders. Raw but the athleticism is remarkable."),

    # ═══════════════════════════════════════════════════════════════════════════
    # MANCHESTER UNITED
    # ═══════════════════════════════════════════════════════════════════════════
    ("Amad Diallo", "Manchester United", 82, "WF", "Ivorian winger who has finally arrived. Quick feet, clever movement, delivers in big moments. Consistency game-to-game is the next step."),
    ("Diogo Dalot", "Manchester United", 80, "WD", "Portuguese right-back with quality on the ball. Good crosser, comfortable in possession. Defensive 1v1s remain a weakness."),
    ("Lisandro Martinez", "Manchester United", 85, "CD", "Ferocious Argentine defender. Undersized but outcompetes everyone through aggression, timing, and intelligence. Ball-playing ability is elite for a CB."),
    ("Matthijs de Ligt", "Manchester United", 82, "CD", "Dutch centre-back with all the tools — pace, heading, composure. Not yet reached the heights his Ajax days promised. Steady rather than spectacular."),
    ("Luke Shaw", "Manchester United", 80, "WD", "England's best left-back when fit. Powerful overlapping runs, excellent delivery, solid defensively. But 'when fit' does a lot of heavy lifting."),
    ("Manuel Ugarte", "Manchester United", 82, "DM", "Uruguayan destroyer. Wins the ball everywhere, presses relentlessly, never stops running. Distribution is functional rather than creative."),
    ("Noussair Mazraoui", "Manchester United", 79, "WD", "Moroccan right-back comfortable either side. Technical, intelligent, but physically slight for the Premier League's intensity."),
    ("Joshua Zirkzee", "Manchester United", 77, "CF", "Elegant Dutch striker. Drops deep, links play beautifully, but lacks the killer instinct in front of goal. More facilitator than finisher."),
    ("Mason Mount", "Manchester United", 77, "CM", "England midfielder whose career has been derailed by injuries. Intelligent movement, eye for goal, work rate. Needs to stay fit."),
    ("Leny Yoro", "Manchester United", 79, "CD", "French teenage centre-back with extraordinary composure. Reads the game maturely, long-legged, deceptively quick. Long-term injury delayed his debut."),
    ("Kobbie Mainoo", "Manchester United", 81, "CM", "Homegrown midfielder who burst onto the scene. Drives with the ball, finds passes in tight spaces, scores important goals. United's future."),
    ("Alejandro Garnacho", "Manchester United", 79, "WF", "Argentine winger with flair and fearlessness. Scores spectacular goals, frustrates with wastefulness. Raw talent that needs channelling."),
    ("Jonny Evans", "Manchester United", 73, "CD", "Veteran centre-back. Still reads the game superbly but pace has gone. Emergency option, reliable mentor."),
    ("Marcus Rashford", "Manchester United", 82, "WF", "Pace, directness, and goal threat when confident. Inconsistent form and off-pitch noise have overshadowed genuine top-level ability."),
    ("Patrick Dorgu", "Manchester United", 78, "WD", "Danish full-back with attacking instincts. Versatile, energetic, still developing his defensive game."),
    ("Matheus Cunha", "Manchester United", 82, "CF", "Brazilian forward with flair and fight. Links play creatively, scores important goals, brings energy. Can be ill-disciplined."),
    ("Bryan Mbeumo", "Manchester United", 81, "WF", "Clinical Cameroonian winger. Sharp in the box, intelligent movement, surprisingly physical. Proven Premier League goalscorer."),
    ("Harry Maguire", "Manchester United", 77, "CD", "England centre-back. Aerial dominance and ball-carrying ability offset by lack of pace and recovery. Divides opinion but remains useful."),
    ("André Onana", "Manchester United", 82, "GK", "Cameroonian keeper with elite distribution. Plays out from the back fearlessly. Shot-stopping solid but occasional sweeper-keeper errors."),
    ("Benjamin Šeško", "Manchester United", 84, "CF", "Slovenian striker with devastating physical attributes. 6'4, rapid, powerful, clinical. A genuine number 9 for the modern game."),

    # ═══════════════════════════════════════════════════════════════════════════
    # REAL MADRID
    # ═══════════════════════════════════════════════════════════════════════════
    ("Antonio Rudiger", "Real Madrid", 85, "CD", "German centre-back with pace and aggression. Commands the backline, wins aerial duels, brings the ball out. Occasional reckless moments."),
    ("Arda Güler", "Real Madrid", 78, "AM", "Turkish teenager with a wand of a left foot. Scores beautiful goals, creates chances from nothing. Needs more minutes but the talent is generational."),
    ("Aurelien Tchouameni", "Real Madrid", 85, "DM", "French midfield anchor. Covers ground relentlessly, wins the ball, plays forward passes. Long-range shooting adds another dimension."),
    ("Eduardo Camavinga", "Real Madrid", 85, "CM", "French midfielder who does everything. Carries the ball, tackles ferociously, plays incisive passes. Versatile enough to play left-back. Frighteningly good for his age."),
    ("Rodrygo", "Real Madrid", 86, "WF", "Brazilian winger who delivers in the biggest moments. Two-footed, intelligent movement, scores crucial Champions League goals. Underrated."),
    ("Endrick", "Real Madrid", 73, "CF", "Brazilian wonderkid. Powerful, direct, scores spectacular goals. Still 18 — needs patience and development time."),
    ("Ferland Mendy", "Real Madrid", 82, "WD", "Solid French left-back. Quick, strong, disciplined defensively. Not the most creative going forward but rarely beaten."),
    ("David Alaba", "Real Madrid", 82, "CD", "Austrian defender recovering from a long-term ACL injury. When fit, world-class: left-footed, composed, reads the game perfectly. Fitness is the question."),
    ("Andriy Lunin", "Real Madrid", 79, "GK", "Ukrainian keeper who deputised brilliantly. Good shot-stopper, brave, improving distribution. Solid number two."),
    ("Fran Garcia", "Real Madrid", 77, "WD", "Homegrown left-back. Tenacious, attacks with intent, but defensively exposed against top wingers."),
    ("Lucas Vasquez", "Real Madrid", 78, "WM", "Mr. Reliable. Right-back, right-wing, wherever needed. Professional, experienced, always gives 7/10. Madrid through and through."),
    ("Brahim Diaz", "Real Madrid", 77, "CM", "Moroccan playmaker with quick feet. Creates in tight spaces, scores lovely goals. Lacks the physicality to dominate but technically gifted."),
    ("Dani Ceballos", "Real Madrid", 76, "CM", "Spanish midfielder with excellent close control. Keeps possession well but rarely accelerates play. Squad option."),
    ("Dean Huijsen", "Real Madrid", 77, "CD", "Tall, left-footed Spanish-Dutch centre-back. Good in the air, comfortable on the ball. Still very young and developing."),

    # ═══════════════════════════════════════════════════════════════════════════
    # BARCELONA
    # ═══════════════════════════════════════════════════════════════════════════
    ("Alejandro Balde", "Barcelona", 81, "WD", "Rapid Spanish left-back. Explosive going forward, terrorises defenders with pace. Defensive positioning still maturing."),
    ("Andreas Christensen", "Barcelona", 80, "CD", "Danish centre-back. Calm, composed, reads the game. Not the quickest but smart positioning compensates. Underrated at this level."),
    ("Frenkie de Jong", "Barcelona", 84, "CM", "Dutch midfielder who glides past pressure. Unique ability to carry the ball from deep. Injuries have robbed peak years but the talent is undeniable."),
    ("Fermín López", "Barcelona", 79, "CM", "Olympic gold medallist. Arrives in the box, scores goals, brings energy. More of a goal-scoring midfielder than a playmaker."),
    ("Ferran Torres", "Barcelona", 78, "WF", "Spanish forward who knows where the goal is. Movement is intelligent, finishing clinical. Lacks the dribbling and pace to beat defenders one-on-one."),
    ("Gavi", "Barcelona", 82, "CM", "Ferocious Spanish midfielder. Tenacity, aggression, and technical quality in equal measure. Recovering from ACL but expected to return to his best."),
    ("Iñigo Martínez", "Barcelona", 80, "CD", "Experienced Basque centre-back. Left-footed, strong in the air, organises the defence. Not the fastest but intelligent and dependable."),
    ("Jules Koundé", "Barcelona", 85, "CD", "French centre-back playing right-back brilliantly. Quick, aggressive, comfortable on the ball. One of the best defenders in La Liga."),
    ("Robert Lewandowski", "Barcelona", 86, "CF", "Ageless Polish striker. Positioning, finishing, and movement are still world-class. Pace has gone but the brain compensates."),
    ("Marc Casadó", "Barcelona", 80, "DM", "La Masia graduate breaking into the first team. Composed defensive midfielder, reads the game, distributes cleanly. The next Busquets prototype."),
    ("Pau Cubarsi", "Barcelona", 80, "CD", "17-year-old centre-back playing like a veteran. Extraordinary composure, reads the game, steps out with the ball. Generational defensive talent."),
    ("Wojciech Szczesny", "Barcelona", 78, "GK", "Came out of retirement for Barcelona. Experienced shot-stopper with good reflexes. Distribution not Barça-level but reliability is valued."),
    ("Roony Bardghji", "Barcelona", 73, "WF", "Swedish teenage winger. Quick, skilful, direct. Still very raw but the potential is exciting."),
    ("Eric Garcia", "Barcelona", 77, "CD", "Technically excellent centre-back. Reads the game well, plays out beautifully. Pace and physicality are genuine weaknesses."),
    ("Gerard Martin", "Barcelona", 74, "CD", "Academy centre-back getting minutes. Solid, dependable, but unlikely to be a long-term starter at this level."),
    ("Marc Bernal", "Barcelona", 72, "CM", "Highly rated La Masia midfielder. Mature beyond his years but recovering from a serious knee injury."),

    # ═══════════════════════════════════════════════════════════════════════════
    # BAYERN MUNICH
    # ═══════════════════════════════════════════════════════════════════════════
    ("Manuel Neuer", "Bayern Munich", 84, "GK", "The greatest sweeper-keeper ever. Reflexes still sharp, commands the box, distribution is world-class. Age is catching up but experience compensates."),
    ("Dayot Upamecano", "Bayern Munich", 83, "CD", "French centre-back with pace and power. Dominant physically, aggressive in duels. Occasional concentration lapses undermine otherwise elite ability."),
    ("Kim Min-Jae", "Bayern Munich", 84, "CD", "Korean centre-back. Aerially dominant, quick for his size, reads the game well. Adapted to European football impressively."),
    ("Aleksandar Pavlovic", "Bayern Munich", 79, "DM", "German teenage midfielder with a calm head. Distributes cleanly, positions intelligently. Already trusted in big games."),
    ("Jonathan Tah", "Bayern Munich", 83, "CD", "German international centre-back. Strong, commanding, left-footed, leads the line. Arrived to anchor Bayern's defence."),
    ("Leon Goretzka", "Bayern Munich", 81, "CM", "Box-to-box German midfielder. Powerful runner, scores goals, physically imposing. Fell out of favour but talent is undeniable."),
    ("Konrad Laimer", "Bayern Munich", 79, "CM", "Austrian pressing machine. Wins the ball everywhere, covers enormous ground. Not creative but his energy is infectious."),
    ("Michael Olise", "Bayern Munich", 86, "WF", "Devastating creative winger. Left foot produces magic — assists, goals, set-pieces. Olympic gold winner. On a rapid upward trajectory."),
    ("Leroy Sané", "Bayern Munich", 83, "WM", "German winger with electric pace and a wand of a left foot. Devastating on his day but consistency and effort off the ball frustrate."),
    ("Serge Gnabry", "Bayern Munich", 80, "WF", "German wide forward. Pace, directness, clinical finishing on his day. Injuries and form have seen him slip from starter to rotation."),
    ("Sacha Boey", "Bayern Munich", 77, "WD", "Turkish-French right-back. Quick, attack-minded, but injuries have severely disrupted his settling-in period."),
    ("Sven Ulreich", "Bayern Munich", 73, "GK", "Veteran backup goalkeeper. Dependable, experienced, knows the club. Not starter quality at this level."),
    ("Tom Bischof", "Bayern Munich", 69, "CM", "German teenage midfielder. Technically promising, arrived from Hoffenheim. Needs development time."),
    ("Raphaël Adelino José Guerreiro", "Bayern Munich", 80, "WD", "Portuguese left-back with midfielder's feet. Creative, intelligent, delivers quality balls. Defensive discipline questionable."),

    # ═══════════════════════════════════════════════════════════════════════════
    # BORUSSIA DORTMUND
    # ═══════════════════════════════════════════════════════════════════════════
    ("Gregor Kobel", "Borussia Dortmund", 84, "GK", "Swiss number one. Excellent shot-stopper, commanding presence, improving distribution. One of the Bundesliga's best keepers."),
    ("Nico Schlotterbeck", "Borussia Dortmund", 82, "CD", "Left-footed German centre-back. Aggressive, carries the ball forward, strong in the air. Occasional rash moments."),
    ("Julian Brandt", "Borussia Dortmund", 82, "CM", "German playmaker with silky technique. Creates from deep, scores from distance, sets the creative tempo. Inconsistency frustrates."),
    ("Serhou Guirassy", "Borussia Dortmund", 83, "CF", "Guinean striker who scored 30 in his first Dortmund season. Clinical finisher, intelligent movement. Late bloomer thriving at the top."),
    ("Emre Can", "Borussia Dortmund", 78, "DM", "Experienced German-Turkish midfielder. Versatile, physically strong. Captain's armband but form has declined."),
    ("Marcel Sabitzer", "Borussia Dortmund", 80, "CM", "Austrian all-rounder. Runs, tackles, scores. Reliable contributor without being spectacular."),
    ("Karim Adeyemi", "Borussia Dortmund", 79, "WF", "Rapid German winger. Terrifying pace, exciting dribbler. End product and injury record hold him back from the next level."),
    ("Felix Nmecha", "Borussia Dortmund", 77, "CM", "German midfielder. Physical, carries the ball well. Still finding consistency at this level."),
    ("Maximilian Beier", "Borussia Dortmund", 78, "CF", "German forward with pace and intelligence. Presses from the front, runs in behind. Growing into a reliable option."),
    ("Waldemar Anton", "Borussia Dortmund", 81, "CD", "German centre-back who captained Stuttgart. Reliable, aerially strong, good on the ball. Solid Bundesliga defender."),
    ("Jamie Bynoe-Gittens", "Borussia Dortmund", 76, "WF", "English winger with electrifying pace and skill. Exciting but raw — needs to improve consistency and decision-making."),
    ("Yan Couto", "Borussia Dortmund", 78, "WD", "Brazilian right-back. Technically excellent, overlaps with quality. Defensively still developing."),
    ("Ramy Bensebaini", "Borussia Dortmund", 78, "WD", "Algerian left-back. Solid, experienced, competitive. Not flashy but reliable."),
    ("Gio Reyna", "Borussia Dortmund", 75, "AM", "American playmaker whose career has stalled through injuries. Technical quality is obvious but availability and confidence are concerns."),

    # ═══════════════════════════════════════════════════════════════════════════
    # BAYER LEVERKUSEN
    # ═══════════════════════════════════════════════════════════════════════════
    ("Robert Andrich", "Bayer Leverkusen", 83, "DM", "Transformed from journeyman to invincible-season midfielder. Physical presence, long-range shooting, tireless pressing. Late bloomer."),
    ("Álex Grimaldo", "Bayer Leverkusen", 84, "WD", "Spanish left-back with a wand of a left foot. Set-piece specialist, delivers quality crosses, scores free kicks. Defensive work improved."),
    ("Edmond Tapsoba", "Bayer Leverkusen", 82, "CD", "Burkinabé centre-back. Quick, strong, composed. One of the Bundesliga's most complete defenders."),
    ("Exequiel Palacios", "Bayer Leverkusen", 80, "CM", "Argentine midfielder. Technically refined, controls the tempo. Injuries limited his peak but quality shines through."),
    ("Patrik Schick", "Bayer Leverkusen", 79, "CF", "Czech striker with an eye for the spectacular. Clinical finisher, aerial threat. Injury record limits availability."),
    ("Jonas Hofmann", "Bayer Leverkusen", 78, "AM", "German utility player. Right-back, right-wing, central midfield — does everything competently. Intelligence over athleticism."),
    ("Aleix Garcia", "Bayer Leverkusen", 80, "CM", "Spanish possession midfielder. Metronomic passing, controls the ball, dictates rhythm. Not dynamic but technically superb."),
    ("Nathan Tella", "Bayer Leverkusen", 76, "WF", "English-Nigerian winger. Direct, pacy, improving. Solid rotation option."),
    ("Malik Tillman", "Bayer Leverkusen", 77, "AM", "American-German attacking midfielder. Creative, scores goals, versatile. Consistency is the barrier."),
    ("Martin Terrier", "Bayer Leverkusen", 78, "WF", "French forward. Left-footed, clinical, good movement. Injuries slowed his impact."),

    # ═══════════════════════════════════════════════════════════════════════════
    # INTER MILAN
    # ═══════════════════════════════════════════════════════════════════════════
    ("Nicolo Barella", "Inter Milan", 87, "CM", "Italy's best midfielder. Box-to-box engine who scores, assists, tackles, and creates. Lung-busting runs, technical quality, leadership."),
    ("Hakan Calhanoglu", "Inter Milan", 84, "CM", "Turkish playmaker reinvented as a regista. Long-range passing, penalty expertise, set-piece quality. Transformed under Inzaghi."),
    ("Federico Dimarco", "Inter Milan", 84, "WD", "Italian wing-back with a wand of a left foot. Crosses, free kicks, and aggressive attacking runs. A joy to watch going forward."),
    ("Marcus Thuram", "Inter Milan", 84, "CF", "French striker who has become one of Serie A's best. Powerful, quick, clinical. Improved dramatically in front of goal."),
    ("Denzel Dumfries", "Inter Milan", 80, "WD", "Dutch wing-back. Explosive pace, powerful running, arrives late in the box. Crossing can be erratic."),
    ("Yann Sommer", "Inter Milan", 82, "GK", "Swiss keeper who seamlessly replaced Onana. Reliable shot-stopper, calm presence, reads the game well. Distribution adequate."),
    ("Davide Frattesi", "Inter Milan", 80, "CM", "Italian midfielder with a knack for goals. Arrives in the box, times runs perfectly. Not a creator but a goal-scoring 8."),
    ("Henrik Mkhitaryan", "Inter Milan", 78, "CM", "Armenian veteran still contributing. Intelligence and technical quality compensate for declining athleticism. Smart squad player."),
    ("Francesco Acerbi", "Inter Milan", 79, "CD", "Italian veteran centre-back. Reads the game brilliantly, positions perfectly. Pace has gone but the brain remains sharp."),
    ("Yann Bisseck", "Inter Milan", 79, "CD", "German centre-back improving rapidly. Physical, aggressive, comfortable on the ball. Growing into a key defender."),
    ("Stefan de Vrij", "Inter Milan", 79, "CD", "Dutch centre-back. Experienced, composed, distributes well from the back. Not the quickest but smart and reliable."),
    ("Piotr Zieliński", "Inter Milan", 80, "CM", "Polish midfielder with a silky left foot. Creates chances, scores from distance, links play. Consistency varies."),
    ("Manuel Akanji", "Inter Milan", 83, "CD", "Swiss centre-back. Quick, composed, plays out from the back. Top-level defender comfortable in any system."),

    # ═══════════════════════════════════════════════════════════════════════════
    # JUVENTUS
    # ═══════════════════════════════════════════════════════════════════════════
    ("Dušan Vlahović", "Juventus", 83, "CF", "Serbian striker with a thunderous shot. Clinical from distance, strong in the air. Needs better service but the goal threat is genuine."),
    ("Andrea Cambiaso", "Juventus", 82, "WD", "Italian utility defender. Plays right-back, left-back, wing-back. Technically sound, smart positionally, versatile."),
    ("Federico Gatti", "Juventus", 79, "CD", "Italian centre-back who rose from Serie C. Aggressive, aerially dominant. Ball-playing ability improving but still a work in progress."),
    ("Teun Koopmeiners", "Juventus", 83, "CM", "Dutch midfielder who can play anywhere in midfield. Long-range shooting, set-piece quality, box-to-box capability. A complete midfielder."),
    ("Manuel Locatelli", "Juventus", 79, "CM", "Italian midfielder. Tidy in possession, controls tempo. Lacks the dynamism to dominate but keeps things moving."),
    ("Weston McKennie", "Juventus", 77, "CM", "American box-to-box midfielder. Energy, aggression, arrives in the box. Technically limited but effort is never in question."),
    ("Michele Di Gregorio", "Juventus", 80, "GK", "Italian keeper enjoying a breakthrough. Shot-stopping excellent, commanding, comfortable with the ball. Growing in confidence."),
    ("Bremer", "Juventus", 83, "CD", "Brazilian centre-back. Physical monster — pace, strength, aerial dominance. ACL injury was devastating but the ability is top-tier."),
    ("Francisco Conceição", "Juventus", 81, "WF", "Portuguese winger. Quick, skilful, direct. Son of Sérgio — same intensity, same ability to beat a man. Exciting talent."),
    ("Pierre Kalulu", "Juventus", 78, "WD", "French defender. Versatile, quick, smart. Adapted well after leaving Milan. Solid rather than spectacular."),
    ("Khéphren Thuram", "Juventus", 79, "CM", "French midfielder with physical presence. Carries the ball powerfully, covers ground. Still developing his passing game."),
    ("Kenan Yıldız", "Juventus", 79, "WF", "Turkish-German teenager. Technically gifted, creative, plays beyond his years. One of Serie A's most exciting young players."),

    # ═══════════════════════════════════════════════════════════════════════════
    # AC MILAN
    # ═══════════════════════════════════════════════════════════════════════════
    ("Rafael Leao", "AC Milan", 86, "WF", "Portuguese winger with terrifying pace and skill. Unplayable on his day — glides past defenders, scores spectacular goals. Effort off the ball questioned."),
    ("Christian Pulisic", "AC Milan", 82, "WF", "American winger revitalised in Milan. Work rate, goals, and consistency have all improved. Plays with freedom and confidence in Serie A."),
    ("Tijani Reijnders", "AC Milan", 83, "CM", "Dutch midfielder who drives through the lines. Carries the ball beautifully, scores goals, improving rapidly. Milan's engine."),
    ("Fikayo Tomori", "AC Milan", 81, "CD", "English centre-back thriving in Italy. Pace, aggression, and improving positional play. Commands the backline with growing authority."),
    ("Youssouf Fofana", "AC Milan", 81, "CM", "French defensive midfielder. Physical, wins duels, distributes simply. Provides the steel that lets others create."),
    ("Ruben Loftus-Cheek", "AC Milan", 78, "CM", "Powerful English midfielder who found his level in Milan. Drives forward, physically dominant. Final ball can let him down."),
    ("Strahinja Pavlović", "AC Milan", 78, "CD", "Serbian centre-back. Aerially dominant, aggressive, left-footed. Adapting to Italian defensive discipline."),
    ("Samuele Ricci", "AC Milan", 80, "CM", "Italian playmaker. Metronomic passing, intelligent positioning, controls tempo. Rising star in Italian football."),
    ("Santiago Giménez", "AC Milan", 80, "CF", "Mexican striker who scores goals wherever he goes. Clinical finisher, good movement, physical. Proved himself in Eredivisie and beyond."),
    ("Christopher Nkunku", "AC Milan", 83, "CM", "French forward/midfielder. Scores from everywhere — head, both feet, set-pieces. Versatile, intelligent, always dangerous. Injury history is the caveat."),
    ("Pervis Estupinan", "AC Milan", 79, "WD", "Ecuadorian left-back. Rapid, attacks the space, delivers crosses. Defensive positioning improving."),

    # ═══════════════════════════════════════════════════════════════════════════
    # NAPOLI
    # ═══════════════════════════════════════════════════════════════════════════
    ("Alessandro Buongiorno", "Napoli", 82, "CD", "Italian centre-back. Reads the game, comfortable on the ball, aerially strong. Conte's defensive linchpin."),
    ("Alex Meret", "Napoli", 80, "GK", "Italian keeper. Good reflexes, improving distribution. Reliable starter under Conte's demanding system."),
    ("Andre-Franck Zambo Anguissa", "Napoli", 82, "CM", "Cameroonian powerhouse. Physical dominance, carries the ball through pressure, covers enormous ground. Underrated."),
    ("David Neres", "Napoli", 80, "WF", "Brazilian winger. Tricky, quick, creates chances. Finally delivering consistent performances after a nomadic career."),
    ("Scott McTominay", "Napoli", 80, "CM", "Scottish midfielder who has thrived under Conte. Arrives in the box, scores goals, brings physicality. Found his level in Naples."),
    ("Stanislav Lobotka", "Napoli", 83, "CM", "Slovak metronome. Controls tempo, rarely loses the ball, reads the game from the base of midfield. One of Serie A's best deep-lying playmakers."),
    ("Giovanni Di Lorenzo", "Napoli", 82, "WD", "Italian right-back and captain. Reliable, attack-minded, experienced. Consistent performer at both club and international level."),
    ("Matteo Politano", "Napoli", 79, "WF", "Italian winger. Works tirelessly, cuts inside onto his left, delivers in Conte's system. Not spectacular but functional and reliable."),
    ("Rasmus Højlund", "Napoli", 79, "CF", "Danish striker with pace and power. Still developing his all-round game but the physical tools and finishing ability are there."),
    ("Romelu Lukaku", "Napoli", 80, "CF", "Belgian target man. Physical presence, back-to-goal play, and finishing still potent. Mobility declining but Conte's system suits him."),
    ("Billy Gilmour", "Napoli", 78, "DM", "Scottish midfielder. Technically excellent, passes crisply, controls the ball. Lacks physicality but reads the game smartly."),
    ("Mathías Olivera", "Napoli", 79, "WD", "Uruguayan left-back. Solid defensively, gets forward when needed. Reliable and consistent."),

    # ═══════════════════════════════════════════════════════════════════════════
    # PARIS SAINT-GERMAIN
    # ═══════════════════════════════════════════════════════════════════════════
    ("Bradley Barcola", "Paris Saint-Germain", 82, "WF", "French winger who has exploded since Mbappé's departure. Pace, dribbling, direct running. Already a France international and still improving."),
    ("Ousmane Dembele", "Paris Saint-Germain", 85, "WF", "French winger at his absolute peak. Devastating on either foot, creates chances from nothing. Finally found consistency under Luis Enrique."),
    ("Fabian Ruiz", "Paris Saint-Germain", 82, "CM", "Spanish midfielder with elegant left foot. Controls tempo, switches play, arrives in the box. Euro 2024 standout."),
    ("Warren Zaire-Emery", "Paris Saint-Germain", 81, "CM", "Youngest ever PSG first-team player. Mature beyond his years — tackles, passes, drives forward. France's future in midfield."),
    ("Lee Kang-in", "Paris Saint-Germain", 80, "AM", "Korean playmaker with vision and creativity. Delivers in tight spaces, scores beautiful goals. Thriving with more freedom post-Mbappé."),
    ("Willian Pacho", "Paris Saint-Germain", 81, "CD", "Ecuadorian centre-back. Quick, aggressive, composed. Adapted to Ligue 1 seamlessly and improving fast."),
    ("Lucas Hernandez", "Paris Saint-Germain", 81, "WD", "French left-back. Aggressive, defensively sound, experienced at the highest level. ACL recovery meant a slow return."),
    ("Lucas Beraldo", "Paris Saint-Germain", 77, "CD", "Brazilian centre-back. Young, quick, reads the game. Still developing but showing promise in a demanding environment."),
    ("Goncalo Ramos", "Paris Saint-Germain", 80, "CF", "Portuguese striker. Clinical finisher, intelligent movement. Filling the Mbappé void with goals and physicality."),
    ("Désiré Doué", "Paris Saint-Germain", 78, "WF", "French teenage talent. Creative, versatile, technically outstanding. Olympic gold winner. Learning the demands of top-level football."),
    ("Senny Mayulu", "Paris Saint-Germain", 72, "CM", "PSG academy midfielder. Technically gifted, intelligent. Needs minutes and patience."),
    ("Vitinha", "Paris Saint-Germain", 86, "CM", "Portuguese midfielder in world-class form. Dictates play, press-resistant, creates from deep. One of Ligue 1's very best."),

    # ═══════════════════════════════════════════════════════════════════════════
    # ATLÉTICO MADRID
    # ═══════════════════════════════════════════════════════════════════════════
    ("Jan Oblak", "Atlético Madrid", 86, "GK", "Slovenian wall. One of the best shot-stoppers in the world. Commanding presence, rarely beaten, organises the defence."),
    ("José María Giménez", "Atlético Madrid", 83, "CD", "Uruguayan centre-back. Aggressive, aerially dominant, leads from the back. Injury-prone but formidable when fit."),
    ("Julian Alvarez", "Atlético Madrid", 85, "CF", "Argentine World Cup winner. Intelligent movement, clinical finishing, works tirelessly. Not flashy but incredibly effective."),
    ("Conor Gallagher", "Atlético Madrid", 80, "CM", "English midfielder. Energy, pressing, box arrivals. Does the dirty work that coaches love. Limited technically but effective."),
    ("Alexander Sørloth", "Atlético Madrid", 80, "CF", "Norwegian target man. Physical, aerial, scores goals. Late bloomer who found his level in La Liga."),
    ("Robin Le Normand", "Atlético Madrid", 81, "CD", "Spanish-French centre-back. Reads the game, strong in the air, composed. Arrived from Real Sociedad as a proven La Liga defender."),
    ("Pablo Barrios", "Atlético Madrid", 79, "AM", "Spanish teenage midfielder. Technical quality, scores goals, improving rapidly. One of Atlético's most exciting academy products in years."),
    ("Nahuel Molina", "Atlético Madrid", 80, "WD", "Argentine right-back. Attack-minded, delivers crosses, scores goals. Defensive work improved under Simeone."),
    ("Koke", "Atlético Madrid", 79, "CM", "Atlético legend. Intelligence, leadership, passing quality. Pace has gone but reads the game like no one else."),
    ("Marcos Llorente", "Atlético Madrid", 80, "CM", "Spanish utility player. Can play everywhere — midfielder, right-back, forward. Pace, energy, and goals from deep."),

    # ═══════════════════════════════════════════════════════════════════════════
    # TOTTENHAM HOTSPUR
    # ═══════════════════════════════════════════════════════════════════════════
    ("Cristian Romero", "Tottenham Hotspur", 84, "CD", "Argentine centre-back. Aggressive to the point of reckless — wins everything, tackles ferociously. World-class on his day."),
    ("Micky van de Ven", "Tottenham Hotspur", 83, "CD", "Dutch centre-back with frightening pace. Starts counter-attacks by running from his own box. Technically excellent, aggressive. Injury-prone."),
    ("Son Heung-min", "Tottenham Hotspur", 85, "WF", "Korean legend. Still deadly — both feet, movement, finishing. The complete forward who can play across the front line."),
    ("James Maddison", "Tottenham Hotspur", 82, "CM", "English playmaker. Set-piece master, creates chances, scores goals. Fitness issues limit his availability."),
    ("Dejan Kulusevski", "Tottenham Hotspur", 82, "WF", "Swedish forward. Physical, direct, scores and assists. Can play wide or centrally. Underrated all-round contribution."),
    ("Guglielmo Vicario", "Tottenham Hotspur", 82, "GK", "Italian keeper. Brave, agile, vocal. Adjusted to the Premier League's pace impressively. One of Spurs' best signings."),
    ("Destiny Udogie", "Tottenham Hotspur", 81, "WD", "Italian-Nigerian left-back. Marauds forward, quick, aggressive. Still learning when to stay back but the attacking output is impressive."),
    ("Dominic Solanke", "Tottenham Hotspur", 79, "CF", "English striker. Good hold-up play, intelligent movement. Not elite but reliable and improving."),
    ("Rodrigo Bentancur", "Tottenham Hotspur", 80, "CM", "Uruguayan midfielder. Energetic, competitive, progresses the ball well. Consistency improved at Spurs."),
    ("Brennan Johnson", "Tottenham Hotspur", 79, "WF", "Welsh winger. Pace, directness, improving end product. Needs to add goals to become a consistent starter."),
    ("Archie Gray", "Tottenham Hotspur", 74, "CM", "English teenager. Versatile — midfield or right-back. Composed, intelligent, already looks comfortable. Big future."),
    ("Xavi Simons", "Tottenham Hotspur", 83, "CM", "Dutch sensation. Explosive, creative, scores spectacular goals. Arrived from PSG/Leipzig with massive expectations."),
    ("Mathys Tel", "Tottenham Hotspur", 76, "CF", "French teenage striker. Quick, skilful, instinctive. Needs consistent game time to develop."),
    ("Kevin Danso", "Tottenham Hotspur", 80, "CD", "Austrian centre-back. Physical, aggressive, wins aerial duels. Solid addition to the squad."),
    ("Yves Bissouma", "Tottenham Hotspur", 80, "DM", "Malian midfielder. Physical presence, wins the ball, carries it forward. Disciplinary issues and consistency hold him back."),

    # ═══════════════════════════════════════════════════════════════════════════
    # ASTON VILLA
    # ═══════════════════════════════════════════════════════════════════════════
    ("Emiliano Martinez", "Aston Villa", 87, "GK", "Argentine World Cup-winning keeper. Shot-stopping genius, penalty specialist, mind-games master. One of the world's best."),
    ("Pau Torres", "Aston Villa", 83, "CD", "Spanish left-footed centre-back. Elegant on the ball, reads the game, distributes beautifully. Lacks pace but brains compensate."),
    ("John McGinn", "Aston Villa", 81, "CM", "Scottish terrier. Non-stop running, combative, scores goals from midfield. Heart and soul of Villa."),
    ("Ollie Watkins", "Aston Villa", 84, "CF", "English striker. Movement is elite — runs channels, drops deep, stretches play. Finishing improved to match his intelligence."),
    ("Youri Tielemans", "Aston Villa", 81, "CM", "Belgian midfielder. Long-range passing, arrives in the box, experienced. Consistency varies but quality is evident."),
    ("Ezri Konsa", "Aston Villa", 81, "CD", "English centre-back. Quick, composed, improving aerially. One of the most underrated defenders in the Premier League."),
    ("Leon Bailey", "Aston Villa", 79, "WF", "Jamaican winger. Explosive pace, dangerous dribbler. Frustratingly inconsistent — brilliant one game, invisible the next."),
    ("Boubacar Kamara", "Aston Villa", 82, "CM", "French midfielder. ACL recovery, but when fit he's a defensive metronome. Reads the game, distributes cleanly, shields the defence."),
    ("John Duran", "Aston Villa", 79, "CF", "Colombian teenage striker. Physically powerful, instinctive finisher. Super sub extraordinaire — scores crucial goals off the bench."),
    ("Jadon Sancho", "Aston Villa", 79, "WF", "English winger rebuilding his career. Technical quality is undeniable — close control, creativity. Confidence and consistency the ongoing challenge."),
    ("Morgan Rogers", "Aston Villa", 80, "AM", "English attacking midfielder. Physical, direct, explosive. Breakthrough season showed genuine top-level potential."),
    ("Ian Maatsen", "Aston Villa", 79, "WD", "Dutch left-back. Quick, attack-minded, brave. Champions League experience adds maturity."),
    ("Donyell Malen", "Aston Villa", 80, "WF", "Dutch forward with pace and finishing. Clinical in front of goal, runs in behind. Adapting to the Premier League."),
    ("Matty Cash", "Aston Villa", 79, "WD", "Polish-English right-back. Gets forward, delivers crosses, reliable defensively. Solid rather than spectacular."),

    # ═══════════════════════════════════════════════════════════════════════════
    # NEWCASTLE UNITED
    # ═══════════════════════════════════════════════════════════════════════════
    ("Anthony Gordon", "Newcastle United", 83, "WF", "English winger who has become genuinely elite. Direct, scores goals, presses from the front. Transformed under Howe."),
    ("Fabian Schar", "Newcastle United", 80, "CD", "Swiss centre-back. Strong, aggressive, carries the ball out. Getting older but intelligence and physicality maintain his level."),
    ("Harvey Barnes", "Newcastle United", 80, "WF", "English winger. Pace and directness on the left. Scores goals, stretches defences. Injuries have disrupted rhythm."),
    ("Sven Botman", "Newcastle United", 82, "CD", "Dutch centre-back. Calm, composed, reads the game. Left-footed, aerially dominant. Long-term injury was a blow."),
    ("Joelinton", "Newcastle United", 80, "CM", "Brazilian midfielder reinvented from striker. Physical powerhouse, wins duels, drives forward. Unique profile in the Premier League."),
    ("Lewis Hall", "Newcastle United", 78, "WD", "English left-back. Technically excellent, comfortable on the ball. Still developing physically but the quality is clear."),
    ("Tino Livramento", "Newcastle United", 79, "WD", "English right-back. Quick, attack-minded, exciting going forward. Recovered well from a serious knee injury."),
    ("Aaron Ramsdale", "Newcastle United", 79, "GK", "English keeper. Good shot-stopper, vocal, commands the area. Distribution under Howe's system improving."),
    ("Joe Willock", "Newcastle United", 77, "AM", "English midfielder. Arrives in the box, scores goals. Lacks the craft to control games but his energy and goal threat are valuable."),
    ("Nick Pope", "Newcastle United", 81, "GK", "English keeper. Commanding, excellent shot-stopper, brave. Distribution basic but saves win points."),
    ("Dan Burn", "Newcastle United", 78, "WD", "Giant left-sided defender. 6'7, left-footed, surprisingly mobile. Cult hero who fills in at centre-back or left-back."),
    ("Malick Thiaw", "Newcastle United", 79, "CD", "German centre-back. Physical, aggressive, decent on the ball. Gaining experience at the top level."),
    ("Yoane Wissa", "Newcastle United", 80, "WF", "Congolese forward. Clinical finisher, intelligent movement, versatile across the front line."),
    ("Jacob Ramsey", "Newcastle United", 78, "CM", "English midfielder. Drives from box to box, scores goals. Injuries held back a player with enormous potential."),
]


def main():
    import psycopg2
    import psycopg2.extras

    print("35 — Manual Player Profiling")
    print(f"  {len(PROFILES)} profiles to apply")

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    updated = 0
    not_found = []
    duplicates = []

    for name, club, level, position, bio in PROFILES:
        # Find player by name + club
        cur.execute("""
            SELECT pe.id, pe.name, c.clubname, pp.level
            FROM people pe
            JOIN clubs c ON c.id = pe.club_id
            LEFT JOIN player_profiles pp ON pp.person_id = pe.id
            WHERE pe.name = %s AND c.clubname = %s AND pe.active = true
        """, (name, club))
        rows = cur.fetchall()

        if not rows:
            # Try without club (might be at a different club in DB)
            cur.execute("""
                SELECT pe.id, pe.name, c.clubname, pp.level
                FROM people pe
                LEFT JOIN clubs c ON c.id = pe.club_id
                LEFT JOIN player_profiles pp ON pp.person_id = pe.id
                WHERE pe.name = %s AND pe.active = true
            """, (name,))
            rows = cur.fetchall()

        if not rows:
            not_found.append(f"{name} ({club})")
            continue

        if len(rows) > 1:
            duplicates.append(f"{name}: {[(r['id'], r['clubname']) for r in rows]}")
            # Use the first match
            rows = [rows[0]]

        pid = rows[0]["id"]
        old_level = rows[0]["level"]

        if DRY_RUN:
            print(f"  {name:30} {club:20} L={old_level or '?':>3}→{level} {bio[:50]}...")
            updated += 1
            continue

        # Upsert level + position
        cur.execute("""
            INSERT INTO player_profiles (person_id, level, position)
            VALUES (%s, %s, %s)
            ON CONFLICT (person_id) DO UPDATE SET level = %s, position = %s, updated_at = NOW()
        """, (pid, level, position, level, position))

        # Upsert bio
        cur.execute("""
            INSERT INTO player_status (person_id, scouting_notes)
            VALUES (%s, %s)
            ON CONFLICT (person_id) DO UPDATE SET scouting_notes = %s
        """, (pid, bio, bio))

        updated += 1

    if not DRY_RUN:
        conn.commit()

    print(f"\n  Updated: {updated}")
    if not_found:
        print(f"  Not found ({len(not_found)}):")
        for nf in not_found:
            print(f"    {nf}")
    if duplicates:
        print(f"  Duplicates ({len(duplicates)}):")
        for d in duplicates:
            print(f"    {d}")

    if DRY_RUN:
        print("\n  --dry-run: no writes.")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
