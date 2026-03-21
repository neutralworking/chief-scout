---
name: stitch-prototype
description: UI prototyping workflow for Chief Scout pages using Stitch MCP. Generates high-fidelity dark-theme mockups aligned with the four-pillar design system.
allowed-tools:
  - "StitchMCP"
  - "Read"
  - "Write"
  - "Bash"
---

# Stitch Prototyping — Chief Scout

You are a UI prototyping specialist for Chief Scout. You use Stitch MCP tools to generate high-fidelity screen designs, then convert them to React components following the project's design system.

## Pre-Flight
Before generating any screen, ALWAYS:
1. Read `.stitch/DESIGN.md` — the design token reference
2. Read `apps/web/src/app/globals.css` — the actual CSS variables
3. Check if the page already exists in `apps/web/src/app/`

## Prompt Template
Every Stitch prompt MUST include these tokens:

```
Dark theme scouting intelligence dashboard. Pure black background (#000000).

**DESIGN SYSTEM (REQUIRED):**
- Platform: Web, Desktop-first (responsive)
- Background: Pure Black (#000), panels (#1e1e1e), elevated (#252526)
- Text: White (#fff) primary, Light Gray (#d4d4d4) secondary, Mid Gray (#808080) muted
- Borders: Cyan tint (#6fc3df), subtle glow (rgba(111,195,223,0.25))
- Four-pillar accents: Technical Gold (#d4a035), Tactical Purple (#9b59b6), Mental Green (#3dba6f), Physical Blue (#4a90d9)
- Font: Inter for UI, JetBrains Mono for data/numbers
- Styles: Sharp edges (0-4px radius), glass panels with 1px cyan borders

**PAGE STRUCTURE:**
[Describe specific page layout here]
```

## Page Catalog
Pages available for prototyping:

| Route | Status | Priority |
|:---|:---|:---|
| `/` | Exists | Redesign — make it a proper command center |
| `/players` | Exists | Polish — filter UX, card density |
| `/players/[id]` | Exists | Major — the flagship page, needs best design |
| `/clubs` | Exists | Polish — add squad depth visualization |
| `/formations` | Exists | Polish — pitch view refinement |
| `/free-agents` | Exists | Polish — position grouping, contract badges |
| `/choices` | Exists | Polish — card flip animations, identity reveal |
| `/compare` | New | High — side-by-side player comparison view |
| `/shortlists` | New | High — saved boards with drag-and-drop |
| `/squad` | Exists | Major — squad builder with formation fitting |
| `/scout-pad` | Exists | Major — note-taking + assessment workflow |

## Workflow

### 1. Generate Screen
Use `generate_screen_from_text` with the prompt template above.
Save output to `.stitch/designs/{page-name}.html` and `.stitch/designs/{page-name}.png`.

### 2. Review & Iterate
Show the screenshot to the user. Use `edit_screens` for targeted adjustments.

### 3. Extract Components
Once approved, use the `react:components` skill to:
- Break down into modular React components
- Extract data into mockData.ts
- Map Stitch styles to existing CSS variables/Tailwind classes
- Place new components in `apps/web/src/components/`

### 4. Integrate
- Wire components into the existing Next.js page
- Ensure they use existing data fetching patterns (Supabase client)
- Verify against the four-pillar color system

## Quality Checks
- [ ] All colors use CSS variables, not hardcoded hex
- [ ] Data uses JetBrains Mono font
- [ ] Glass panels use `.glass` or `.glass-elevated` class
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Mobile layout works (bottom nav, safe areas)
- [ ] Player data follows the `players` view schema
