"""
31_wikipedia_style.py — Parse Wikipedia "Style of play" sections into style tags.

Fetches Wikipedia articles for players with wikipedia_url, extracts the
"Style of play" / "Playing style" section, sends to LLM router (Groq →
Gemini → Anthropic fallback) to extract style descriptors, creates new
tags as needed, then writes to player_tags.

Usage:
    python 31_wikipedia_style.py                  # full run (players with level data first)
    python 31_wikipedia_style.py --dry-run        # preview, no writes
    python 31_wikipedia_style.py --player 13466   # single player by person_id
    python 31_wikipedia_style.py --limit 50       # process N players
    python 31_wikipedia_style.py --force          # re-process even if already tagged
"""
import argparse
import json
import re
import sys
import time
import urllib.request
import urllib.parse
from typing import Optional

import psycopg2

from config import POSTGRES_DSN
from lib.llm_router import LLMRouter

# ── CLI args ──────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Parse Wikipedia style of play into tags")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
parser.add_argument("--player", type=int, help="Process a single player by person_id")
parser.add_argument("--limit", type=int, default=200, help="Max players to process (default 200)")
parser.add_argument("--force", action="store_true", help="Re-process players who already have style tags")
args = parser.parse_args()

DRY_RUN = args.dry_run

if not POSTGRES_DSN:
    print("ERROR: POSTGRES_DSN not set")
    sys.exit(1)

conn = psycopg2.connect(POSTGRES_DSN)
conn.autocommit = True
cur = conn.cursor()

# ── Init LLM router ─────────────────────────────────────────────────────────

router = LLMRouter(verbose=True)
print(f"LLM providers available: {router.available_providers()}")

if not router.available_providers():
    print("ERROR: No LLM providers configured. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY")
    sys.exit(1)

# ── Load existing style tags ─────────────────────────────────────────────────

cur.execute("SELECT id, tag_name FROM tags WHERE category = 'style' ORDER BY id")
style_tags: dict[str, int] = {row[1]: row[0] for row in cur.fetchall()}
print(f"Existing style tags: {len(style_tags)} ({', '.join(style_tags.keys())})")


BLOCKED_TAGS = {
    "Attacking Midfielder", "Central Defender", "Central Midfield",
    "Defensive Midfielder", "Midfielder", "Offensive Full Back",
    "Winger", "Second Striker", "Young Talent", "Special Player",
    "Left Footed", "Right Footed", "Offensive Minded", "Tall",
    "Low Injury Prone", "Imposing Figure", "Strong", "Pacey",
}

# Map LLM synonyms to canonical tag names to prevent duplicate creation
TAG_ALIASES: dict[str, str] = {
    "Counter Attack": "Counter-Attack", "Counterattack": "Counter-Attack",
    "Box-To-Box": "Box-to-Box",
    "Mental Composure": "Composure", "Calmness Under Pressure": "Composure",
    "Confidence": "Composure",
    "Decision Making": "Tactical Intelligence", "Good Decision Making": "Tactical Intelligence",
    "Precise Decision Making": "Tactical Intelligence", "Intelligence": "Tactical Intelligence",
    "Game Reading": "Game Intelligence",
    "Creative Player": "Vision", "Creativity": "Vision",
    "Hard Working": "Work Rate", "Hardworking": "Work Rate", "Energetic": "Work Rate",
    "Defensive Work Rate": "Work Rate", "Stamina": "Work Rate",
    "Eye For Goal": "Finishing", "Clinical Finishing": "Finishing",
    "Composed Finishing": "Finishing",
    "Pressing Ability": "High Press", "Counter Press": "High Press",
    "Free Kick Specialist": "Set Piece Threat", "Set Piece Specialist": "Set Piece Threat",
    "Movement Off Ball": "Movement", "Intelligent Movement": "Movement",
    "Clever Movement": "Movement",
    "Direct Style": "Direct", "Dynamic Play": "Direct",
    "Strong Positional Sense": "Positioning", "Positional Sense": "Positioning",
    "Intelligent Positioning": "Positioning", "Positional Awareness": "Positioning",
    "Defensive Positioning": "Defensive Awareness", "Interception": "Defensive Awareness",
    "Lightning Reflexes": "Reflexes", "Quick Reflexes": "Reflexes",
    "Elite Shot Stopper": "Shot Stopping", "Shot Stopper": "Shot Stopping",
    "Physical Strength": "Strength", "Physical Power": "Strength",
    "Strong Frame": "Strength", "Physical Ability": "Strength",
    "Adaptability": "Versatility", "Tactical Versatility": "Versatility",
    "Playmaking": "Playmaker",
    "Vocal Leader": "Leadership", "Commanding Presence": "Leadership",
    "Strong Personality": "Leadership",
    "Winner": "Big Game Player", "Mentality": "Big Game Player",
    "Ball Winning": "Ball Winner", "Strong Tackler": "Tackling Ability",
    "Tackling": "Tackling Ability",
    "Aggressive": "Aggressive Defender",
    "Excellent Technique": "Technical Ability", "Technically Gifted": "Technical Ability",
    "Accurate Passing": "Passing Ability", "Precise Passing": "Passing Ability",
    "Clever Passing": "Passing Ability", "Penetrating Passes": "Passing Ability",
    "Long Pass Accuracy": "Long Range Passing",
    "Explosive Pace": "Pace", "Explosive Speed": "Pace", "Speed": "Pace",
    "Quick": "Pace", "Pacey": "Pace",
    "Agile Dribbling": "Dribbling", "Skilled Dribbling": "Dribbling",
    "Aerial Dominance": "Aerial Ability",
    "Physicality": "Strength",
    "Ball Winning Ability": "Ball Winner",
    "Precise Decision-Making": "Tactical Intelligence",
    "Technique": "Technical Ability",
    "Attacking Intelligence": "Vision", "Creativity": "Vision",
    "Intelligent Attacking Runs": "Movement",
    "Elegant Play": "Technical Ability",
    "Change Of Pace": "Acceleration",
    "Communication": "Leadership", "Authority": "Leadership",
    "Commanding Presence": "Leadership",
    "Explosive Speed": "Pace",
    "Intelligent Movement": "Movement",
}


