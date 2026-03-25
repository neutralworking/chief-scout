# Calibration Reference

Single source of truth for player score calibration across all pipelines and editorial tools.

## 1. Score Bands

| Band | Label | Meaning |
|------|-------|---------|
| 93-95 | Generational | BdO winner tier |
| 90-92 | World Class | BdO shortlist |
| 87-89 | Elite | Top 50 globally |
| 84-86 | International | Regular international, top-flight star |
| 80-83 | Established | Consistent top-flight starter |
| 75-79 | Professional | Solid professional, strong second tier |
| 70-74 | Capable | Good second-tier or top-flight squad player |
| 65-69 | Competitive | Lower-league starter or development prospect |
| <65 | Foundation | Early career or lower division |

## 2. League Strength Tiers

| Tier | Coeff | Description | Examples |
|------|-------|-------------|---------|
| 1A | 1.00 | CL regulars (top clubs) | Top 6 PL, Real Madrid, Barcelona, Bayern, PSG, Inter, Juventus, Atletico |
| 1B | 0.95 | Top-flight strong | Rest of Big 5 league top half |
| 1C | 0.90 | Top-flight lower half | Bottom half of Big 5 leagues |
| 2A | 0.85 | Strong second tier | Championship, Eredivisie top clubs, Liga Portugal top clubs |
| 2B | 0.80 | Second tier standard | Rest of Eredivisie, Liga Portugal, Turkish Super, Belgian Pro, Scottish Prem |
| 3A | 0.75 | Non-European top | MLS, Saudi Pro, Brasileirao, Argentine Liga, J-League, K-League |
| 3B | 0.70 | European second divisions | Serie B, 2. Bundesliga, Segunda, Swiss Super, Greek Super |
| 4 | 0.60 | Lower divisions | League One, League Two |

**Key rules:**
- CL clubs distinguished from rest of league (PSG ≠ Angers).
- Championship = Eredivisie level.
- Non-European top ALL stronger than European second divisions.
- Top 30 UEFA club coefficient = Tier 1A regardless of league position.

## 3. Reference Profiles (30 anchors)

### CF
| Player | Level | Target RS | Rationale |
|--------|-------|-----------|-----------|
| Mbappe | 92 | 91-95 | Generational pace + finishing |
| Kane | 92 | 90-93 | Complete striker |
| Haaland | 90 | 89-92 | Pure scorer |
| Alvarez | 89 | 86-89 | Versatile |
| Lautaro | 88 | 85-88 | Elite Serie A |
| Osimhen | 88 | 85-88 | Elite physical |

### WF
| Player | Level | Target RS | Rationale |
|--------|-------|-----------|-----------|
| Yamal | 92 | 90-93 | Generational talent |
| Saka | 90 | 88-91 | Complete winger |
| Vinicius | 89 | 87-90 | Explosive, not BdO this season |
| Raphinha | 89 | 86-89 | Excellent form |

### AM
| Player | Level | Target RS | Rationale |
|--------|-------|-----------|-----------|
| Odegaard | 89 | 87-89 | Creative leader |
| Palmer | 89 | 87-90 | Breakout star |
| Wirtz | 88 | 86-89 | Young elite |

### CM
| Player | Level | Target RS | Rationale |
|--------|-------|-----------|-----------|
| Bellingham | 90 | 89-92 | Box-to-box generational |
| Pedri | 91 | 89-91 | Metronomic |
| Rice | 90 | 88-90 | Complete |
| Barella | 88 | 85-88 | Tireless engine |

### DM
| Player | Level | Target RS | Rationale |
|--------|-------|-----------|-----------|
| Rodri | 88 | 87-90 | BdO winner 2024 |
| Kimmich | 89 | 86-89 | Versatile |

### CD
| Player | Level | Target RS | Rationale |
|--------|-------|-----------|-----------|
| Saliba | 89 | 87-89 | PL best CB |
| Van Dijk | 89 | 86-89 | Still elite, declining |
| Gabriel | 90 | 87-90 | Commanding |
| Dias | 88 | 85-88 | Leader |

### WD
| Player | Level | Target RS | Rationale |
|--------|-------|-----------|-----------|
| Hakimi | 90 | 87-90 | Attacking WB |
| James | 89 | 86-89 | Complete when fit |

### GK
| Player | Level | Target RS | Rationale |
|--------|-------|-----------|-----------|
| Alisson | 87 | 80-85 | Elite but below outfield scale |
| Courtois | 90 | 83-87 | World class GK |
| Raya | 89 | 82-86 | Excellent |

## 4. Level Trust Rules

- **Level 87+**: trusted as editorial calibration anchor.
- **Level 80-86**: approximate, treat as guide not ground truth.
- **Level <80**: unreliable, data should drive scoring.
- Level is being phased out — **role score is the primary metric**.

## 5. Calibration Process

1. Run `pipeline/27_player_ratings.py --dry-run`.
2. Check anchor validation output (±3 tolerance).
3. If anchors fail: investigate grade sources, league coefficients, floor logic.
4. Re-run after fixes until anchors pass.
5. Add new anchor players as needed (minimum 3 per position).

## 6. Data Source Trust

| Priority | Source | Notes |
|----------|--------|-------|
| 5 | Scout assessment | Human-graded, context-aware, most trusted |
| 4 | StatsBomb | Event-level, limited competitions (Euro/WC/Copa) |
| 3 | API-Football | Broad coverage, league-strength pre-scaled |
| 2 | Understat/Kaggle | xG/xA focused, no position grouping |
| 1 | Computed | Derived from other grades |
| 0 | EAFC | **EXCLUDED from scoring** — video game numbers, kept for display only |
| 0 | FBRef | Demoted — CSV import only has goals/assists |
