# Multi-Window Claude Code Workflow

> How to run 3-4 Claude Code sessions in parallel without conflicts.

## Golden Rule

**One window = one zone. No two windows touch the same files.**

## Zone Assignments

| Window | Zone | Directories | Typical tasks |
|--------|------|-------------|---------------|
| **A — Frontend** | UI & pages | `apps/web/src/app/`, `apps/web/src/components/` | Pages, components, styling |
| **B — Backend** | API & lib | `apps/web/src/lib/`, `apps/web/src/app/api/` | API routes, Supabase queries, utils |
| **C — Pipeline** | Data scripts | `pipeline/`, `data/`, `migrations/` | Ingestion, grading, enrichment |
| **D — Docs/Config** | Everything else | `docs/`, `.claude/`, `package.json`, config files | Context, commands, schema design, research |

### Flexible assignments

If you only need 2-3 windows, merge zones:
- **2 windows**: Frontend+Backend (A+B) and Pipeline+Docs (C+D)
- **3 windows**: Frontend (A), Backend+Pipeline (B+C), Docs/Research (D)

## Branch Strategy

### Option 1: Shared branch (simpler, works for most sessions)

All windows push to the same feature branch. Safe when zones don't overlap.

```bash
# Every window, before starting work:
git pull origin <branch> --rebase

# Every window, before pushing:
git pull origin <branch> --rebase
git push -u origin <branch>
```

### Option 2: Branch-per-window (safest for big changes)

Each window gets its own branch. One "integrator" window merges them.

```
Window A: claude/frontend-feature-xxx
Window B: claude/api-work-yyy
Window C: claude/pipeline-fix-zzz
```

Merge into the main feature branch when each is done.

## Commit Discipline

1. **Commit early, commit often** — small commits are easy to merge
2. **Prefix commits** with the zone: `[frontend]`, `[api]`, `[pipeline]`, `[docs]`
3. **Never force push** — if push is rejected, pull --rebase first
4. **Never amend** a commit that another window may have pulled

## Conflict Prevention Checklist

- [ ] Each window knows its zone before starting
- [ ] Shared files (`package.json`, `WORKING.md`) are edited by one window at a time
- [ ] Pull before push, always
- [ ] If two windows must touch the same file, coordinate: one finishes and pushes first

## Shared File Protocol

Some files are touched by multiple zones (e.g., `package.json`, `WORKING.md`, `CLAUDE.md`).

**Rule**: Only **Window D (Docs/Config)** edits shared files. Other windows flag the need:
- "Need X added to package.json" → Window D handles it
- Context updates → Window D updates WORKING.md at session end

If no Window D is active, whichever window finishes last handles shared files.

## Quick Reference for Session Start

Paste into each Claude Code window at the start:

```
You are Window [A/B/C/D].
Zone: [Frontend / Backend / Pipeline / Docs]
Branch: claude/xxx
Only edit files in: [directory list]
Pull before push. Commit often with [zone] prefix.
```