def get_or_create_tag(tag_name: str) -> Optional[int]:
    """Get existing tag ID or create a new style tag. Returns None for blocked tags."""
    tag_name = tag_name.strip().title()

    if tag_name in BLOCKED_TAGS:
        return None

    # Resolve aliases to canonical names
    tag_name = TAG_ALIASES.get(tag_name, tag_name)

    if tag_name in style_tags:
        return style_tags[tag_name]

    if not DRY_RUN:
        cur.execute("""
            INSERT INTO tags (tag_name, category, is_scout_only)
            VALUES (%s, 'style', false)
            ON CONFLICT (tag_name) DO UPDATE SET category = 'style'
            RETURNING id
        """, (tag_name,))
        tag_id = cur.fetchone()[0]
    else:
        tag_id = -1

    style_tags[tag_name] = tag_id
    print(f"    NEW TAG: {tag_name} (id={tag_id})")
    return tag_id


# ── Find players to process ──────────────────────────────────────────────────

print("\nFinding players with Wikipedia URLs...")

if args.player:
    cur.execute("""
        SELECT p.id, p.name, p.wikipedia_url
        FROM people p
        WHERE p.id = %s AND p.wikipedia_url IS NOT NULL AND p.wikipedia_url <> ''
    """, (args.player,))
else:
    if args.force:
        cur.execute("""
            SELECT p.id, p.name, p.wikipedia_url
            FROM people p
            JOIN player_profiles pp ON pp.person_id = p.id
            WHERE p.wikipedia_url IS NOT NULL AND p.wikipedia_url <> ''
              AND pp.level IS NOT NULL
            ORDER BY pp.level DESC
            LIMIT %s
        """, (args.limit,))
    else:
        cur.execute("""
            SELECT p.id, p.name, p.wikipedia_url
            FROM people p
            JOIN player_profiles pp ON pp.person_id = p.id
            WHERE p.wikipedia_url IS NOT NULL AND p.wikipedia_url <> ''
              AND pp.level IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM player_tags pt
                  JOIN tags t ON t.id = pt.tag_id
                  WHERE pt.player_id = p.id AND t.category = 'style'
              )
            ORDER BY pp.level DESC
            LIMIT %s
        """, (args.limit,))

players = cur.fetchall()
print(f"  {len(players)} players to process")

if not players:
    print("Nothing to do.")
    cur.close()
    conn.close()
    sys.exit(0)


# ── Wikipedia fetch ──────────────────────────────────────────────────────────

STYLE_SECTION_NAMES = {
    "style of play", "playing style", "style", "playing style and reception",
    "style of play and reception", "playing career and style",
}


