---
name: Overall rating transition
description: Overall replaces level as primary player rating once calibration is complete
type: project
---

Overall rating is the target primary rating, replacing level for display/sort/filter.

**Formula (pipeline 27):** coverage-scaled blend of technical compound score + level anchor (no peak).
- Rich data (40+ grades): 50% technical, 50% level
- Thin data (10 grades): 20% technical, 80% level
- No level: 100% technical

**Why:** Level is editorial-only and doesn't differentiate well. Overall blends data-driven compound scores with editorial level, giving a more accurate single number.

**How to apply:** Once top 50-100 players look correct (levels fixed, attribute coverage improved), swap level → overall as the primary display value across PlayerCard, player lists, free agents, squad builder, etc. Until then, keep fixing levels via the editor and improving attribute grade coverage.

**Current state (2026-03-17):** Formula working well, ~30 level corrections applied. Elite players with sparse data (Mbappé, Haaland) still slightly low due to compound scores. Editor now has Level/Peak prominently in Scouting Profile section for quick fixes.
