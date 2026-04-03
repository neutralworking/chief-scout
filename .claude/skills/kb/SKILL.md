---
name: kb
description: Knowledge Base compilation and maintenance — compile articles, rebuild indexes, run health checks, add manual articles
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Knowledge Base — Compilation & Maintenance

You manage the Chief Scout Knowledge Base (`kb/`), an LLM-compiled wiki of football scouting knowledge.

## Architecture

```
kb/
├── INDEX.md          # Master index (auto-generated)
├── players/          # Compiled from DB + docs/research/rsg.db + docs/Scouting/
├── archetypes/       # 13 SACROSANCT models with exemplars
├── tactics/          # From docs/formations/ + tactical knowledge
├── clubs/            # Clubs with 5+ players
├── concepts/         # Cross-cutting analytical concepts
└── queries/          # Filed Q&A outputs
```

## Pre-flight
1. Check current KB state: `python pipeline/96_kb_index.py --stats`
2. Read `kb/INDEX.md` if it exists

## Workflows

### Full Compilation
```bash
python pipeline/95_compile_kb.py --dry-run              # preview
python pipeline/95_compile_kb.py                         # compile all
python pipeline/95_compile_kb.py --with-llm              # with LLM synthesis
python pipeline/96_kb_index.py                           # rebuild indexes
```

### Incremental Update
```bash
python pipeline/95_compile_kb.py                         # only changed players
python pipeline/96_kb_index.py                           # refresh indexes
```

### Single Player
```bash
python pipeline/95_compile_kb.py --player "Bukayo Saka" --force
python pipeline/96_kb_index.py
```

### Category-Specific
```bash
python pipeline/95_compile_kb.py --category archetypes
python pipeline/95_compile_kb.py --category tactics
python pipeline/95_compile_kb.py --category clubs
```

### Manual Article
1. Create a `.md` file in the appropriate `kb/{category}/` directory
2. Include YAML frontmatter: title, category, tags, updated, source, summary
3. Use `[[slug]]` for cross-references to other articles
4. Run `python pipeline/96_kb_index.py` to update indexes

### Health Check
```bash
python pipeline/96_kb_index.py --stats
```

### Search
```bash
python pipeline/tools/kb_search.py "pressing midfielder"
python pipeline/tools/kb_search.py "controller" --category archetypes --json
```

## Article Format

Every article must have YAML frontmatter:
```yaml
---
title: Article Title
category: players|archetypes|tactics|clubs|concepts|queries
tags: [tag1, tag2]
updated: YYYY-MM-DD
source: compiled|manual|query
confidence: high|medium|low
summary: One-line summary for index listings
backlinks: [slug1, slug2]
---
```

Use `[[slug]]` wiki-style links for cross-references (e.g. `[[controller]]`, `[[bukayo-saka]]`).

## Quality Checks
- [ ] All articles have valid frontmatter
- [ ] No broken backlinks (`python pipeline/96_kb_index.py --stats`)
- [ ] INDEX.md reflects current state
- [ ] Player articles have grades and archetype data
- [ ] Archetype articles have exemplars
