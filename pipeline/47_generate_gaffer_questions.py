"""
47_generate_gaffer_questions.py — LLM-generated Gaffer questions from real player data.

Queries the database for interesting player clusters (free agents at same position,
archetype battles, stat anomalies, etc.), sends them to the LLM router to write
engaging scenario questions, and upserts to fc_questions/fc_options.

All generated questions are tagged 'llm-generated' for clean separation from
hand-crafted questions in 20_seed_choices.py.

Requires: migrations 015, 022, 045 + populated player_intelligence_card

Usage:
    python 47_generate_gaffer_questions.py --dry-run           # preview
    python 47_generate_gaffer_questions.py --count 20          # limit output
    python 47_generate_gaffer_questions.py --archetype free_agent  # one type only
    python 47_generate_gaffer_questions.py --force             # replace all llm-generated
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
import time
from collections import defaultdict
from datetime import date

import psycopg2
from config import POSTGRES_DSN
from lib.llm_router import LLMRouter

# ── Args ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Generate Gaffer questions via LLM")
parser.add_argument("--dry-run", action="store_true")
parser.add_argument("--force", action="store_true", help="Delete existing llm-generated questions first")
parser.add_argument("--count", type=int, default=200, help="Max total questions to generate")
parser.add_argument("--archetype", default=None, help="Run only one archetype (e.g. free_agent)")
parser.add_argument("--batch-size", type=int, default=5, help="Question clusters per LLM call")
args = parser.parse_args()

DRY_RUN = args.dry_run
BATCH_SIZE = args.batch_size
TODAY = date.today()

if not POSTGRES_DSN:
    print("ERROR: Set POSTGRES_DSN in .env.local")
    sys.exit(1)

# ── DB Setup ──────────────────────────────────────────────────────────────────

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = False
cur = conn.cursor()

# Load category map
cur.execute("SELECT slug, id FROM fc_categories")
cat_map = dict(cur.fetchall())

# Load people name→id lookup
cur.execute("SELECT id, name FROM people")
people_by_name: dict[str, int] = {}
for pid, pname in cur.fetchall():
    people_by_name[pname.lower().strip()] = pid


def find_person(name: str) -> int | None:
    norm = name.lower().strip()
    if norm in people_by_name:
        return people_by_name[norm]
    for pname, pid in people_by_name.items():
        if norm in pname or pname in norm:
            return pid
    return None


# Check for existing llm-generated question hashes (idempotency)
cur.execute("SELECT unnest(tags) FROM fc_questions WHERE 'llm-generated' = ANY(tags)")
existing_hashes = {row[0] for row in cur.fetchall() if row[0] and row[0].startswith("cluster:")}

if args.force and not DRY_RUN:
    cur.execute("""
        DELETE FROM fc_options WHERE question_id IN (
            SELECT id FROM fc_questions WHERE 'llm-generated' = ANY(tags)
        )
    """)
    cur.execute("DELETE FROM fc_questions WHERE 'llm-generated' = ANY(tags)")
    deleted = cur.rowcount
    conn.commit()
    existing_hashes = set()
    print(f"  Deleted {deleted} existing llm-generated questions")

# ── Player Data Loading ───────────────────────────────────────────────────────

print("Loading player data...")

cur.execute("""
    SELECT pic.person_id, pic.name, pic.position, pic.level, pic.overall,
           pic.archetype, pic.earned_archetype, pic.club, pic.nation,
           pic.dob, pic.personality_type, pic.best_role, pic.best_role_score,
           pic.technical_score, pic.tactical_score, pic.mental_score, pic.physical_score,
           pic.market_value_eur, pic.market_value_tier, pic.league_name, pic.profile_tier,
           pic.legacy_score, pic.hg, pic.peak
    FROM player_intelligence_card pic
    WHERE pic.active = true
      AND pic.profile_tier <= 2
      AND pic.level >= 78
    ORDER BY pic.level DESC
