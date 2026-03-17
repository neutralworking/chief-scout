# Growth Notes

## What Works
- **Role-based slash commands**: Giving Claude a specific persona (scout, pipeline engineer, etc.) produces more focused, domain-appropriate work. The `/board-meeting` command is especially effective for cross-functional status checks.
- **Dry-run first**: Pipeline scripts with `--dry-run` prevent data corruption. Always preview before committing to DB writes.
- **Migration-driven schema changes**: Numbered SQL files in `pipeline/sql/` keep schema evolution traceable. Never modify tables directly.
- **Single source of truth**: SACROSANCT.md for classification, CLAUDE.md for project context — prevents drift and inconsistency.
- **Session-scoped goals**: Sessions with 1 clear goal succeed more often than sessions attempting 3+ unrelated tasks.

## What Doesn't
- **Relying on single data sources**: FBRef scraper died with no fallback. Now using multi-source strategy (CSV, Kaggle, APIs).
- **Manual personality assessment at scale**: 50 players is manageable, 4,600 is not. Pipeline automation (rules → LLM → human QA) is the right approach.
- **Stale documentation**: MEMORY.md went stale because it wasn't part of the workflow. New context system addresses this with structured updates.

## Guardrail Refinements
- 2026-03-17: Introduced persistent context system with 3-layer architecture. Guardrails now baked into all role commands with segment-based exit criteria.
