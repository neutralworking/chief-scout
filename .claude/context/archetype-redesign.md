# Archetype Redesign — Earned Labels (v2, 2026-03-19)

## Architecture

```
Player
├── Archetype (0-1): Earned identity — "Hitman", "Maestro", "Rock"
│     └── + Legacy tag (0-1): Career modifier — "Icon", "Veteran", "Wonderkid"
├── Skillset (1-2): Attribute models — Striker-Sprinter, Controller-Passer
└── Role (computed): Tactical fit — Poacher, Regista, Inverted Winger
```

### Naming Rules
- Archetype names MUST NOT overlap with skillset names (13 models) or role names (32 roles)
- Archetypes are football clichés — how pundits and fans describe a player
- Skillsets are technical — what attributes define the player
- Roles are tactical — where they fit in a formation

### Forbidden names (already used as skillset or role):
Controller, Commander, Creator, Target, Sprinter, Powerhouse, Cover, Engine, Destroyer, Dribbler, Passer, Striker, GK,
Sweeper Keeper, Shot Stopper, Ball-Playing CB, Stopper, Sweeper, Ball-Carrying CB, Inverted Full-Back, Overlapping Full-Back, Wing-Back, Regista, Anchor, Ball-Winner, Mezzala, Box-to-Box, Deep Playmaker, Wide Playmaker, Wide Provider, Direct Winger, Traditional Winger, Trequartista, Advanced Playmaker, Second Striker, Inside Forward, Inverted Winger, Wide Forward, Target Man, Poacher, False 9, Pressing Forward, Carrier

---

## ARCHETYPE TAXONOMY (v2)

### How it works
- **Positional archetype** (0 or 1): earned through stats + personality. ~20% of players earn one.
- **Legacy tag** (0 or 1): earned through career/XP. Stacks on positional archetype.
- **Unclassified**: players who don't meet any threshold show "Aspiring [closest archetype]" or blank.

### Tier distribution target
| Tier | % of players | Meaning |
|------|-------------|---------|
| Elite archetype | ~3-5% | Clear statistical outlier + personality match |
| Established archetype | ~10-15% | Meets threshold, consistent |
| Aspiring | ~20% | Close to threshold (within 80% of stat target) |
| Unclassified | ~60% | No archetype, described by skillset only |

---

## FORWARDS (CF, WF, AM)

| Archetype | Stat Threshold | Personality Gate | Positions | Reference Players |
|-----------|---------------|-----------------|-----------|-------------------|
| **Hitman** | ≥20 goals/season OR ≥0.55 gp90 | Analytical+Competitive (AN_C) | CF | Kane (30g), Haaland, Lewandowski |
| **Predator** | ≥0.45 gp90, conversion rate top 10% | Instinctive (I__C) | CF | Inzaghi, Chicharito, Vardy |
| **Colossus** | ≥60% aerial win + ≥3 aerial/90 + ≥185cm | Leader (__LC) | CF | Giroud, Dzeko, Haller |
| **Magician** | ≥0.3 ap90 AND ≥3 drib/90 AND ≥55% drib success | Creative (IX_P, INSP) | WF, AM | Messi (prime), Neymar, Hazard |
| **Roadrunner** | Top 10% pace/accel + ≥3 drib/90 + ≥0.2 gp90 | Extrinsic (AX__, IX__) | WF, CF | Mbappé, Vini Jr, Adama |
| **Trickster** | ≥4 drib/90 + ≥55% success + flair personality | Instinctive/Extrinsic (IX__) | WF, AM | Dembélé, Neymar, Sancho |
| **Technician** | ≥0.3 ap90 OR ≥2.5 key passes/90 + ≥85% pass acc | Composer (___P) | AM, WF | De Bruyne, Özil, Bruno |
| **Fox** | ≥0.35 gp90 + high positioning/movement grades + <2 drib/90 | Analytical (AN__) | CF, AM | Müller, Vardy, Jota |
| **Workhorse** | Forward with ≥3 tkl+int/90 from attacking position | Competitive (___C) | CF, WF | Firmino, Diaz, Havertz |
| **All-Rounder** | ≥0.35 gp90 AND ≥0.15 ap90 AND ≥1.5 drib/90 | Any competitive | CF | Benzema, Suárez, Son |