""")
columns = [
    "person_id", "name", "position", "level", "overall",
    "archetype", "earned_archetype", "club", "nation",
    "dob", "personality_type", "best_role", "best_role_score",
    "technical_score", "tactical_score", "mental_score", "physical_score",
    "market_value_eur", "market_value_tier", "league_name", "profile_tier",
    "legacy_score", "hg", "peak"
]
all_players = [dict(zip(columns, row)) for row in cur.fetchall()]
print(f"  Loaded {len(all_players)} players (level ≥ 78, tier ≤ 2)")

# Index by position
by_position: dict[str, list[dict]] = defaultdict(list)
for p in all_players:
    if p["position"]:
        by_position[p["position"]].append(p)

# Load contract status
cur.execute("""
    SELECT person_id, contract_tag FROM player_status
    WHERE contract_tag IN ('Six Months', 'Expiring', 'Free Agent', 'One Year Left')
""")
contract_tags: dict[int, str] = dict(cur.fetchall())

# Load top 3 standout attributes per player (for dossier enrichment)
cur.execute("""
    SELECT player_id, attribute, stat_score
    FROM attribute_grades
    WHERE stat_score >= 13
    ORDER BY player_id, stat_score DESC
""")
top_attrs: dict[int, list[tuple[str, float]]] = defaultdict(list)
for pid, attr, score in cur.fetchall():
    if len(top_attrs[pid]) < 3:
        top_attrs[pid].append((attr, float(score)))

print(f"  Contract tags: {len(contract_tags)} players")
print(f"  Standout attributes: {len(top_attrs)} players with elite grades")


# ── Helpers ───────────────────────────────────────────────────────────────────

def player_age(p: dict) -> int | None:
    if not p["dob"]:
        return None
    try:
        dob = p["dob"] if isinstance(p["dob"], date) else date.fromisoformat(str(p["dob"])[:10])
        return (TODAY - dob).days // 365
    except (ValueError, TypeError):
        return None


def cluster_hash(archetype_name: str, person_ids: list[int]) -> str:
    key = f"{archetype_name}:{','.join(str(i) for i in sorted(person_ids))}"
    return "cluster:" + hashlib.md5(key.encode()).hexdigest()[:10]


def build_dossier(p: dict) -> str:
    """Build a text dossier for one player."""
    age = player_age(p)
    age_str = f"age {age}" if age else "age unknown"
    contract = contract_tags.get(p["person_id"], "N/A")
    archetype = p["earned_archetype"] or p["archetype"] or "unclassified"
    role = p["best_role"] or "unassigned"
    rs = p["best_role_score"] or 0

    lines = [
        f"  {p['name']} ({p['position']}, {archetype}) — {p['club'] or '?'}, {p['nation'] or '?'}, {age_str}",
        f"    Level: {p['level']}, Role: {role} ({rs})",
        f"    Pillars: Tech {p['technical_score'] or 0}/100, Tac {p['tactical_score'] or 0}/100, "
        f"Men {p['mental_score'] or 0}/100, Phy {p['physical_score'] or 0}/100",
    ]
    extras = []
    if p["personality_type"]:
        extras.append(f"Personality: {p['personality_type']}")
    if p["market_value_eur"]:
        mv = p["market_value_eur"]
        if mv >= 1_000_000:
            extras.append(f"Value: €{mv / 1_000_000:.0f}m")
    if contract != "N/A":
        extras.append(f"Contract: {contract}")
    if p["league_name"]:
        extras.append(f"League: {p['league_name']}")

    attrs = top_attrs.get(p["person_id"], [])
    if attrs:
        attr_str = ", ".join(f"{a}={s:.0f}/20" for a, s in attrs)
        extras.append(f"Standout: {attr_str}")

    if extras:
        lines.append(f"    {', '.join(extras)}")
    return "\n".join(lines)


TOP5_LEAGUES = {"Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"}

# ── Question Archetypes ───────────────────────────────────────────────────────
# Each returns a list of clusters, where each cluster is (category_slug, archetype_desc, [4 players])


def arch_free_agent() -> list[tuple[str, str, list[dict]]]:
    """Free agents at same position — who are you signing on a free?"""
    clusters = []
    free_ids = {pid for pid, tag in contract_tags.items() if tag in ("Expiring", "Free Agent", "Six Months")}
    for pos, players in by_position.items():
        if pos is None:
            continue
        candidates = [p for p in players if p["person_id"] in free_ids and p["level"] >= 80]
        if len(candidates) < 4:
            continue
        # Take top by level, then sample for variety
        top = candidates[:12]
        random.shuffle(top)
        for i in range(0, len(top) - 3, 4):
            group = sorted(top[i:i+4], key=lambda x: -(x["level"] or 0))
            if len(group) == 4:
                clusters.append(("transfer", "Free agent dilemma — same position, expiring contracts", group))
                if len(clusters) >= 20:
                    return clusters
    return clusters


def arch_replacement() -> list[tuple[str, str, list[dict]]]:
    """Your star is aging — who replaces them?"""
    clusters = []
    for pos in ["CF", "AM", "WF", "CM", "CD", "WD", "GK"]:
        players = by_position.get(pos, [])
        if len(players) < 8:
            continue
        # Find aging stars (30+) and younger replacements
        aging = [p for p in players if player_age(p) and player_age(p) >= 30 and p["level"] >= 84]
        replacements = [p for p in players if player_age(p) and player_age(p) < 28 and p["level"] >= 82]
        if not aging or len(replacements) < 3:
            continue
        for veteran in aging[:5]:
            # Find 3 replacements at similar or slightly lower level
            viable = [r for r in replacements if abs((r["level"] or 0) - (veteran["level"] or 0)) <= 6]
            if len(viable) < 3:
                continue
            picked = random.sample(viable[:10], min(3, len(viable)))
            group = [veteran] + picked
            clusters.append((
                "transfer",
                f"Replacement search — {veteran['name']} is aging, pick their successor",
                group
            ))
            if len(clusters) >= 25:
                return clusters
    return clusters


def arch_budget() -> list[tuple[str, str, list[dict]]]:
    """Fixed budget for a position — who do you buy?"""
    clusters = []
    bands = [
        ("€20-40m", 20_000_000, 40_000_000),
        ("€40-70m", 40_000_000, 70_000_000),
        ("€70-120m", 70_000_000, 120_000_000),
    ]
    for pos in ["CF", "AM", "WF", "CM", "CD", "WD", "DM"]:
        players = by_position.get(pos, [])
        for band_name, lo, hi in bands:
            candidates = [
                p for p in players
                if p["market_value_eur"] and lo <= p["market_value_eur"] <= hi and p["level"] >= 80
            ]
            if len(candidates) < 4:
                continue
            random.shuffle(candidates[:12])
            group = sorted(candidates[:4], key=lambda x: -(x["level"] or 0))
            clusters.append((
                "transfer",
                f"Budget constraint — {band_name} for a {pos}",
                group
            ))
            if len(clusters) >= 20:
                return clusters
    return clusters


def arch_archetype_battle() -> list[tuple[str, str, list[dict]]]:
    """Different archetypes at same position — what style do you want?"""
    clusters = []
    for pos in ["CF", "AM", "WF", "CM", "CD", "WD", "DM", "GK"]:
        players = by_position.get(pos, [])
        by_arch: dict[str, list[dict]] = defaultdict(list)
        for p in players:
            arch = p["earned_archetype"]
            if arch and p["level"] >= 82:
                by_arch[arch].append(p)
        archetypes = [a for a, ps in by_arch.items() if ps]
        if len(archetypes) < 3:
            continue
        # Pick one top player per archetype
        random.shuffle(archetypes)
        for i in range(0, len(archetypes) - 3, 4):
            chosen_archs = archetypes[i:i+4]
            if len(chosen_archs) < 4:
                continue
            group = [by_arch[a][0] for a in chosen_archs]  # top player per archetype
            clusters.append((
                "scouting",
                f"Archetype battle at {pos} — different player types, same position",
                group
            ))
            if len(clusters) >= 25:
                return clusters
    return clusters


def arch_youth_vs_experience() -> list[tuple[str, str, list[dict]]]:
    """Young prospect vs proven veteran."""
    clusters = []
    for pos in ["CF", "AM", "WF", "CM", "CD", "WD", "DM", "GK"]:
        players = by_position.get(pos, [])
        young = [p for p in players if player_age(p) and player_age(p) <= 22 and p["level"] >= 78]
        old = [p for p in players if player_age(p) and player_age(p) >= 30 and p["level"] >= 82]
        if len(young) < 2 or len(old) < 2:
            continue
        random.shuffle(young[:8])
        random.shuffle(old[:8])
        for i in range(min(3, len(young) // 2, len(old) // 2)):
            group = young[i*2:i*2+2] + old[i*2:i*2+2]
            clusters.append((
                "academy",
                f"Youth vs experience at {pos} — raw talent or proven quality?",
                group
            ))
            if len(clusters) >= 20:
                return clusters
    return clusters


def arch_personality_clash() -> list[tuple[str, str, list[dict]]]:
    """Contrasting personalities at same position."""
    clusters = []
    for pos in ["CF", "CM", "CD", "AM", "WF", "WD", "DM"]:
        players = by_position.get(pos, [])
        candidates = [p for p in players if p["personality_type"] and len(p["personality_type"]) >= 4 and p["level"] >= 82]
        if len(candidates) < 4:
            continue
        # Group by full personality type for diverse picks
        by_type: dict[str, list[dict]] = defaultdict(list)
        for p in candidates:
            by_type[p["personality_type"]].append(p)
        # Pick one player per distinct personality type
        type_reps = [(t, ps[0]) for t, ps in by_type.items() if ps]
        random.shuffle(type_reps)
        for i in range(0, len(type_reps) - 3, 4):
            group = [rep for _, rep in type_reps[i:i+4]]
            if len(group) >= 4:
                clusters.append((
                    "dressing-room",
                    f"Personality clash at {pos} — who fits your dressing room?",
                    group
                ))
                if len(clusters) >= 15:
                    return clusters
    return clusters


def arch_stat_anomaly() -> list[tuple[str, str, list[dict]]]:
    """Players with one elite pillar and one weak one."""
    clusters = []
    candidates = []
    for p in all_players:
        if p["level"] and p["level"] >= 80 and p["position"]:
            pillars = [p["technical_score"] or 0, p["tactical_score"] or 0,
                       p["mental_score"] or 0, p["physical_score"] or 0]
            if max(pillars) >= 75 and min(pillars) <= 45:
                p["_pillar_gap"] = max(pillars) - min(pillars)
                candidates.append(p)

    # Group by position
    by_pos = defaultdict(list)
    for p in candidates:
        by_pos[p["position"]].append(p)

    for pos, players in by_pos.items():
        if len(players) < 4:
            continue
        players.sort(key=lambda x: -x["_pillar_gap"])
        for i in range(0, len(players) - 3, 4):
            group = players[i:i+4]
            clusters.append((
                "scouting",
                f"Stat anomaly — players with extreme strengths and weaknesses at {pos}",
                group
            ))
            if len(clusters) >= 15:
                return clusters
    return clusters


def arch_domestic_vs_import() -> list[tuple[str, str, list[dict]]]:
    """Home-grown vs foreign player."""
    clusters = []
    for pos in ["CF", "CM", "CD", "WF", "WD"]:
        players = by_position.get(pos, [])
        hg = [p for p in players if p["hg"] and p["level"] >= 82]
        foreign = [p for p in players if not p["hg"] and p["level"] >= 82]
        if len(hg) < 2 or len(foreign) < 2:
            continue
        random.shuffle(hg[:8])
        random.shuffle(foreign[:8])
        for i in range(min(3, len(hg) // 2, len(foreign) // 2)):
            group = hg[i*2:i*2+2] + foreign[i*2:i*2+2]
            clusters.append((
                "international",
                f"Domestic vs import at {pos} — home-grown talent or global market?",
                group
            ))
            if len(clusters) >= 15:
                return clusters
    return clusters


def arch_league_jump() -> list[tuple[str, str, list[dict]]]:
    """Players from non-top-5 leagues — worth the gamble?"""
    clusters = []
    non_top5 = [p for p in all_players if p["league_name"] and p["league_name"] not in TOP5_LEAGUES and p["level"] >= 80]
    by_pos = defaultdict(list)
    for p in non_top5:
        if p["position"]:
            by_pos[p["position"]].append(p)
    for pos, players in by_pos.items():
        if len(players) < 4:
            continue
        random.shuffle(players[:12])
        for i in range(0, len(players) - 3, 4):
            group = players[i:i+4]
            clusters.append((
                "scouting",
                f"League jump — {pos}s from outside the top 5 leagues, worth the gamble?",
                group
            ))
            if len(clusters) >= 15:
                return clusters
    return clusters


def arch_dream_xi() -> list[tuple[str, str, list[dict]]]:
    """All-time greats at same position."""
    clusters = []
    for pos in ["CF", "AM", "WF", "CM", "CD", "WD", "DM", "GK"]:
        players = by_position.get(pos, [])
        legends = [p for p in players if p["level"] and p["level"] >= 86]
        if len(legends) < 4:
            continue
        random.shuffle(legends[:12])
        for i in range(0, len(legends) - 3, 4):
            group = sorted(legends[i:i+4], key=lambda x: -(x["level"] or 0))
            clusters.append((
                "dream-xi",
                f"Dream XI — best {pos} of the current generation",
                group
            ))
            if len(clusters) >= 20:
                return clusters
    return clusters


ARCHETYPES = {
    "free_agent": arch_free_agent,
    "replacement": arch_replacement,
    "budget": arch_budget,
    "archetype_battle": arch_archetype_battle,
    "youth_vs_experience": arch_youth_vs_experience,
    "personality_clash": arch_personality_clash,
    "stat_anomaly": arch_stat_anomaly,
    "domestic_vs_import": arch_domestic_vs_import,
    "league_jump": arch_league_jump,
    "dream_xi": arch_dream_xi,
}

# ── LLM Prompt ────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You write engaging second-person scenario questions for "Gaffer" — a football manager identity game where each answer reveals your managerial philosophy.

RULES:
- Write in present tense, second person ("You're...", "Your...")
- Pub-chat energy — make the reader FEEL the dilemma, not just read it
- The question must be a genuine dilemma with no obvious "correct" answer
- Every option should be defensible — if one is clearly best, the question fails
- Subtitles give brief context (1 line max, can be null)
- Use the player data to make the question specific and grounded — reference real stats, clubs, ages, contract situations
- Don't just list names — frame a SCENARIO that makes the choice meaningful

DIMENSION WEIGHTS (-15 to +15):
Each option gets weights that map it to 7 identity dimensions:
  flair_vs_function: positive = skillful creative play, negative = efficient results-oriented
  youth_vs_experience: positive = backing young talent, negative = trusting proven veterans
  attack_vs_defense: positive = prioritising goals, negative = prioritising solidity
  loyalty_vs_ambition: positive = one-club romance, negative = ruthless progress
  domestic_vs_global: positive = homegrown focus, negative = worldwide scouting
  stats_vs_eye_test: positive = data-driven, negative = vibes-based
  control_vs_chaos: positive = positional possession, negative = direct counter-attacking

WEIGHT RULES:
- Make weights DIFFERENTIATE the options — don't give everyone the same profile
- At least 3 dimensions should vary meaningfully across the 4 options
- Use the full -15 to +15 range — don't cluster around 0
- Weights should reflect what choosing that player SAYS about you as a manager"""


