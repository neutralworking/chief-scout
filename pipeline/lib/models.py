"""
SACROSANCT Model Constants — Single Source of Truth (Python)

13 playing models, each averaging 4 core attributes.
Mirrors apps/web/src/lib/models.ts — keep in sync.
"""

# 13 SACROSANCT playing models, each with 4 core attributes
MODEL_ATTRIBUTES = {
    "Controller":  ["anticipation", "composure", "decisions", "tempo"],
    "Commander":   ["communication", "concentration", "drive", "leadership"],
    "Creator":     ["creativity", "unpredictability", "vision", "guile"],
    "Target":      ["aerial_duels", "heading", "jumping", "volleys"],
    "Sprinter":    ["acceleration", "balance", "movement", "pace"],
    "Powerhouse":  ["aggression", "duels", "shielding", "stamina"],
    "Cover":       ["awareness", "discipline", "interceptions", "positioning"],
    "Engine":      ["intensity", "pressing", "stamina", "versatility"],
    "Destroyer":   ["blocking", "clearances", "marking", "tackling"],
    "Dribbler":    ["carries", "first_touch", "skills", "take_ons"],
    "Passer":      ["pass_accuracy", "crossing", "pass_range", "through_balls"],
    "Striker":     ["close_range", "mid_range", "long_range", "penalties"],
    "GK":          ["agility", "footwork", "handling", "reactions"],
}

# Short display codes for each model
MODEL_SHORT = {
    "Controller": "CTR", "Commander": "CMD", "Creator": "CRE", "Target": "TGT",
    "Sprinter": "SPR", "Powerhouse": "PWR", "Cover": "COV", "Engine": "ENG",
    "Destroyer": "DES", "Dribbler": "DRB", "Passer": "PAS", "Striker": "STR", "GK": "GK",
}

# Source priority for fallback scoring (higher = preferred)
SOURCE_PRIORITY = {
    "scout_assessment": 5,
    "statsbomb": 4,
    "fbref": 3,
    "api_football": 3,
    "understat": 2,
    "computed": 1,
    "eafc_inferred": 0,
}

# ── Model Labels ─────────────────────────────────────────────────────────────
# Human-readable label for each compound model (Primary-Secondary).
# These name the *skill set combination* independent of position.
# The label describes WHAT the player is; the blueprint (position-specific)
# describes HOW they play in a formation.
#
# Original labels from Real Players Active.csv (the canonical source).
# Additional pairs filled in to cover all cross-category combinations.
# Single models keep their own name as the label.

