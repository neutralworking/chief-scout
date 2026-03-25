"""
80_export_card_templates.py — Generate Kickoff Clash cards from Chief Scout player data.

Reads real player data (profiles, personality) and transforms into fictional
game cards with comedic names, absurd bios, and tactical abilities.

Outputs:
  - Upserts to kc_cards table (one card per source player)

Usage:
    python 80_export_card_templates.py                    # all eligible players (level >= 50)
    python 80_export_card_templates.py --limit 100        # first 100 players
    python 80_export_card_templates.py --min-level 70     # only level 70+
    python 80_export_card_templates.py --dry-run           # preview without writing
    python 80_export_card_templates.py --force             # overwrite existing cards
"""
import argparse
import hashlib
import random
import sys
from datetime import datetime, timezone

from config import POSTGRES_DSN
from lib.db import require_conn, get_supabase, chunked_upsert

# ── Argument parsing ───────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Generate Kickoff Clash cards from CS data")
parser.add_argument("--limit", type=int, default=None,
                    help="Max players to process")
parser.add_argument("--min-level", type=int, default=50,
                    help="Minimum CS level to include (default: 50)")
parser.add_argument("--dry-run", action="store_true",
                    help="Print cards but don't write to database")
parser.add_argument("--force", action="store_true",
                    help="Overwrite existing cards")
args = parser.parse_args()

DRY_RUN = args.dry_run
FORCE = args.force
MIN_LEVEL = args.min_level
CHUNK_SIZE = 200

# ── Connections ────────────────────────────────────────────────────────────────

conn = require_conn(autocommit=True)
sb_client = None if DRY_RUN else get_supabase()


# ── Fictional Name Generation ──────────────────────────────────────────────────

FUNNY_SURNAMES = [
    "Thunderboot", "McSlide", "von Nutmeg", "El Bicicleta", "Tacklesworth",
    "De Crossbar", "Headington", "Pressington", "Dribbleton", "Van der Post",
    "O'Volley", "Longball", "Nutmeggington", "Backheelson", "Chippington",
    "McTackle", "El Rabona", "von Pressing", "De Keeper", "Setpieceman",
    "Throughballski", "O'Flank", "Halverson", "Cruyffstein", "Van Overlap",
    "Slidetackle", "McHeader", "El Trivela", "von Gegenpresse", "De Libero",
    "Offsiderton", "Freekickson", "Counterston", "Buildupsley", "Van der Muur",
    "O'Dribble", "Sweepington", "McPress", "El Panenka", "von Schatten",
    "Sprintington", "Crossbarsen", "Halvtiden", "De Panna", "Van Roulette",
    "Scissorkickski", "McOverlap", "El Golazo", "von Abseitsfalle", "De Mezzala",
    "Volleysworth", "Chipshot", "Markington", "Playmakersson", "Van der Tackle",
    "O'Clearance", "Throughton", "McVolley", "El Sombrero", "von Flanke",
    "Shootington", "Counterberg", "Halvspansen", "De Schwalbe", "Van Pressing",
    "Longrangerton", "McSweep", "El Chilena", "von Torschuss", "De Voetbal",
    "Blockerston", "Passington", "Anchorman", "Shuttleson", "Van der Kreuz",
    "O'Lob", "Tikitakason", "McShield", "El Cabezon", "von Kapitaen",
    "Holdupsworth", "Targetston", "Dinkington", "Poacherson", "Van der Goal",
    "O'Sprint", "Rouletteman", "McCreate", "El Falso", "von Strategie",
    "Marshallton", "Sweepski", "Interceptson", "Runbehinderson", "Van der Ruimte",
    "O'Switch", "Shieldington", "McEngine", "El Segundo", "von Taktik",
    "Distributon", "Launchpad", "Anchorsson", "Workrateberg", "Van der Bal",
]

def generate_name(person_id, real_name):
    """Generate a fictional name: first initial + funny surname."""
    # Use person_id as seed for deterministic output
    rng = random.Random(person_id)
    initial = real_name[0].upper() if real_name else "X"
    surname = rng.choice(FUNNY_SURNAMES)
    return f"{initial}. {surname}"


# ── Personality Theme Mapping ──────────────────────────────────────────────────