def build_batch_prompt(clusters: list[tuple[str, str, list[dict]]]) -> str:
    """Build a single prompt for a batch of question clusters."""
    parts = [f"Generate {len(clusters)} Gaffer questions from these player clusters.\n"]

    for i, (cat_slug, desc, players) in enumerate(clusters, 1):
        parts.append(f"--- CLUSTER {i} ---")
        parts.append(f"Category: {cat_slug}")
        parts.append(f"Context: {desc}")
        parts.append("Players:")
        for j, p in enumerate(players, 1):
            parts.append(f"  {j}. {build_dossier(p)}")
        parts.append("")

    parts.append("""Return a JSON array with one object per cluster:
[
  {
    "question_text": "Your scenario question here...",
    "subtitle": "Brief context line or null",
    "difficulty": 2,
    "tags": ["relevant", "tags"],
    "options": [
      {
        "player_name": "Exact Name From Above",
        "subtitle": "Brief flavor text — age, club, key stat",
        "dimension_weights": {
          "flair_vs_function": 0,
          "youth_vs_experience": 0,
          "attack_vs_defense": 0,
          "loyalty_vs_ambition": 0,
          "domestic_vs_global": 0,
          "stats_vs_eye_test": 0,
          "control_vs_chaos": 0
        }
      }
    ]
  }
]

JSON only. No markdown fences. No commentary.""")
    return "\n".join(parts)


