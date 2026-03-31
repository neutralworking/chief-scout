# Role Scoring Breakdown

How every tactical role score is calculated, what drives inflation, and where the formula needs tuning.

---

## The Formula

```
role_score = primary_model * 0.6 + secondary_model * 0.4
```

Each **model** is the average of 4 attributes (0-20 raw scale, converted to 0-100):

```
model_score = avg(attr1, attr2, attr3, attr4) * 5
```

Minimum 2 of 4 attributes required (added 2026-03-17 to prevent single-attribute inflation).

---

## The 13 Models

| Model | Attributes | Compound |
|-------|-----------|----------|
| **Controller** | anticipation, composure, decisions, tempo | Mental |
| **Commander** | communication, concentration, drive, leadership | Mental |
| **Creator** | creativity, unpredictability, vision, guile | Mental |
| **Target** | aerial_duels, heading, jumping, volleys | Physical |
| **Sprinter** | acceleration, balance, movement, pace | Physical |
| **Powerhouse** | aggression, duels, shielding, stamina | Physical |
| **Cover** | awareness, discipline, interceptions, positioning | Tactical |
| **Engine** | intensity, pressing, stamina, versatility | Tactical |
| **Destroyer** | blocking, clearances, marking, tackling | Tactical |
| **Dribbler** | carries, first_touch, skills, take_ons | Technical |
| **Passer** | pass_accuracy, crossing, pass_range, through_balls | Technical |
| **Striker** | close_range, mid_range, long_range, penalties | Technical |
| **GK** | agility, footwork, handling, reactions | Technical |

---

## Tactical Roles by Position

### GK
| Role | Primary | Secondary | Formula |
|------|---------|-----------|---------|
| Torwart | GK | Cover | GK×0.6 + Cover×0.4 |
| Sweeper Keeper | GK | Passer | GK×0.6 + Passer×0.4 |
| Ball-Playing GK | GK | Controller | GK×0.6 + Controller×0.4 |

### CD
| Role | Primary | Secondary | Formula |
|------|---------|-----------|---------|
| Libero | Cover | Passer | Cover×0.6 + Passer×0.4 |
| Stopper | Destroyer | Powerhouse | Destroyer×0.6 + Powerhouse×0.4 |
| Sweeper | Cover | Controller | Cover×0.6 + Controller×0.4 |
| Zagueiro | Destroyer | Commander | Destroyer×0.6 + Commander×0.4 |

### WD
| Role | Primary | Secondary | Formula |
|------|---------|-----------|---------|
| Lateral | Engine | Dribbler | Engine×0.6 + Dribbler×0.4 |
| Invertido | Controller | Passer | Controller×0.6 + Passer×0.4 |
| Fluidificante | Engine | Sprinter | Engine×0.6 + Sprinter×0.4 |

### DM
| Role | Primary | Secondary | Formula |
|------|---------|-----------|---------|
| Anchor | Cover | Destroyer | Cover×0.6 + Destroyer×0.4 |
| Regista | Controller | Passer | Controller×0.6 + Passer×0.4 |
| Volante | Destroyer | Engine | Destroyer×0.6 + Engine×0.4 |

### CM
| Role | Primary | Secondary | Formula |
|------|---------|-----------|---------|
| Metodista | Controller | Passer | Controller×0.6 + Passer×0.4 |
| Tuttocampista | Engine | Cover | Engine×0.6 + Cover×0.4 |
| Mezzala | Passer | Creator | Passer×0.6 + Creator×0.4 |
| Relayeur | Engine | Destroyer | Engine×0.6 + Destroyer×0.4 |

### WM
| Role | Primary | Secondary | Formula |
|------|---------|-----------|---------|
| Fantasista | Creator | Passer | Creator×0.6 + Passer×0.4 |
| Winger | Sprinter | Passer | Sprinter×0.6 + Passer×0.4 |
| Raumdeuter | Dribbler | Striker | Dribbler×0.6 + Striker×0.4 |
| Tornante | Engine | Sprinter | Engine×0.6 + Sprinter×0.4 |

### AM
| Role | Primary | Secondary | Formula |
|------|---------|-----------|---------|
| Trequartista | Creator | Dribbler | Creator×0.6 + Dribbler×0.4 |
| Enganche | Controller | Creator | Controller×0.6 + Creator×0.4 |
| Seconda Punta | Dribbler | Striker | Dribbler×0.6 + Striker×0.4 |

