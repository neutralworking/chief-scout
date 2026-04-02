"""
SACROSANCT Model Constants — Single Source of Truth (Python)

13 playing models, each averaging 4 core attributes.
Mirrors apps/web/src/lib/models.ts — keep in sync.
"""

# 13 SACROSANCT playing models, each with 4 core attributes
MODEL_ATTRIBUTES = {
    "Controller":  ["anticipation", "composure", "decisions", "tempo"],
    "Commander":   ["communication", "concentration", "drive", "leadership"],
    "Creator":     ["creativity", "flair", "vision", "threat"],
    "Target":      ["aerial_duels", "heading", "jumping", "volleys"],
    "Sprinter":    ["acceleration", "balance", "movement", "pace"],
    "Powerhouse":  ["aggression", "duels", "shielding", "throwing"],
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
    "statsbomb": 1,           # Demoted: open data, 522 players, grades all metrics regardless of position
    "api_football": 3,
    "kaggle_pl": 2,
    "kaggle_euro": 2,
    "understat": 2,
    "allsportsapi": 2,
    "llm_inferred": 1,   # LLM-estimated mental/tactical attrs (pipeline 93)
    "proxy_inferred": 1,  # Z-score derived sparse attrs (pipeline 38)
    "computed": 1,
    "playstyle_derived": 1,  # Trait→grade bridge (pipeline 56e)
    "fbref": 0,           # Demoted: CSV only has goals/assists, garbage proxies
    "eafc_inferred": 0,
}

# ── Model Labels ─────────────────────────────────────────────────────────────
# Human-readable label for each compound model (Primary-Secondary).
# These name the *skill set combination* independent of position.
# The label describes WHAT the player is; the blueprint (position-specific)
# describes HOW they play in a formation.
#
# Sources: Real Players Active.csv + expanded 20-class taxonomy spreadsheet.
# Player archetypes in comments are canonical examples.