# ── Validation ────────────────────────────────────────────────────────────────

DIMENSIONS = [
    "flair_vs_function", "youth_vs_experience", "attack_vs_defense",
    "loyalty_vs_ambition", "domestic_vs_global", "stats_vs_eye_test",
    "control_vs_chaos",
]


def validate_question(q: dict, cluster_players: list[dict]) -> tuple[bool, str]:
    """Validate an LLM-generated question. Returns (ok, reason)."""
    if not q.get("question_text"):
        return False, "missing question_text"
    if not q.get("options") or len(q["options"]) < 3:
        return False, f"need ≥ 3 options, got {len(q.get('options', []))}"

    # Check dimension weight variance
    dim_values = {d: [] for d in DIMENSIONS}
    for opt in q["options"]:
        weights = opt.get("dimension_weights", {})
        for d in DIMENSIONS:
            dim_values[d].append(weights.get(d, 0))

    varying = 0
    for d, vals in dim_values.items():
        if len(set(vals)) > 1:
            spread = max(vals) - min(vals)
            if spread >= 5:
                varying += 1

    if varying < 2:
        return False, f"only {varying} dimensions vary — needs ≥ 2"

    # Check player names match cluster
    cluster_names = {p["name"].lower() for p in cluster_players}
    for opt in q["options"]:
        name = opt.get("player_name", "").lower()
        if name not in cluster_names:
            # Try partial match
            matched = any(name in cn or cn in name for cn in cluster_names)
            if not matched:
                return False, f"player '{opt.get('player_name')}' not in cluster"

    return True, "ok"