PERSONALITY_THEME_MAP = {
    "ANLC": "General",
    "ANSC": "General",
    "INSC": "General",
    "AXLC": "Catalyst",
    "IXSC": "Catalyst",
    "IXLC": "Catalyst",
    "AXSC": "Catalyst",
    "INSP": "Maestro",
    "ANLP": "Maestro",
    "IXSP": "Maestro",
    "INLC": "Captain",
    "INLP": "Captain",
    "ANSP": "Professor",
    "AXSP": "Professor",
    "IXLP": "Professor",
    "AXLP": "Professor",
}

ALL_THEMES = ["General", "Catalyst", "Maestro", "Captain", "Professor"]
ALL_PERSONALITY_TYPES = list(PERSONALITY_THEME_MAP.keys())

def get_theme(personality_type):
    """Map personality type code to theme."""
    if personality_type and personality_type in PERSONALITY_THEME_MAP:
        return PERSONALITY_THEME_MAP[personality_type]
    return None


# ── Bio Templates ──────────────────────────────────────────────────────────────

BIO_TEMPLATES = {
    "General": [
        "Arrives at training 45 minutes early. Leaves 45 minutes late. Has never smiled on a football pitch.",
        "Keeps a spreadsheet of every training session since age 14. The spreadsheet has its own spreadsheet.",
        "Once gave a 20-minute half-time talk that was later published as a management textbook.",
        "Teammates describe the experience of playing alongside them as 'efficient and slightly terrifying'.",
        "Has never missed a team meeting. Has never enjoyed one either.",
        "The type of player who irons their training kit. And their socks. And their shinpads.",
        "Reads the opposition analysis report for fun. Has notes in the margins of the notes.",
        "Once described a 3-0 win as 'acceptable but with room for improvement in the third phase'.",
        "Their pre-match routine has 47 steps. Step 23 is 'review contingency plans'.",
        "Has a favourite spreadsheet. Will not tell you which one.",
    ],
    "Catalyst": [
        "Once nutmegged the referee just to prove a point. The crowd went silent. Then erupted.",
        "Has been booked for excessive celebration in a pre-season friendly. Against their own reserves.",
        "The only player to ever start a standing ovation for themselves. It caught on.",
        "Their autobiography was ghost-written by a fireworks display.",
        "Once scored a bicycle kick and immediately complained the ball was the wrong shade of white.",
        "Has a clause in their contract requiring pyrotechnics for home matches.",
        "The last three stadiums they played at needed structural repairs. Nobody is sure why.",
        "Their social media manager has a support group. It meets weekly.",
        "Once did a rabona in the warm-up and the ticket prices went up.",
        "Legend has it they once celebrated a throw-in. Nobody could prove it didn't deserve one.",
    ],
    "Maestro": [
        "Sees passes that exist in parallel dimensions. Has completed more through balls than conversations.",
        "Plays football the way poets write sonnets — quietly, beautifully, and mostly unappreciated by the general public.",
        "Their left foot has been classified as a national treasure in three countries.",
        "Once controlled a ball so perfectly that the laws of physics filed a formal complaint.",
        "Speaks to the ball before every free kick. The ball listens.",
        "Has never raised their voice on a pitch. Has never needed to.",
        "The opposition know exactly what they're going to do. They still can't stop it.",
        "Their highlight reel is 90 minutes long. It's just one match.",
        "Was once asked about their best goal. They described a pass instead.",
        "Moves so gracefully that the grass thanks them for walking on it.",
    ],
    "Captain": [
        "Would run through a wall for the team. Has run through three. Club still fixing the dressing room.",
        "Once gave a team talk so intense the substitute goalkeeper cried.",
        "Their armband isn't just an armband. It's a warning.",
        "Has headered the ball, the post, two defenders, and the concept of defeat.",
        "The type who shakes every teammate's hand before the match. And squeezes. Hard.",
        "Once played 120 minutes with a broken toe because 'the lads needed me'.",
        "Their pre-match speech has been compared to Braveheart. But shorter. And angrier.",
        "Opposition strikers have been known to apologise to them mid-match.",
        "The physio once told them to come off. They told the physio to come off.",
        "Has never lost a coin toss. Referees are too intimidated to check.",
    ],
    "Professor": [
        "Calculated the optimal pressing angle to three decimal places. Teammates just call it 'standing there'.",
        "Has a PhD in Expected Goals. Literally. The university gave them one out of respect.",
        "Once drew a formation on a napkin that accidentally solved a maths problem.",
        "Their passing map looks like a circuit board. It functions like one too.",
        "Watches film of their own training sessions. On holiday. By the pool.",
        "The only player whose tactical analysis is longer than the match report.",
        "Once corrected the manager's formation mid-match. The manager thanked them.",
        "Their heat map has right angles. Nobody knows how.",
        "Reads football the way chess grandmasters read a board — five moves ahead, slightly bored.",
        "Was once asked about instinct. They asked for a definition and a data set.",
    ],
}