## MIDFIELDERS (CM, DM, WM)

| Archetype | Stat Threshold | Personality Gate | Positions | Reference Players |
|-----------|---------------|-----------------|-----------|-------------------|
| **Maestro** | ≥10 assists/season OR ≥0.25 ap90 + ≥87% pass acc | Composer (___P) | CM, AM | KDB (89 xp), Iniesta, Özil |
| **Metronome** | ≥90% pass acc + ≥50 passes/90 | Analytical (AN_P, AN_C) | CM, DM | Kroos, Xavi, Rodri |
| **General** | ≥2 tkl/90 AND ≥2 prog carries/90 AND ≥0.1 gp90 | Leader (ANLC, ANSC) | CM, DM | Yaya, Vieira, Gerrard |
| **Terrier** | ≥4 tkl+int/90 | Competitive (AX_C, AN_C) | DM, CM | Kanté, Gattuso, Casemiro |
| **Conductor** | ≥88% pass acc + ≥5 prog passes/90 + deep position | Composer (INSP, ANLP) | DM, CM | Pirlo, Busquets, Alonso |
| **Dynamo** | ≥2500 mins + ≥3 tkl+int/90 + high rating | Competitive (ANSC, INSC) | CM, WM | Henderson, Valverde, Barella |
| **Spark Plug** | ≥0.1 gp90 AND ≥2 tkl/90 from CM | Any competitive | CM | Lampard, Bellingham |
| **Schemer** | ≥2.5 key passes/90 + ≥2 drib/90 from midfield | Creative (IX_P, IXSC) | WM, CM, AM | Bernardo, Musiala, Pedri |
| **Water Carrier** | ≥3 tkl+int/90 + ≥85% pass + personality: high coachability | Intrinsic+Composer (IN_P) | DM, CM | Deschamps, Makelele, Kimmich |

## DEFENDERS (CD, WD)

| Archetype | Stat Threshold | Personality Gate | Positions | Reference Players |
|-----------|---------------|-----------------|-----------|-------------------|
| **Rock** | ≥65% duel win + ≥3 clearances/90 + low dribbled past | Leader (INLC, ANLC) | CD | Van Dijk, Terry, Chiellini |
| **Rolls Royce** | CD with ≥90% pass acc + ≥4 prog passes/90 | Analytical (AN_P, ANLC) | CD | Stones, Thiago Silva, Bonucci |
| **Warrior** | ≥3 tkl/90 + ≥65% aerial + high aggression | Competitive (AXSC, ANSC) | CD | Ramos, Vidic, Skriniar |
| **Tower** | ≥70% aerial win + ≥190cm + ≥4 clearances/90 | Leader (INLC, ANLC) | CD | Konaté, Maguire (early), Hummels |
| **Marauder** | WD with ≥2 crosses/90 + ≥2 drib/90 + ≥0.1 ap90 | Extrinsic (AXSC, IXSC) | WD | Cafu, TAA, Hakimi |
| **Chameleon** | WD with ≥87% pass acc + inverted metrics | Analytical (ANSP, ANLP) | WD | Cancelo, Kimmich, Walker |
| **Reader** | ≥4 interceptions/90 OR top 5% positioning grade | Intrinsic (IN__) | CD | Baresi, Cannavaro, Marquinhos |

## GOALKEEPERS (GK)

| Archetype | Stat Threshold | Personality Gate | Positions | Reference Players |
|-----------|---------------|-----------------|-----------|-------------------|
| **Wall** | ≥75% save rate + outperforms PSxG | Competitive (INSC, ANSC) | GK | Courtois, De Gea (prime) |
| **Libero** | GK with top quartile pass accuracy + high claim area | Analytical (ANSP, ANLP) | GK | Neuer, Ederson |
| **Cat** | Top 10% in reflex saves / close-range stops | Instinctive (IX__, IN__) | GK | Raya, Alisson, Ochoa |
| **Organiser** | High claim rate + leadership personality + ≥33 age | Leader (ANLC, INLC) | GK | Buffon, Casillas, Cech |