MODEL_LABELS: dict[str, str] = {
    # ── Single models (identity labels) ──
    "Controller":  "Controller",
    "Commander":   "Commander",
    "Creator":     "Creator",
    "Target":      "Target",
    "Sprinter":    "Sprinter",
    "Powerhouse":  "Powerhouse",
    "Cover":       "Cover",
    "Engine":      "Engine",
    "Destroyer":   "Destroyer",
    "Dribbler":    "Dribbler",
    "Passer":      "Passer",
    "Striker":     "Striker",
    "GK":          "Goalkeeper",

    # ── From original CSV (canonical labels) ──────────────────────────────────

    # Mental × Technical
    "Controller-Creator":    "Playmaker",          # orchestrates through invention
    "Controller-Engine":     "Conductor",          # dictates tempo + never stops
    "Controller-Passer":     "Regista",            # total passing control from deep
    "Creator-Dribbler":      "Magician",           # invents + executes with the ball
    "Creator-Engine":        "Catalyst",           # creates + presses relentlessly
    "Creator-Passer":        "Maestro",            # sees passes nobody else sees
    "Creator-Striker":       "Fantasista",         # creates + scores from nothing

    # Mental × Tactical
    "Commander-Engine":      "General",            # leads + drives the team forward

    # Tactical × Mental
    "Cover-Commander":       "Anchor",             # organises + protects
    "Cover-Controller":      "Anchor",             # reads the game + shields space
    "Cover-Engine":          "Anchor",             # covers ground + reads danger

    # Tactical × Technical
    "Cover-Passer":          "Provider",           # reads play + distributes
    "Engine-Controller":     "Box-To-Box",         # end-to-end with intelligence
    "Engine-Commander":      "Driver",             # energy + vocal leadership
    "Engine-Cover":          "Dynamo",             # tireless covering
    "Engine-Creator":        "Heartbeat",          # pulse of the team, creates through work
    "Engine-Dribbler":       "Tornate",            # runs all day + carries the ball
    "Engine-Passer":         "Metronome",          # tireless + precise distribution
    "Engine-Striker":        "Livewire",           # energy + goal threat

    # Tactical × Physical
    "Cover-Powerhouse":      "Stalwart",           # immovable + reads the game
    "Cover-Destroyer":       "Cornerback",         # covers + tackles aggressively
    "Engine-Powerhouse":     "Bison",              # unstoppable physical endurance
    "Engine-Sprinter":       "Shuttler",           # pace + relentless energy
    "Engine-Destroyer":      "Destroyer",          # relentless pressing + tackling

    # Physical × Mental
    "Target-Powerhouse":     "Colossus",           # aerial + physical dominance
    "Target-Engine":         "Boxcrasher",         # aerial threat + tireless running
    "Powerhouse-Sprinter":   "Athlete",            # physical specimen

    # Physical × Tactical
    "Target-Destroyer":      "Titan",              # aerial + ground destruction
    "Target-Striker":        "Target",             # aerial + shooting
    "Sprinter-Cover":        "Flanker",            # pace + defensive reading
    "Sprinter-Engine":       "Shuttler",           # pace + relentless energy
    "Sprinter-Powerhouse":   "Juggernaut",         # pace + power combined
    "Sprinter-Striker":      "Ghost",              # pace + movement into space
    "Sprinter-Dribbler":     "Flash",              # pace + close control at speed

    # Technical × Mental
    "Dribbler-Creator":      "Wizard",             # skill-first but inventive
    "Dribbler-Striker":      "Spark",              # skill + goal threat
    "Dribbler-Sprinter":     "Winger",             # classic wide dribbler with pace
    "Passer-Creator":        "Radar",              # distribution + vision
    "Passer-Cover":          "Provider",           # distribution + defensive reading

    # Technical × Physical
    "Striker-Creator":       "Assassin",           # clinical + creative finishing
    "Striker-Engine":        "Poacher",            # movement + finishing
    "Striker-Powerhouse":    "Rifle",              # power + shooting
    "Striker-Sprinter":      "Rocket",             # pace + finishing
    "Striker-Target":        "Hitman",             # aerial + shooting

    # Tactical (Destroyer primary)
    "Destroyer-Commander":   "Leader",             # aggressive + vocal
    "Destroyer-Controller":  "Lynchpin",           # tackles + orchestrates
    "Destroyer-Cover":       "Shield",             # aggressive + positional
    "Destroyer-Engine":      "Train",              # relentless tackling machine
    "Destroyer-Passer":      "Libero",             # wins it + distributes
    "Destroyer-Powerhouse":  "Rock",               # physical + aggressive defence
    "Destroyer-Sprinter":    "Shadow",             # pace + aggressive recovery
    "Destroyer-Target":      "Centre Back",        # tackles + aerial dominance
    "Powerhouse-Destroyer":  "Enforcer",           # physical domination + tackling
    "Powerhouse-Striker":    "Spearhead",          # power + goal threat

    # ── Additional pairs (not in original CSV) ────────────────────────────────

    # Mental × Physical (gaps)
    "Controller-Sprinter":   "Tempo Runner",       # reads the game + pace to exploit
    "Controller-Target":     "Aerial Conductor",   # orchestrates + aerial presence
    "Controller-Powerhouse": "Iron Conductor",     # controls tempo with authority
    "Commander-Sprinter":    "Pace Leader",         # vocal leader + explosive speed
    "Commander-Target":      "Colossus",           # leads by example + aerial
    "Commander-Powerhouse":  "Enforcer",           # commands + overpowers
    "Creator-Sprinter":      "Spark",              # creative genius + electric pace
    "Creator-Target":        "Aerial Artist",      # creative flair + aerial threat
    "Creator-Powerhouse":    "Bulldozer",          # creates through physical force

    # Mental × Tactical (gaps)
    "Controller-Cover":      "Sentinel",           # reads the game + shields space
    "Controller-Destroyer":  "Conductor",          # orchestrates + wins it back
    "Commander-Cover":       "Guardian",           # organises + protects
    "Commander-Destroyer":   "Warrior",            # commands + tackles
    "Creator-Cover":         "Shadow",             # creates from deep, reads danger
    "Creator-Destroyer":     "Disruptor",          # unpredictable + aggressive

    # Mental × Technical (gaps)
    "Controller-Dribbler":   "Architect",          # builds play + carries ball
    "Controller-Striker":    "Clinical",           # calm decisions + lethal finishing
    "Commander-Dribbler":    "Talisman",           # leads + carries the ball
    "Commander-Passer":      "General",            # organises through distribution
    "Commander-Striker":     "Figurehead",         # leads the line + finishes

    # Physical × Mental (gaps)
    "Sprinter-Controller":   "Tempo Runner",
    "Sprinter-Commander":    "Pace Leader",
    "Sprinter-Creator":      "Spark",
    "Target-Controller":     "Aerial Conductor",
    "Target-Commander":      "Colossus",
    "Target-Creator":        "Aerial Artist",
    "Powerhouse-Controller": "Iron Conductor",
    "Powerhouse-Commander":  "Enforcer",
    "Powerhouse-Creator":    "Bulldozer",

    # Physical × Technical (gaps)
    "Target-Dribbler":       "Acrobat",            # aerial + ball skills
    "Target-Passer":         "Quarterback",        # aerial presence + distribution
    "Powerhouse-Dribbler":   "Ox",                 # powerful + skillful
    "Powerhouse-Passer":     "Quarterback",        # physical authority + distribution

    # Tactical × Physical (gaps)
    "Cover-Sprinter":        "Flanker",
    "Cover-Target":          "Fortress",           # aerial + positional reading
    "Destroyer-Dribbler":    "Ball Winner",        # wins it + drives forward
    "Destroyer-Striker":     "Predator",           # aggressive + clinical
    "Engine-Target":         "Battering Ram",      # tireless + aerial

    # Technical × Mental (gaps)
    "Dribbler-Controller":   "Technician",         # skill-first but smart
    "Dribbler-Commander":    "Talisman",
    "Passer-Controller":     "Regista",
    "Passer-Commander":      "General",
    "Striker-Controller":    "Clinical",
    "Striker-Commander":     "Figurehead",

    # Technical × Tactical (gaps)
    "Dribbler-Cover":        "Libero",
    "Dribbler-Engine":       "Tornate",
    "Dribbler-Destroyer":    "Ball Winner",
    "Passer-Engine":         "Metronome",
    "Passer-Destroyer":      "Recycler",           # wins it + circulates
    "Passer-Sprinter":       "Flanker",
    "Passer-Target":         "Quarterback",
    "Passer-Powerhouse":     "Quarterback",
    "Striker-Cover":         "Poacher",
    "Striker-Destroyer":     "Predator",

    # Technical × Physical (gaps)
    "Dribbler-Target":       "Acrobat",
    "Dribbler-Powerhouse":   "Ox",
    "Striker-Target":        "Hitman",

    # ── GK compounds ──
    "GK-Controller":         "Modern Keeper",
    "GK-Commander":          "Commander",
    "GK-Cover":              "Traditional Keeper",
    "GK-Passer":             "Sweeper Keeper",
    "GK-Sprinter":           "Sweeper Keeper",
}


def get_model_label(archetype: str | None) -> str | None:
    """Return the human-readable label for a model (single or compound)."""
    if not archetype:
        return None
    return MODEL_LABELS.get(archetype, archetype)


# Attribute aliases for DB inconsistencies
ATTR_ALIASES = {
    "takeons": "take_ons",
    "Leadership": "leadership",
    "unpredicability": "unpredictability",
}