def wiki_api(params: dict) -> Optional[dict]:
    """Call Wikipedia API."""
    base = "https://en.wikipedia.org/w/api.php"
    url = f"{base}?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "ChiefScout/1.0 (football scouting research)"
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def get_wikipedia_style_section(url: str) -> Optional[str]:
    """Fetch Wikipedia article and extract the Style of play section."""
    match = re.search(r"wikipedia\.org/wiki/(.+?)(?:#|\?|$)", url)
    if not match:
        return None

    title = match.group(1)

    data = wiki_api({
        "action": "parse", "page": title, "prop": "sections", "format": "json"
    })
    if not data or "error" in data:
        return None

    sections = data.get("parse", {}).get("sections", [])
    style_idx = None
    for sec in sections:
        sec_title = sec.get("line", "").lower().strip()
        if sec_title in STYLE_SECTION_NAMES:
            style_idx = sec["index"]
            break

    if style_idx is None:
        return None

    data2 = wiki_api({
        "action": "parse", "page": title, "prop": "wikitext",
        "section": style_idx, "format": "json"
    })
    if not data2:
        return None

    wikitext = data2.get("parse", {}).get("wikitext", {}).get("*", "")
    if not wikitext:
        return None

    # Strip wiki markup to plain text
    text = re.sub(r"\[\[([^|\]]*\|)?([^\]]*)\]\]", r"\2", wikitext)
    text = re.sub(r"\{\{[^}]*\}\}", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.DOTALL)
    text = re.sub(r"<ref[^/]*/?>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"'{2,}", "", text)
    text = re.sub(r"={2,}[^=]+={2,}", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = text.strip()

    if len(text) < 50:
        return None

    return text[:4000]


# ── LLM prompt ───────────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""You are an elite football scout building a scouting intelligence database.
Given a Wikipedia "Style of play" section, extract the DEFINING style traits for this player.
These tags define what the player is KNOWN FOR — their identity, not a list of everything mentioned.

CRITICAL — read the text carefully:
- Only tag traits the player is KNOWN FOR or DEFINED BY, not things mentioned in passing
- "Despite not being tall" does NOT mean tag Aerial Ability — it means the opposite
- "In his earlier years he was fast" does NOT mean tag Pace — that's a past trait
- "Can play on the counter" is NOT the same as "known for counter-attacking" — only tag defining traits
- Qualifiers like "despite", "although", "not known for", "lacks" mean DO NOT tag that trait
- If the text says a trait has declined, do NOT tag it unless the player adapted (tag the adaptation instead)
- Physical traits should only be tagged if they are a CURRENT defining feature, not a historical one

Existing tags (use these EXACTLY when they match — do NOT create synonyms):
{', '.join(sorted(style_tags.keys()))}

Rules:
- Return a JSON array of tag name strings, e.g. ["Playmaker", "Set Piece Threat", "Vision"]
- Each tag should be 1-3 words, Title Case
- MUST use existing tag names when they match — do not invent synonyms
- Only create a new tag if NO existing tag covers the trait
- Tag technical, tactical, physical (current), and mental traits
- Include negative traits if clearly stated (e.g. "Injury Prone", "Error Prone")
- Do NOT tag positions (Winger, Midfielder, Striker, etc.)
- Do NOT tag physical descriptions (Tall, Left Footed, Imposing)
- Aim for 8-12 tags. Quality over quantity — every tag must be defensible
- Return ONLY the JSON array, nothing else"""


def classify_style(player_name: str, style_text: str) -> list[str]:
    """Use LLM router to extract style tags from text."""
    prompt = f"Player: {player_name}\n\nStyle of play:\n{style_text}"

    result = router.call(
        prompt,
        json_mode=True,
        system=SYSTEM_PROMPT,
        preference="fast",
    )

    if not result or not result.parsed:
        return []

    # Handle both flat array ["tag1", "tag2"] and wrapped {"styles": ["tag1"]}
    data = result.parsed
    if isinstance(data, dict):
        # Find the first list value in the dict
        for v in data.values():
            if isinstance(v, list):
                data = v
                break
        else:
            return []

    if isinstance(data, list):
        return [t.strip().title() for t in data if isinstance(t, str) and len(t) > 1][:12]

    return []


# ── Main loop ────────────────────────────────────────────────────────────────

print(f"\nProcessing {len(players)} players...\n")

total_tagged = 0
no_section = 0
no_tags = 0
new_tags_created = 0

for i, (person_id, name, wiki_url) in enumerate(players):
    print(f"[{i+1}/{len(players)}] {name}...", end=" ", flush=True)

    style_text = get_wikipedia_style_section(wiki_url)
    if not style_text:
        print("no style section")
        no_section += 1
        continue

    tags = classify_style(name, style_text)
    if not tags:
        print("no matching tags")
        no_tags += 1
        continue

    # Get or create tag IDs
    tag_ids = []
    for tag_name in tags:
        old_count = len(style_tags)
        tag_id = get_or_create_tag(tag_name)
        if tag_id is None:
            continue
        if len(style_tags) > old_count:
            new_tags_created += 1
        tag_ids.append((tag_name, tag_id))

    print(f"-> {', '.join(t[0] for t in tag_ids)}")

    if not DRY_RUN:
        # On --force, replace old style tags with new ones (delete stale, add fresh)
        if args.force:
            new_tag_ids = {t[1] for t in tag_ids}
            cur.execute("""
                DELETE FROM player_tags
                WHERE player_id = %s AND tag_id IN (
                    SELECT id FROM tags WHERE category = 'style'
                ) AND tag_id != ALL(%s)
            """, (person_id, list(new_tag_ids)))

        for tag_name, tag_id in tag_ids:
            cur.execute("""
                INSERT INTO player_tags (player_id, tag_id)
                VALUES (%s, %s)
                ON CONFLICT (player_id, tag_id) DO NOTHING
            """, (person_id, tag_id))

    total_tagged += 1

    # Small delay to respect Wikipedia rate limits
    time.sleep(1)

# ── Summary ──────────────────────────────────────────────────────────────────

print(f"\n=== Summary ===")
print(f"  Processed:        {len(players)}")
print(f"  Tagged:           {total_tagged}")
print(f"  No style section: {no_section}")
print(f"  No matching tags: {no_tags}")
print(f"  New tags created: {new_tags_created}")
print(f"  Total style tags: {len(style_tags)}")
if DRY_RUN:
    print("  ** DRY RUN — no data written **")

router.print_stats()

cur.close()
conn.close()
print("\nDone.")
