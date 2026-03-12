# Chief Scout - Project Memory

## Overview
Football/soccer management game project with real scouting data pipeline. Two main components:

### 1. Research & Data (`docs/`, `inbox/`, `scripts/`)
- **docs/research/rsg.db/** — Club profiles (markdown) for dozens of clubs across leagues
- **docs/formation/** — ~35 formation tactical docs (4-3-3, 3-5-2, etc.)
- **docs/transfers/** — Transfer market research, valuations, free agents
- **docs/Dashboard.md** — Detailed scouting platform spec (reports, shortlists, depth charts, player profiles)
- **inbox/** — Game design docs (GDD), player attributes CSV, tactical styles JSON, playing styles
- **inbox/GameDesignDocument.md** — Sports Management RPG, Director of Football role, English League Two start
- **scripts/** — Python data pipeline: parse RSG data → Supabase (parse_rsg.py, push_to_supabase.py, schema_additions.sql, enrich/refine scripts)

### 2. Scout Pad (`scout-pad/`)
- **Next.js app** (TypeScript, Tailwind) — mobile-first card-based player review UI
- **Supabase backend** — `players` table with attributes, scouting fields, valuations
- **Flow**: Load player queue → swipe through cards → tag pursuit status / valuation / notes → save to Supabase
- **Two tabs per card**: "My Call" (pursuit, valuation, fit note, notes) and "Data" (position, level/peak, style, class, model, archetype, traits)
- **API**: `app/api/players/route.ts` — GET (paginated, excludes Pass, nulls first) + PATCH (whitelisted fields)
- **Key enums**: Pursuit (Pass/Watch/Interested/Priority), Archetypes (Superstar, Serial Winner, etc.), Models (100+ player models), Classes, Traits

### 3. Transfer Availability (`transfer_availability/` - git submodule)
- Python CLI tool for simulating transfer availability
- Has its own CLAUDE.md
- Data: archetypes, availability trees, playing tags, club position templates

## Tech Stack
- **Frontend**: Next.js, React, TypeScript, CSS (globals.css)
- **Backend**: Supabase (PostgreSQL)
- **Scripts**: Python
- **Game engine references**: GDScript (PlayerModels.gd in inbox — likely Godot)

## Database
- Supabase `players` table with columns: id, name, club, division, nation, position, secondary_position, level, peak, Character, Mentality, Foot, Physique, model, primary, secondary, archetype, archetype_override, market_value_tier, scarcity_score, national_scarcity, market_premium, scouting_notes, pursuit_status, director_valuation_meur, fit_note