def generate_bio(personality_theme, person_id):
    """Pick a deterministic bio template based on theme and person_id."""
    rng = random.Random(person_id + 7919)  # offset seed from name generation
    templates = BIO_TEMPLATES.get(personality_theme, BIO_TEMPLATES["General"])
    return rng.choice(templates)


# ── Power & Rarity Mapping ────────────────────────────────────────────────────

def compute_power(level):
    """Map CS level to card power (1-100)."""
    rng = random.Random(level * 31 + 17)
    if level >= 90:
        return rng.randint(85, 95)
    elif level >= 80:
        return rng.randint(70, 84)
    elif level >= 70:
        return rng.randint(55, 69)
    elif level >= 60:
        return rng.randint(40, 54)
    else:
        return rng.randint(25, 39)


def compute_rarity(level):
    """Map CS level to rarity tier."""
    if level >= 85:
        return "Legendary"
    elif level >= 75:
        return "Epic"
    elif level >= 65:
        return "Rare"
    else:
        return "Common"


# ── Gate Pull ──────────────────────────────────────────────────────────────────

ARCHETYPE_GATE_PULL = {
    "Dribbler": 30,
    "Creator": 25,
    "Striker": 20,
    "Sprinter": 15,
    "Engine": 5,
    "Cover": 0,
    "Destroyer": 0,
    "Controller": 0,
    "Commander": 0,
    "Target": 0,
    "Powerhouse": 0,
    "Passer": 0,
    "GK": 0,
}

THEME_GATE_BONUS = {
    "Catalyst": 40,
    "Captain": 15,
    "Maestro": 10,
    "General": 5,
    "Professor": 0,
}

def compute_durability(rarity, personality_theme, rng):
    """Assign durability tier based on rarity and personality.

    From mechanics doc — rarity × durability distribution:
      Common:    mostly Standard, some Iron, rare Phoenix, never Titanium
      Rare:      even spread, very rare Titanium
      Epic:      even spread, rare Titanium, uncommon Glass/Phoenix
      Legendary: rare everything — high-risk high-reward

    Personality influence:
      Catalyst → more Glass/Phoenix (volatile)
      Captain  → more Iron/Titanium (reliable)
      Maestro  → more Glass/Fragile (temperamental genius)
      Professor → more Standard/Iron (consistent)
      General  → baseline distribution
    """
    # Base weights per rarity: [glass, fragile, standard, iron, titanium, phoenix]
    RARITY_WEIGHTS = {
        "Common":    [3,  8, 55, 15, 0,  4],
        "Rare":      [8, 15, 35, 20, 2, 10],
        "Epic":      [10, 12, 30, 18, 5, 10],
        "Legendary": [12, 10, 20, 15, 8, 12],
    }
    # Personality modifiers (additive to weights)
    THEME_MODS = {
        "Catalyst":  [8,  0,  -5, -3, 0,  8],   # volatile: more glass + phoenix
        "Captain":   [-5, -3,  0,  8, 5, -3],   # reliable: more iron + titanium
        "Maestro":   [8,  5,  -5, -5, 0,  3],   # genius: more glass/fragile
        "Professor": [-3, -3,  5,  5, 2, -2],   # consistent: more standard/iron
        "General":   [0,  0,  0,  0, 0,  0],    # baseline
    }
    TIERS = ["glass", "fragile", "standard", "iron", "titanium", "phoenix"]

    weights = list(RARITY_WEIGHTS.get(rarity, RARITY_WEIGHTS["Common"]))
    mods = THEME_MODS.get(personality_theme, THEME_MODS["General"])
    weights = [max(0, w + m) for w, m in zip(weights, mods)]

    # Weighted random selection
    return rng.choices(TIERS, weights=weights, k=1)[0]