## BEHAVIORAL (cross-position, can stack with positional)

| Archetype | Stat Threshold | Personality Gate | Notes |
|-----------|---------------|-----------------|-------|
| **Fiery** | ≥3 career red cards OR ≥0.08 reds/90 + ≥8 yellows/season | Low coachability (≤3) | Ramos, Pepe, Diego Costa |
| **Ironclad** | ≥2500 min/season for 3+ consecutive + rating ≥7.0 | High coachability (≥7) | Azpilicueta, Milner, Kimmich |
| **Clutch** | High goals/assists in 75+ min OR penalty ≥85% (5+ taken) | Competitive (___C) | Kane (100% pens), Jorginho |
| **Big Game** | Rating ≥7.5 in CL/international matches (need data) | Competitive | Ramos, Ronaldo, Drogba |
| **Talisman** | Team's top scorer AND top assister | Any leader | Messi at Barca, Salah at Liverpool |

## LEGACY (career-gated, stacks on positional archetype)

| Tag | Threshold | Reference |
|-----|-----------|-----------|
| **Icon** | XP ≥ 85 AND peak ≥ 92 AND career_years ≥ 15 | Messi (xp=90), Kane (xp=95) |
| **Legend** | XP ≥ 70 AND peak ≥ 90 | KDB (xp=89), Bernardo (xp=65) |
| **Wonderkid** | Age ≤ 21 AND level ≥ 85 | Yamal (18, lvl=92), João Neves (21, lvl=89) |
| **Veteran** | Age ≥ 33 AND level ≥ 83 | Ronaldo (41, lvl=88), Messi (38, lvl=88), Modric (40) |
| **Globetrotter** | ≥5 different leagues in career | Mathew Ryan (8 leagues), Angeliño (8) |
| **Lifer** | 1 club, ≥10 years, level ≥ 80 (standalone, does NOT stack) | Totti, Maldini, one-club loyalty |
| **Supersub** | ≥5 goals/assists from bench in a season (need sub data) | Solskjær, Chicharito |

---

## Decisions (confirmed 2026-03-19)

### Stacking
- Single combined badge displayed: "[Legacy] [Behavioral] [Positional]"
- Pick one from each layer, combine into one badge string
- Examples: "Icon Hitman", "Wonderkid Magician", "Fiery Warrior", "Clutch Veteran Maestro"
- **Lifer**: standalone, does NOT stack (it IS the identity)
- If no positional archetype: just legacy/behavioral if earned, else "Aspiring [closest]"

### Display Format
- **Earned**: "Icon Hitman" / "Wonderkid Magician" / "Fiery Warrior"
- **Aspiring**: "Aspiring Hitman" (within 80% of stat threshold) — try this, may revisit
- **Unclassified**: just show skillset "Striker-Sprinter"

### Decay
- Archetypes persist until reassessed (6-month window)
- Reassessment uses most recent season stats
- If stats no longer meet threshold → archetype removed, recalculated
- Legacy tags are permanent once earned (career stats don't un-happen)
- Pipeline runs reassessment, not real-time

### General
- **General is an archetype**, not a 14th skillset model
- The Yaya/Vieira/Gerrard type earns "General" through stats (tkl + carries + goals from midfield)
- Skillset stays as Engine or Engine-Destroyer (attribute grouping unchanged)

### Catalyst collision
- **Catalyst stays as personality type name** (AXLC)
- Midfield archetype renamed from Catalyst → **Spark Plug** (Lampard/Bellingham — ignites attacks from CM)

## Name Collision Check
✅ Verified: no archetype name overlaps with any skillset or role name.
✅ "Catalyst" conflict resolved: personality keeps name, archetype uses "Spark Plug".
