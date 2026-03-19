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
# Single models keep their own name as the label.
# Cross-category pairs get an evocative label.

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

    # ── Mental + Physical ──
    "Controller-Sprinter":  "Tempo Runner",      # reads the game + has pace to exploit it
    "Controller-Target":    "Aerial General",     # orchestrates + dominates aerially
    "Controller-Powerhouse": "Iron Conductor",    # controls tempo with physical authority
    "Commander-Sprinter":   "Pace Leader",        # vocal leader with explosive speed
    "Commander-Target":     "Colossus",           # leads by example, dominates aerially
    "Commander-Powerhouse": "Enforcer",           # commands + overpowers
    "Creator-Sprinter":     "Magician",           # creative genius with electric pace
    "Creator-Target":       "Aerial Artist",      # creative flair + aerial threat
    "Creator-Powerhouse":   "Bulldozer",          # creates through sheer physical force

    # ── Mental + Tactical ──
    "Controller-Cover":     "Sentinel",           # reads the game + shields space
    "Controller-Engine":    "Metronome",          # dictates tempo + never stops
    "Controller-Destroyer": "Conductor",          # orchestrates + wins it back
    "Commander-Cover":      "Guardian",           # organises + protects
    "Commander-Engine":     "Captain",            # leads + drives the team forward
    "Commander-Destroyer":  "Warrior",            # commands + destroys
    "Creator-Cover":        "Shadow",             # creates from deep, reads danger
    "Creator-Engine":       "Dynamo",             # creates + presses relentlessly
    "Creator-Destroyer":    "Disruptor",          # unpredictable + aggressive

    # ── Mental + Technical ──
    "Controller-Dribbler":  "Architect",          # builds play + carries ball
    "Controller-Passer":    "Maestro",            # total passing control
    "Controller-Striker":   "Clinical",           # calm decisions + lethal finishing
    "Commander-Dribbler":   "Talisman",           # leads + carries the ball
    "Commander-Passer":     "General",            # organises through distribution
    "Commander-Striker":    "Figurehead",          # leads the line + finishes
    "Creator-Dribbler":    "Magician",            # invents + executes with the ball
    "Creator-Passer":       "Visionary",          # sees passes nobody else sees
    "Creator-Striker":      "Fantasista",         # creates + scores from nothing

    # ── Physical + Tactical ──
    "Sprinter-Cover":       "Sweeper",            # pace to cover + reads danger
    "Sprinter-Engine":      "Roadrunner",         # pace + relentless energy
    "Sprinter-Destroyer":   "Blitz",              # explosive speed + aggressive tackling
    "Target-Cover":         "Fortress",           # aerial dominance + defensive reading
    "Target-Engine":        "Battering Ram",      # aerial threat + tireless running
    "Target-Destroyer":     "Wrecking Ball",      # aerial + ground destruction
    "Powerhouse-Cover":     "Rock",               # physical strength + positional sense
    "Powerhouse-Engine":    "Machine",            # unstoppable physical endurance
    "Powerhouse-Destroyer": "Terminator",         # physical domination + defensive aggression

    # ── Physical + Technical ──
    "Sprinter-Dribbler":    "Jet",                # pace + close control at speed
    "Sprinter-Passer":      "Flanker",            # pace + delivery
    "Sprinter-Striker":     "Quicksilver",        # pace + finishing
    "Target-Dribbler":      "Acrobat",            # aerial + ball skills (rare)
    "Target-Passer":        "Quarterback",        # aerial presence + distribution
    "Target-Striker":       "Marksman",           # aerial + shooting
    "Powerhouse-Dribbler":  "Ox",                 # powerful + skillful
    "Powerhouse-Passer":    "Quarterback",        # physical authority + distribution
    "Powerhouse-Striker":   "Cannon",             # power + shooting

    # ── Tactical + Technical ──
    "Cover-Dribbler":       "Libero",             # reads play + carries out from defence
    "Cover-Passer":         "Quarterback",        # reads play + distributes
    "Cover-Striker":        "Poacher",            # positional sense + finishing
    "Engine-Dribbler":      "Workhorse",          # runs all day + carries the ball
    "Engine-Passer":        "Shuttle",            # links play through tireless running
    "Engine-Striker":       "Pressing Machine",   # presses + scores
    "Destroyer-Dribbler":   "Ball Winner",        # wins it + drives forward
    "Destroyer-Passer":     "Recycler",           # wins it + circulates
    "Destroyer-Striker":    "Predator",           # aggressive + clinical

    # ── Reverse pairs (secondary emphasis differs) ──
    # Physical + Mental
    "Sprinter-Controller":  "Tempo Runner",
    "Sprinter-Commander":   "Pace Leader",
    "Sprinter-Creator":     "Spark",              # pace-first but creative
    "Target-Controller":    "Aerial General",
    "Target-Commander":     "Colossus",
    "Target-Creator":       "Aerial Artist",
    "Powerhouse-Controller": "Iron Conductor",
    "Powerhouse-Commander": "Enforcer",
    "Powerhouse-Creator":   "Bulldozer",

    # Tactical + Mental
    "Cover-Controller":     "Sentinel",
    "Cover-Commander":      "Guardian",
    "Cover-Creator":        "Shadow",
    "Engine-Controller":    "Metronome",
    "Engine-Commander":     "Captain",
    "Engine-Creator":       "Dynamo",
    "Destroyer-Controller": "Conductor",
    "Destroyer-Commander":  "Warrior",
    "Destroyer-Creator":    "Disruptor",

    # Technical + Mental
    "Dribbler-Controller":  "Technician",         # skill-first but smart
    "Dribbler-Commander":   "Talisman",
    "Dribbler-Creator":     "Virtuoso",           # skill-first but inventive
    "Passer-Controller":    "Maestro",
    "Passer-Commander":     "General",
    "Passer-Creator":       "Visionary",
    "Striker-Controller":   "Clinical",
    "Striker-Commander":    "Figurehead",
    "Striker-Creator":      "Fantasista",

    # Technical + Tactical
    "Dribbler-Cover":       "Libero",
    "Dribbler-Engine":      "Workhorse",
    "Dribbler-Destroyer":   "Ball Winner",
    "Passer-Cover":         "Quarterback",
    "Passer-Engine":        "Shuttle",
    "Passer-Destroyer":     "Recycler",
    "Striker-Cover":        "Poacher",
    "Striker-Engine":       "Pressing Machine",
    "Striker-Destroyer":    "Predator",

    # Physical + Technical
    "Dribbler-Sprinter":    "Jet",
    "Dribbler-Target":      "Acrobat",
    "Dribbler-Powerhouse":  "Ox",
    "Passer-Sprinter":      "Flanker",
    "Passer-Target":        "Quarterback",
    "Passer-Powerhouse":    "Quarterback",
    "Striker-Sprinter":     "Quicksilver",
    "Striker-Target":       "Marksman",
    "Striker-Powerhouse":   "Cannon",

    # Tactical + Physical
    "Cover-Sprinter":       "Sweeper",
    "Cover-Target":         "Fortress",
    "Cover-Powerhouse":     "Rock",
    "Engine-Sprinter":      "Roadrunner",
    "Engine-Target":        "Battering Ram",
    "Engine-Powerhouse":    "Machine",
    "Destroyer-Sprinter":   "Blitz",
    "Destroyer-Target":     "Wrecking Ball",
    "Destroyer-Powerhouse": "Terminator",

    # ── GK compounds (rare but possible) ──
    "GK-Controller":        "Modern Keeper",
    "GK-Commander":         "Commander",
    "GK-Cover":             "Traditional Keeper",
    "GK-Passer":            "Sweeper Keeper",
    "GK-Sprinter":          "Sweeper Keeper",
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