def compute_gate_pull(archetype, personality_theme):
    """Compute gate pull from archetype + personality theme."""
    base = ARCHETYPE_GATE_PULL.get(archetype, 0)
    bonus = THEME_GATE_BONUS.get(personality_theme, 0)
    return base + bonus


# ── Role Abilities ─────────────────────────────────────────────────────────────

ROLE_ABILITIES = {
    # GK roles
    "Torwart":          ("Iron Curtain",    "Blocks 20% of opponent's highest-scoring card"),
    "Sweeper Keeper":   ("No Man's Land",   "+25% when placed behind a Destroyer or Cover card"),
    "Ball-Playing GK":  ("Launch Pad",      "Every outfield card gets +3% connection bonus"),
    # CD roles
    "Libero":           ("Surgical Pass",   "Each attacker in lineup gets +10%"),
    "Stopper":       ("Front Foot",      "+30% own power if opponent has a CF card"),
    "Sweeper":          ("The Shield",      "Lowest-scoring card gets +30%"),
    "Zagueiro":         ("Command Line",    "All cards in adjacent slots get +10%"),
    # WD roles
    "Lateral":          ("Overlap",         "If paired with Inside Forward or Winger, both +15%"),
    "Invertido":        ("Tuck Inside",     "Counts as both WD and CM for synergies"),
    "Carrilero":        ("Lane Runner",     "+20% in WD slot, +5% per Sprinter in lineup"),
    "Fluidificante":    ("Fluid Motion",    "+15% when lineup has 3+ different archetypes"),
    # DM roles
    "Anchor":       ("The Shield",      "Lowest-scoring card gets +30%"),
    "Regista":          ("Metronome",       "Boosts every other card's connection bonus by 5%"),
    "Volante":          ("Tackle & Go",     "Reduces opponent score by 15%"),
    # CM roles
    "Metodista":        ("Tempo Control",   "Style multiplier +0.15 for entire lineup"),
    "Tuttocampista":    ("Box to Box",      "+5% per different archetype in lineup"),
    "Mezzala":          ("Half-Space Run",  "+20% when adjacent to a Creator or Passer"),
    "Relayeur":         ("Relay",           "Transfers 10% of own power to two weakest cards"),
    # WM roles
    "Fantasista":       ("Silk Touch",      "30% chance to double connection bonuses for lineup"),
    "Winger":           ("Touchline",       "+25% in wide slot, -10% in central slot"),
    "Raumdeuter":       ("Space Finder",    "Ignores opponent's defensive abilities"),
    "Tornante":         ("Full Flank",      "+10% for each Engine or Sprinter in lineup"),
    # AM roles
    "Trequartista":     ("Moment of Genius","30% chance of doubling own score, or +0%"),
    "Enganche":         ("The Hook",        "Pick one card: it gets +25%, this card gets -10%"),
    "Seconda Punta":    ("Between Lines",   "Counts as both AM and CF for synergies"),
    # WF roles
    "Inside Forward":   ("Cut Inside",      "+20% when on opposite flank to strong foot"),
    "Extremo":          ("Jet Heels",       "+30% if lineup has no other Sprinter"),
    "Inverted Winger":  ("Creator's Cut",   "+15% and generates +10 gate pull per match"),
    "Inventor":         ("Something From Nothing", "20% chance to trigger a bonus synergy"),
    # CF roles
    "Prima Punta":      ("Target Man",      "+40% when receiving crosses (paired with Lateral/Winger)"),
    "Poacher":          ("Box Presence",    "+40% in CF slot, +0% elsewhere"),
    "Complete Forward": ("Total Striker",   "+10% per unique compound category in lineup"),
    "Falso Nove":       ("The Drop",        "Counts as both CF and AM for synergies"),
}

# Fallback ability for roles not in the map
DEFAULT_ABILITY = ("Utility Player", "+5% base power in any slot")


def get_ability(tactical_role):
    """Get ability name and text for a tactical role."""
    if tactical_role and tactical_role in ROLE_ABILITIES:
        return ROLE_ABILITIES[tactical_role]
    return DEFAULT_ABILITY


