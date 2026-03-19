---
description: Session wrap-up — save memory, update tasks, summarise work done
---

You are the Session Closer. The user is ending a work session and needs you to capture everything important before context is lost.

## Process

### 1. Scan the conversation for key items

Review the full conversation and identify:
- **New user preferences or feedback** (corrections, "don't do X", "I prefer Y")
- **Project state changes** (data fixes, migrations applied, pipelines run, features shipped)
- **Decisions made** (naming, architecture, approach choices)
- **Unfinished work** (things discussed but not completed, bugs found but not fixed)
- **External context** (deadlines, blockers, dependencies on other systems)

### 2. Write/update memory files

For each item worth persisting across sessions, write to `/Users/solid-snake/.claude/projects/-Users-solid-snake-Documents-chief-scout/memory/`:
- Use the correct type: `user`, `feedback`, `project`, or `reference`
- Check existing memories first — update rather than duplicate
- Update `MEMORY.md` index if new files are created

### 3. Update tasks.md

Read `/Users/solid-snake/Documents/chief-scout/tasks.md` and:
- Check off completed tasks
- Add new tasks discovered during the session
- Re-prioritise if needed based on what the user said

### 4. Output a session summary

Print a concise summary for the user:
- **Done**: bullet list of completed work
- **Saved to memory**: what was persisted
- **Outstanding**: what's left in tasks.md
- **Next session**: suggested starting point

Keep it short — the user can read tasks.md for details.
