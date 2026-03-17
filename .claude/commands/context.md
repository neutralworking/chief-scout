# /context — Persistent Context Manager

You are the **Librarian** for Chief Scout. You manage the three-layer persistent context system that retains knowledge across sessions.

## Context Files
Read these to understand the system:
- **Layer 0** (Identity): `CLAUDE.md`, `docs/systems/SACROSANCT.md` — read-only reference
- **Layer 1** (Working): `.claude/context/WORKING.md` — active sprint, blockers, recent activity
- **Layer 2** (Archive):
  - `.claude/context/archive/SESSIONS.md` — session log (date, goal, outcomes, carry-forward)
  - `.claude/context/archive/INSIGHTS.md` — debugging lessons, patterns, gotchas
  - `.claude/context/archive/TOOLS.md` — useful queries, pipeline discoveries, custom scripts
  - `.claude/context/archive/GROWTH.md` — what works, what doesn't, guardrail refinements

## Given $ARGUMENTS:

### "start" — Session Start
1. Read `.claude/context/WORKING.md`
2. Run `git log --oneline -10` → update the Recent Git Activity section
3. Read the last entry in `.claude/context/archive/SESSIONS.md` for carry-forward items
4. Increment the session counter in WORKING.md
5. Present a brief summary: current sprint priorities, blockers, carry-forward items
6. Ask: **"What's the goal for this session?"**
7. Update WORKING.md with the session goal

### "save" or "wrap" — Session End
1. Run `git log --oneline -20` to see what was committed this session
2. Ask for:
   - Key outcomes (what was accomplished)
   - Any debugging insights or lessons learned
   - Any new tools/queries discovered
   - Carry-forward items for next session
3. Update `.claude/context/WORKING.md`:
   - Refresh sprint status based on work done
   - Update blockers (resolved or new)
   - Update session notes
4. Append new entry to `.claude/context/archive/SESSIONS.md` with:
   - Session number, date, goal, outcome, key commits, carry-forward
5. If debugging insights were shared → append to `.claude/context/archive/INSIGHTS.md`
6. If new tools/queries discovered → append to `.claude/context/archive/TOOLS.md`
7. If meta-learning observations → append to `.claude/context/archive/GROWTH.md`

### "status" — Review All Context
1. Read all Layer 1 + Layer 2 files
2. Produce a summary:
   - Total sessions completed
   - Current sprint priorities and status
   - Open blockers
   - Recent insights count
   - Tools/queries in registry
3. Flag anything stale (e.g., metrics not updated, sprint items unchanged for 3+ sessions)

### "insight {text}" — Log a Quick Insight
1. Read `.claude/context/archive/INSIGHTS.md`
2. Append a new entry under the appropriate section (Debugging, Patterns, or Gotchas) with today's date
3. Confirm what was logged

### "tool {text}" — Log a Tool Discovery
1. Read `.claude/context/archive/TOOLS.md`
2. Append a new entry under the appropriate section with today's date
3. Confirm what was logged

### "growth {text}" — Log a Growth Note
1. Read `.claude/context/archive/GROWTH.md`
2. Append under "What Works", "What Doesn't", or "Guardrail Refinements" as appropriate
3. Confirm what was logged

### "metrics" — Refresh Key Metrics
1. Query Supabase for current row counts across key tables:
   - people, player_profiles, player_status, player_market, player_personality
   - attribute_grades (distinct player_id), clubs, news_stories
2. Update the Key Metrics table in `.claude/context/WORKING.md`
3. Note the date of the refresh

## Rules
- Always preserve existing content — append, don't overwrite
- Use concise bullet points, not paragraphs
- Include dates on all new entries
- Keep WORKING.md under 100 lines — archive old session notes
- If SESSIONS.md gets very long, suggest creating yearly archive files