MODEL_LABELS: dict[str, str] = {
    # ── Single models ──
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

    # ── Controller (Mental) primary ──────────────────────────────────────────
    "Controller-Cover":       "Sentinel",           # Rodri — elegant defender
    "Controller-Creator":     "Playmaker",          # Zidane — silk, creates with ease
    "Controller-Destroyer":   "Holder",             # Gareth Barry — holds position, wins ball
    "Controller-Dribbler":    "Ball Magnet",        # Frenkie de Jong — ball sticks to foot
    "Controller-Engine":      "Conductor",          # Pedri — metronome, keeps team ticking
    "Controller-Passer":      "Regista",            # Kroos — runs the show
    "Controller-Powerhouse":  "Anchor",             # Yaya Touré — impossible to dispossess
    "Controller-Sprinter":    "Glider",             # moves ball upfield smoothly
    "Controller-Striker":     "Clinical",           # Berbatov — controls and shoots
    "Controller-Target":      "Composed CB",        # Hummels — controls aerial balls

    # ── Commander (Mental) primary ───────────────────────────────────────────
    "Commander-Cover":        "Captain",            # Maldini — organizes the backline
    "Commander-Creator":      "Talisman",           # Maradona — everything goes through them
    "Commander-Destroyer":    "Heart",              # Roy Keane — drives team through tackles
    "Commander-Dribbler":     "Captain Marvel",     # leads by driving the team forward
    "Commander-Engine":       "General",            # Henderson — sets the rhythm and effort
    "Commander-Passer":       "Director",           # Deschamps — tactical leader
    "Commander-Powerhouse":   "Boss",               # Vieira — dominates through presence
    "Commander-Sprinter":     "Driving Force",      # Thierry Henry — pushes team upfield
    "Commander-Striker":      "Figurehead",         # Gerrard — captain goalscorer
    "Commander-Target":       "Air King",           # Godín — rallies team on set pieces

    # ── Creator (Mental) primary ─────────────────────────────────────────────
    "Creator-Cover":          "Quarterback CB",     # Bonucci — starts attacks from defence
    "Creator-Destroyer":      "Regista",            # Vidal — wins ball and creates chances
    "Creator-Dribbler":       "Conjurer",           # Ronaldinho — dribbles to open lanes
    "Creator-Engine":         "Catalyst",           # Bruno Fernandes — roaming playmaker
    "Creator-Passer":         "Maestro",            # Özil — controls game with passing
    "Creator-Powerhouse":     "Power Playmaker",    # Pogba — holds off players to slip pass
    "Creator-Sprinter":       "Counter King",       # Kaká — creates at top speed
    "Creator-Striker":        "Fantasista",         # Messi — false 9, creates and scores
    "Creator-Target":         "Target Playmaker",   # Yaremchuk — chests down to create

    # ── Cover (Tactical) primary ─────────────────────────────────────────────
    "Cover-Commander":        "Anchor",             # Maldini — commands the backline
    "Cover-Controller":       "Roll-Royce",         # Stones — defends with elegance
    "Cover-Creator":          "Quarterback CB",     # Blind — starts attacks from the back
    "Cover-Destroyer":        "Cornerback",         # Baresi — clean tackler
    "Cover-Dribbler":         "Advancing CB",       # Stones — carries into midfield
    "Cover-Engine":           "Mobile CB",          # Carvalho — covers width of the pitch
    "Cover-Passer":           "Provider",           # Pau Torres — distributes from back
    "Cover-Powerhouse":       "Stalwart",           # dominates the defensive zone
    "Cover-Sprinter":         "Recovery Ace",       # Van der Ven — sweeps up balls over top
    "Cover-Striker":          "Libero Scorer",      # runs from deep to score
    "Cover-Target":           "Towering CB",        # Van Dijk — dominates box in the air

    # ── Engine (Tactical) primary ────────────────────────────────────────────
    "Engine-Commander":        "Driver",            # energy + vocal leadership
    "Engine-Controller":       "Box-To-Box",        # Xavi — always an option
    "Engine-Cover":            "Dynamo",            # Zanetti — mobile, defends wide
    "Engine-Creator":          "Heartbeat",         # Nedved — roaming 10, everywhere
    "Engine-Destroyer":        "Machine",           # Gattuso — tackles for 90 minutes
    "Engine-Dribbler":         "Tornate",           # solo counter, full pitch with ball
    "Engine-Passer":           "Metronome",         # Brozović — shuttle, box to box
    "Engine-Powerhouse":       "Bison",             # Milner — strong and tireless
    "Engine-Sprinter":         "Shuttler",          # Bale — turbo, fast all 90
    "Engine-Striker":          "Livewire",          # Cavani — workhorse forward
    "Engine-Target":           "Athlete",           # Khedira — jumps all game

    # ── Destroyer (Tactical) primary ─────────────────────────────────────────
    "Destroyer-Commander":     "Leader",            # Keane — heart, drives through tackles
    "Destroyer-Controller":    "Lynchpin",          # ball winner, holds possession
    "Destroyer-Cover":         "Shield",            # protects the back four at all costs
    "Destroyer-Creator":       "Disruptor",         # Vidal — box-to-box destroyer
    "Destroyer-Dribbler":      "Surge",             # Redondo — wins ball, drives forward
    "Destroyer-Engine":        "Train",             # Gattuso — machine, tackles all game
    "Destroyer-Passer":        "Recycler",          # Makélélé — wins ball, gives it simple
    "Destroyer-Powerhouse":    "Rock",              # immovable object in midfield
    "Destroyer-Sprinter":      "Shadow",            # catches breakaways with a slide
    "Destroyer-Striker":       "Predator",          # pounces on loose balls to score
    "Destroyer-Target":        "Centre Back",       # wins headers and tackles

    # ── Dribbler (Technical) primary ─────────────────────────────────────────
    "Dribbler-Commander":      "Captain Marvel",    # leads by driving the team forward
    "Dribbler-Controller":     "Ball Magnet",       # Isco — ball seems glued to foot
    "Dribbler-Cover":          "Modern Defender",   # Marcelo — intercepts + carries forward
    "Dribbler-Creator":        "Wizard",            # Ribéry — beats players to open lanes
    "Dribbler-Destroyer":      "Chaos Creator",     # Camavinga — wins ball, dribbles into traffic
    "Dribbler-Engine":         "Solo Counter",      # Son — dribbles 60 yards on counter
    "Dribbler-Powerhouse":     "Tank",              # Leão — dribbles through tackles
    "Dribbler-Sprinter":       "Flash",             # Overmars — knocks ball past and chases
    "Dribbler-Striker":        "Spark",             # Robben — dribbles inside to shoot
    "Dribbler-Target":         "Acrobat",           # uses flair in air and on ground

    # ── Passer (Technical) primary ───────────────────────────────────────────
    "Passer-Commander":        "General",           # Platini — dictates and organizes
    "Passer-Controller":       "Conductor",         # Thiago — orchestrates from centre circle
    "Passer-Cover":            "Provider",          # reads game defensively, QB on offence
    "Passer-Creator":          "Silk",              # Laudrup — effortless vision + execution
    "Passer-Destroyer":        "Recycler",          # wins ball and recycles safely
    "Passer-Engine":           "Shuttle",           # carries ball box-to-box via passing
    "Passer-Powerhouse":       "Midfield Rock",     # impossible to shake off the ball
    "Passer-Sprinter":         "Transition King",   # releases long balls for counters
    "Passer-Target":           "Quarterback",       # wins headers, nods down to teammates

    # ── Striker (Technical) primary ──────────────────────────────────────────
    "Striker-Commander":        "Talisman",         # Cantona — inspires with crucial goals
    "Striker-Controller":       "Ice Man",          # Bergkamp — controls then finishes
    "Striker-Cover":            "Poacher",          # reads where the ball will drop
    "Striker-Creator":          "Finisher",          # Totti — artist forward, vision for shots
    "Striker-Destroyer":        "Spearhead",         # Tevez — wins ball high, shoots immediately
    "Striker-Engine":           "Workhorse",        # Keane — runs channels all game + finishes
    "Striker-Powerhouse":       "Rifle",            # Batistuta — holds off defenders to shoot
    "Striker-Sprinter":         "Rocket",           # Bale — pace to get a shot away
    "Striker-Target":           "Hitman",           # Ibrahimović — tower, dominates air + scores

    # ── Target (Physical) primary ────────────────────────────────────────────
    "Target-Commander":         "Air King",         # leads on set pieces
    "Target-Controller":        "Composed CB",      # Hummels — controls aerial balls calmly
    "Target-Creator":           "Target Playmaker", # chests down to create
    "Target-Destroyer":         "Titan",            # Souček — wins air duels + tackles
    "Target-Dribbler":          "Acrobat",          # aerial skills + ground flair
    "Target-Engine":            "Boxcrasher",       # aerial threat + tireless running
    "Target-Passer":            "Quarterback",      # aerial presence + distribution
    "Target-Powerhouse":        "Colossus",         # Ibrahimović — unmovable in air
    "Target-Sprinter":          "Leaper",           # Ronaldo — fast and high
    "Target-Striker":           "Tower",            # Crouch — wins headers and scores

    # ── Sprinter (Physical) primary ──────────────────────────────────────────
    "Sprinter-Commander":       "Driving Force",    # Valencia — pushes team pace
    "Sprinter-Controller":      "Glider",           # de Jong — moves fast with ball
    "Sprinter-Cover":           "Flanker",          # Evra — sweeper, covers behind line
    "Sprinter-Creator":         "Breakaway",        # Pedro Neto — creates on counter
    "Sprinter-Destroyer":       "Shadow",           # closes down at speed
    "Sprinter-Dribbler":        "Flash",            # Overmars — kick and rush
    "Sprinter-Engine":          "Shuttler",         # Robertson — marathon sprinter
    "Sprinter-Powerhouse":      "Juggernaut",       # Traoré — fast and strong
    "Sprinter-Striker":         "Ghost",            # Mbappé — pace in behind
    "Sprinter-Target":          "Leaper",           # Ronaldo — fast and jumps high

    # ── Powerhouse (Physical) primary ────────────────────────────────────────
    "Powerhouse-Commander":     "Boss",             # Rijkaard — physical leader
    "Powerhouse-Controller":    "Anchor",           # Karembeu — strong in possession
    "Powerhouse-Cover":         "Dominator",        # Emre Can — controls zone
    "Powerhouse-Creator":       "Power Playmaker",  # Milinković-Savić — strong playmaker
    "Powerhouse-Destroyer":     "Enforcer",         # physically dominates + tackles
    "Powerhouse-Dribbler":      "Tank",             # Morgan Rogers — dribbles through contact
    "Powerhouse-Engine":        "Horse",            # Essien — strong runner
    "Powerhouse-Passer":        "Midfield Rock",    # strong passer
    "Powerhouse-Sprinter":      "Athlete",          # Antonio — fast and strong
    "Powerhouse-Striker":       "Spearhead",        # Drogba — holds up and scores
    "Powerhouse-Target":        "Colossus",         # Benteke — unmovable object

    # ── GK compounds ──
    "GK-Controller":            "Modern Keeper",
    "GK-Commander":             "Commander",
    "GK-Cover":                 "Traditional Keeper",
    "GK-Passer":                "Sweeper Keeper",
    "GK-Sprinter":              "Sweeper Keeper",
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
    "unpredicability": "flair",
}