### WF
| Role | Primary | Secondary | Formula |
|------|---------|-----------|---------|
| Inverted Winger | Dribbler | Sprinter | Dribbler×0.6 + Sprinter×0.4 |
| Extremo | Sprinter | Striker | Sprinter×0.6 + Striker×0.4 |
| Inventor | Creator | Dribbler | Creator×0.6 + Dribbler×0.4 |

### CF
| Role | Primary | Secondary | Formula |
|------|---------|-----------|---------|
| Prima Punta | Target | Powerhouse | Target×0.6 + Powerhouse×0.4 |
| Complete Forward | Striker | Creator | Striker×0.6 + Creator×0.4 |
| Poacher | Striker | Sprinter | Striker×0.6 + Sprinter×0.4 |
| Falso Nove | Creator | Controller | Creator×0.6 + Controller×0.4 |
| Seconda Punta | Dribbler | Striker | Dribbler×0.6 + Striker×0.4 |

---

## Known Issues (2026-03-17)

### 1. Inverted Winger dominates WF
- **Dribbler** (avg 13.5/20) and **Sprinter** (avg 13.9/20) have the highest attribute coverage AND the highest average scores among WF players
- Result: Inverted Winger score ≈ 13.5×5×0.6 + 13.9×5×0.4 = 40.5 + 27.8 = **68.3** baseline
- Meanwhile **Inventor** needs Creator (avg 9.2/20), dragging it down: 9.2×5×0.6 + 13.5×5×0.4 = 27.6 + 27.0 = **54.6** baseline
- Fix needed: either differentiate the Dribbler/Sprinter models more, or add weighting to the role formula

### 2. eafc_inferred data pollutes rankings
- Retired players (Robinho, Etherington, Wright-Phillips) score highly because eafc_inferred gives uniformly high Sprinter/Dribbler scores
- These players have no real statistical data but eafc attributes are differentiated enough to pass the flat-data filter
- Fix: either filter by active status, or weight eafc_inferred scores down in the model calculation

### 3. Level not factored into role_score
- A level-95 Mbappé (RS=82) ranks below level-42 Matthew Etherington (RS=87)
- `overall` blends level (65%) with compound scores (35%), but `best_role_score` is pure attribute-derived
- This means role_score rewards attribute profile shape regardless of quality tier

### 4. Role distribution is heavily skewed
- 592 Inverted Wingers, 516 Prima Puntas, 1361 Mezzalas vs 2 Fantasistas, 5 Falso Noves, 2 Sweepers
- Roles with Creator/Controller primary struggle because those attributes (guile, tempo, unpredictability) are rarely populated
- Mental compound avg = 26.8 (vs Physical = 64.1) — mental attributes are dramatically under-represented in data

### 5. Position-role mismatches
- AM Seconda Punta uses Dribbler+Striker — same as WF's Inverted Winger. Ødegaard (AM) gets Seconda Punta at 86 but he's really a Trequartista/Enganche
- Creator model attributes (creativity, unpredictability, vision, guile) are rarely scored, making creative roles impossible to achieve

---

## Overall Rating Formula

```
overall = compound_weighted_avg * 0.35 + level * 0.65
```

Position-weighted compound averages:

| Position | Technical | Tactical | Physical | Mental |
|----------|-----------|----------|----------|--------|
| GK | 0.5 | 0.2 | 0.1 | 0.2 |
| CD | 0.1 | 0.4 | 0.3 | 0.2 |
| WD | 0.2 | 0.3 | 0.3 | 0.2 |
| DM | 0.2 | 0.4 | 0.2 | 0.2 |
| CM | 0.3 | 0.2 | 0.2 | 0.3 |
| WM | 0.3 | 0.2 | 0.3 | 0.2 |
| AM | 0.4 | 0.1 | 0.2 | 0.3 |
| WF | 0.3 | 0.1 | 0.3 | 0.3 |
| CF | 0.3 | 0.1 | 0.3 | 0.3 |

---

## Source Priority

| Source | Priority | Notes |
|--------|----------|-------|
| scout_assessment | 5 | Manual grades — highest trust |
| fbref | 4 | Statistical, good coverage |
| statsbomb | 3 | Event data, limited coverage |
| understat | 2 | xG/xA only |
| computed | 1 | Derived compound scores |
| eafc_inferred | 0 | EA FC game data — lowest trust, often inflated |
