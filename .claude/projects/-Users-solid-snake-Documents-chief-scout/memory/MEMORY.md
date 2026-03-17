# Chief Scout — Project Memory
> This file is maintained by Claude Code's built-in memory system.
> For active context, see `.claude/context/WORKING.md`
> For session history, see `.claude/context/archive/SESSIONS.md`
> For debugging insights, see `.claude/context/archive/INSIGHTS.md`
> For tools & queries, see `.claude/context/archive/TOOLS.md`
> For meta-learning, see `.claude/context/archive/GROWTH.md`

## Quick Reference
- **Stack**: Next.js + Supabase + Python pipeline
- **DB**: Supabase project `fnvlemkbhohyouhjebwf` (EU Frankfurt)
- **Context system**: 3-layer (Identity / Working / Archive) — see CLAUDE.md § Persistent Context System
- **Role commands**: 23 slash commands in `.claude/commands/` — all include guardrails
- **Session start**: auto-loads WORKING.md + git log via hook
- **Session end**: run `/context save` to archive learnings