# ── Card Generation ────────────────────────────────────────────────────────────

def generate_card(player):
    """Transform a CS player row into a KC card dict."""
    pid = player["id"]
    name = player["name"]
    position = player["position"]
    archetype = player["archetype"]
    level = player["level"]
    overall = player["overall"]
    best_role = player["best_role"]
    model_id = player["model_id"]
    # Compute personality type from dichotomies (ei/sn/tf/jp, threshold 50)
    ei, sn, tf, jp = player.get("ei"), player.get("sn"), player.get("tf"), player.get("jp")
    if ei is not None and sn is not None and tf is not None and jp is not None:
        personality_type = (
            ("A" if ei >= 50 else "I") +
            ("X" if sn >= 50 else "N") +
            ("S" if tf >= 50 else "L") +
            ("C" if jp >= 50 else "P")
        )
    else:
        personality_type = None
    competitiveness = player["competitiveness"]
    coachability = player["coachability"]

    # Use person_id as master seed for deterministic generation
    rng = random.Random(pid)

    # Name
    card_name = generate_name(pid, name)

    # Personality: use real type or assign random
    if not personality_type or personality_type not in PERSONALITY_THEME_MAP:
        personality_type = rng.choice(ALL_PERSONALITY_TYPES)

    theme = get_theme(personality_type)

    # Bio
    bio = generate_bio(theme, pid)

    # Power (deterministic per player, not per level)
    power_rng = random.Random(pid * 37 + 41)
    if level >= 90:
        power = power_rng.randint(85, 95)
    elif level >= 80:
        power = power_rng.randint(70, 84)
    elif level >= 70:
        power = power_rng.randint(55, 69)
    elif level >= 60:
        power = power_rng.randint(40, 54)
    else:
        power = power_rng.randint(25, 39)

    # Rarity
    rarity = compute_rarity(level)

    # Secondary archetype
    secondary_archetype = None
    if model_id and model_id != archetype:
        secondary_archetype = model_id

    # Tactical role
    tactical_role = best_role

    # Ability
    ability_name, ability_text = get_ability(tactical_role)

    # Gate pull
    gate_pull = compute_gate_pull(archetype, theme)

    # Durability (deterministic per player)
    dur_rng = random.Random(pid * 53 + 17)
    durability = compute_durability(rarity, theme, dur_rng)

    # Art seed (deterministic)
    art_seed = f"kc_{pid}_{archetype}_{theme}"

    return {
        "name": card_name,
        "bio": bio,
        "position": position,
        "archetype": archetype,
        "secondary_archetype": secondary_archetype,
        "tactical_role": tactical_role,
        "personality_type": personality_type,
        "personality_theme": theme,
        "power": power,
        "rarity": rarity,
        "art_seed": art_seed,
        "ability_name": ability_name,
        "ability_text": ability_text,
        "gate_pull": gate_pull,
        "durability": durability,
        "source_person_id": pid,
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Kickoff Clash — Card Template Generator")
    print(f"  Min level: {MIN_LEVEL}")
    print(f"  Dry run:   {DRY_RUN}")
    print(f"  Force:     {FORCE}")

    cur = conn.cursor()

    # ── Fetch existing cards (to skip unless --force) ──────────────────────────

    existing_ids = set()
    if not FORCE:
        try:
            cur.execute("SELECT source_person_id FROM kc_cards WHERE source_person_id IS NOT NULL")
            existing_ids = {row[0] for row in cur.fetchall()}
            if existing_ids:
                print(f"  Existing cards: {len(existing_ids)} (use --force to overwrite)")
        except Exception:
            # Table may not exist yet
            conn.rollback() if not conn.autocommit else None
            existing_ids = set()

    # ── Fetch source players ──────────────────────────────────────────────────

    print("\n  Loading source players...")

    query = """
        SELECT p.id, p.name, p.active,
               pp.position, pp.archetype, pp.level, pp.overall, pp.best_role, pp.model_id,
               per.ei, per.sn, per.tf, per.jp, per.competitiveness, per.coachability
        FROM people p
        JOIN player_profiles pp ON pp.person_id = p.id
        LEFT JOIN player_personality per ON per.person_id = p.id
        WHERE pp.position IS NOT NULL
          AND pp.archetype IS NOT NULL
          AND pp.level IS NOT NULL
          AND pp.level >= %s
        ORDER BY pp.level DESC
    """
    params = [MIN_LEVEL]

    if args.limit:
        query += " LIMIT %s"
        params.append(args.limit)

    cur.execute(query, params)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    players = [dict(zip(cols, row)) for row in rows]
    print(f"  Source players fetched: {len(players)}")

    if not players:
        print("  No eligible players found.")
        cur.close()
        conn.close()
        return

    # ── Generate cards ────────────────────────────────────────────────────────

    print("\n  Generating cards...")

    cards = []
    skipped = 0

    for player in players:
        pid = player["id"]

        # Skip if already exists and not forcing
        if pid in existing_ids and not FORCE:
            skipped += 1
            continue

        card = generate_card(player)
        cards.append(card)

    print(f"  Cards generated: {len(cards)}")
    if skipped:
        print(f"  Skipped (existing): {skipped}")

    if not cards:
        print("  Nothing to write.")
        cur.close()
        conn.close()
        return

    # ── Show samples ──────────────────────────────────────────────────────────

    print(f"\n  Sample cards (first 5):")
    for card in cards[:5]:
        print(f"    {card['name']:25s} {card['position']:3s}  "
              f"pwr={card['power']:2d}  {card['rarity']:10s}  "
              f"{card['archetype']:12s}  {card['personality_theme']:10s}  "
              f"gate={card['gate_pull']}  {card['durability']}")
        print(f"      Role: {card['tactical_role'] or 'None':20s}  "
              f"Ability: {card['ability_name']}")
        print(f"      Bio: {card['bio'][:80]}...")

    # ── Write to database ─────────────────────────────────────────────────────

    if not DRY_RUN:
        now_iso = datetime.now(timezone.utc).isoformat()

        # Add timestamps
        for card in cards:
            card["updated_at"] = now_iso

        print(f"\n  Upserting {len(cards)} cards to kc_cards...")
        chunked_upsert(sb_client, "kc_cards", cards, conflict="source_person_id", chunk_size=CHUNK_SIZE)
        print(f"  Done — {len(cards)} cards written.")
    else:
        print(f"\n  [dry-run] Would write {len(cards)} cards to kc_cards")

    # ── Summary ───────────────────────────────────────────────────────────────

    print(f"\n── Summary ───────────────────────────────────────────────────────")
    print(f"  Total cards generated: {len(cards)}")

    # By rarity
    rarity_counts = {}
    for card in cards:
        rarity_counts[card["rarity"]] = rarity_counts.get(card["rarity"], 0) + 1
    print(f"\n  By rarity:")
    for rarity in ["Legendary", "Epic", "Rare", "Common"]:
        count = rarity_counts.get(rarity, 0)
        pct = (count / len(cards) * 100) if cards else 0
        print(f"    {rarity:12s} {count:5d}  ({pct:.1f}%)")

    # By position
    pos_counts = {}
    for card in cards:
        pos_counts[card["position"]] = pos_counts.get(card["position"], 0) + 1
    print(f"\n  By position:")
    for pos in ["GK", "CD", "WD", "DM", "CM", "WM", "AM", "WF", "CF"]:
        count = pos_counts.get(pos, 0)
        if count:
            print(f"    {pos:3s}  {count:5d}")

    # By personality theme
    theme_counts = {}
    for card in cards:
        theme_counts[card["personality_theme"]] = theme_counts.get(card["personality_theme"], 0) + 1
    print(f"\n  By personality theme:")
    for theme in ALL_THEMES:
        count = theme_counts.get(theme, 0)
        pct = (count / len(cards) * 100) if cards else 0
        print(f"    {theme:12s} {count:5d}  ({pct:.1f}%)")

    # By durability
    dur_counts = {}
    for card in cards:
        dur_counts[card["durability"]] = dur_counts.get(card["durability"], 0) + 1
    print(f"\n  By durability:")
    for dur in ["glass", "fragile", "standard", "iron", "titanium", "phoenix"]:
        count = dur_counts.get(dur, 0)
        pct = (count / len(cards) * 100) if cards else 0
        print(f"    {dur:10s} {count:5d}  ({pct:.1f}%)")

    if DRY_RUN:
        print("\n  (dry-run — no data was written)")

    cur.close()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
