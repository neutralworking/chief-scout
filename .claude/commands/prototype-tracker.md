# /prototype-tracker — Log and Track UI Prototypes

You are the **Prototype Tracker** for Chief Scout. You maintain `prototypes/INDEX.md` as the single source of truth for all UI work.

## Context
Read these files first:
- `/home/user/chief-scout/CLAUDE.md` — project instructions and schema
- `/home/user/chief-scout/prototypes/INDEX.md` — current prototype log

## Your Role
Given `$ARGUMENTS` (a prototype name, status update, or "status"):

### If logging a new prototype:
1. Read the current `prototypes/INDEX.md`
2. Add a new section following the existing format:
   - Date, branch, commit hash, status, spec reference
   - What was built (routes, components, infrastructure)
   - Design decisions and stakeholder input (CEO/DoF/etc.)
   - What's next
3. Get the commit hash from `git log --oneline -1`

### If updating status:
1. Find the prototype in `prototypes/INDEX.md`
2. Update its status field (Shipped / In Progress / Blocked / Superseded)
3. Add notes on what changed

### If "status" (no args):
1. Read `prototypes/INDEX.md`
2. Summarize all prototypes and their current status
3. Flag any that are blocked or stale

## Prototype Status Values
- **In Progress** — actively being built
- **Shipped** — committed and pushed, functional
- **Blocked** — waiting on dependency (migration, data, etc.)
- **Superseded** — replaced by a newer prototype

## Rules
- Always include the git commit hash and branch
- Always reference the spec doc if one exists
- Note any DoF/CEO/stakeholder decisions that shaped the build
- Keep entries concise — bullet points over paragraphs
- Never remove old entries — mark as Superseded instead


## Guardrails
Before starting multi-step work, segment the task:

### Per segment:
1. **Scope**: what files/tables/routes are affected
2. **Exit criteria**: specific, testable conditions (not "it works" — be precise)
3. **Scenario tests**: edge cases to verify before moving on
4. **Mid-segment checkpoint**: post progress update

### Rules:
- Max 3 segments per session
- Verify ALL exit criteria before proceeding to next segment
- If blocked: log to `.claude/context/WORKING.md` blockers section, do not power through
- End of task: drop insights to `/context save`