def clamp_weights(weights: dict) -> dict:
    """Clamp all dimension weights to [-15, +15]."""
    return {d: max(-15, min(15, int(weights.get(d, 0)))) for d in DIMENSIONS}


# ── Main Loop ─────────────────────────────────────────────────────────────────

print("\n── Generating Gaffer Questions ──\n")

router = LLMRouter(verbose=True)
total_generated = 0
total_skipped = 0
total_failed = 0
missing_persons = []
category_counts = defaultdict(int)

# Collect all clusters
all_clusters = []
archetype_filter = args.archetype

for arch_name, arch_fn in ARCHETYPES.items():
    if archetype_filter and arch_name != archetype_filter:
        continue
    clusters = arch_fn()
    print(f"  {arch_name}: {len(clusters)} clusters found")
    for c in clusters:
        all_clusters.append((arch_name, *c))

random.shuffle(all_clusters)
all_clusters = all_clusters[:args.count]
print(f"\n  Total clusters to process: {len(all_clusters)}")

# Process in batches
for batch_start in range(0, len(all_clusters), BATCH_SIZE):
    batch = all_clusters[batch_start:batch_start + BATCH_SIZE]

    # Check idempotency — skip clusters whose hash already exists
    batch_filtered = []
    for arch_name, cat_slug, desc, players in batch:
        h = cluster_hash(arch_name, [p["person_id"] for p in players])
        if h in existing_hashes:
            total_skipped += 1
            continue
        batch_filtered.append((arch_name, cat_slug, desc, players))

    if not batch_filtered:
        continue

    # Build LLM prompt
    llm_clusters = [(cat_slug, desc, players) for _, cat_slug, desc, players in batch_filtered]
    prompt = build_batch_prompt(llm_clusters)

    if DRY_RUN:
        for arch_name, cat_slug, desc, players in batch_filtered:
            print(f"\n  [dry-run] {arch_name} → {cat_slug}")
            print(f"    {desc}")
            for p in players:
                age = player_age(p)
                print(f"    - {p['name']} ({p['position']}, L{p['level']}, {p['club']}, age {age})")
            total_generated += 1
            category_counts[cat_slug] += 1
        continue

    # Call LLM
    result = router.call(prompt, json_mode=True, system=SYSTEM_PROMPT, preference="quality")
    if not result or not result.parsed:
        print(f"    LLM call failed for batch starting at {batch_start}")
        total_failed += len(batch_filtered)
        continue

    questions = result.parsed
    if isinstance(questions, dict) and "questions" in questions:
        questions = questions["questions"]
    if not isinstance(questions, list):
        questions = [questions]

    # Match questions to clusters
    for idx, (arch_name, cat_slug, desc, players) in enumerate(batch_filtered):
        if idx >= len(questions):
            total_failed += 1
            continue

        q = questions[idx]
        ok, reason = validate_question(q, players)
        if not ok:
            print(f"    Validation failed ({reason}): {q.get('question_text', '?')[:60]}")
            total_failed += 1
            continue

        # Insert question
        cat_id = cat_map.get(cat_slug)
        if not cat_id:
            total_failed += 1
            continue

        h = cluster_hash(arch_name, [p["person_id"] for p in players])
        tags = list(set(["llm-generated", arch_name] + (q.get("tags") or []) + [h]))
        difficulty = max(1, min(3, q.get("difficulty", 2)))

        try:
            cur.execute("""
                INSERT INTO fc_questions (category_id, question_text, subtitle, option_count,
                                          difficulty, tags, tier, pick_count)
                VALUES (%s, %s, %s, %s, %s, %s, 2, 1)
                RETURNING id
            """, (
                cat_id, q["question_text"], q.get("subtitle"),
                len(q["options"]), difficulty, tags
            ))
            q_id = cur.fetchone()[0]

            for i, opt in enumerate(q["options"]):
                pid = find_person(opt.get("player_name", ""))
                if not pid:
                    missing_persons.append(opt.get("player_name", "?"))
                weights = clamp_weights(opt.get("dimension_weights", {}))
                cur.execute("""
                    INSERT INTO fc_options (question_id, person_id, label, subtitle,
                                            sort_order, dimension_weights)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (q_id, pid, opt.get("player_name", "?"), opt.get("subtitle"),
                      i, json.dumps(weights)))

            conn.commit()
            total_generated += 1
            category_counts[cat_slug] += 1
            existing_hashes.add(h)
            print(f"    ✓ {q['question_text'][:70]}")

        except Exception as e:
            conn.rollback()
            print(f"    DB error: {e}")
            total_failed += 1
            continue

    # Rate limit courtesy
    time.sleep(1)

# ── Summary ───────────────────────────────────────────────────────────────────

print(f"\n── Summary ──")
print(f"  Generated: {total_generated}")
print(f"  Skipped (existing): {total_skipped}")
print(f"  Failed: {total_failed}")
if category_counts:
    print(f"  By category:")
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"    {cat}: {count}")
if missing_persons:
    unique_missing = sorted(set(missing_persons))
    print(f"  Missing persons ({len(unique_missing)}): {', '.join(unique_missing[:15])}")
if DRY_RUN:
    print("  (dry-run — no data was written)")
else:
    router.print_stats()

cur.close()
conn.close()
