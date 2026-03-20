"""
82_kc_bios.py — Generate humorous bios, tags, and attributes for KC fake players.

Uses Gemini Flash to create tongue-in-cheek, slightly surreal character bios
for each fake player. Derives tags and attribute profiles from the bios.

Input:  pipeline/.cache/kc_players_full.json
Output: pipeline/.cache/kc_characters.json → also copied to apps/web/public/data/

Usage:
    python pipeline/82_kc_bios.py [--dry-run] [--limit N] [--resume]
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from config import CACHE_DIR

CACHE_DIR.mkdir(parents=True, exist_ok=True)
INPUT_PATH = CACHE_DIR / "kc_players_full.json"
OUTPUT_PATH = CACHE_DIR / "kc_characters.json"

DRY_RUN = "--dry-run" in sys.argv
RESUME = "--resume" in sys.argv
LIMIT = None
for i, arg in enumerate(sys.argv):
    if arg == "--limit" and i + 1 < len(sys.argv):
        LIMIT = int(sys.argv[i + 1])

from lib.llm_router import LLMRouter

BATCH_SIZE = 20  # players per LLM call

SYSTEM_PROMPT = """You are writing character bios for a comedic football card game called Kickoff Clash.
Every player is fictional. The tone is:
- Tongue-in-cheek, like a pub football conversation
- Slightly surreal — odd hobbies, bizarre training routines, improbable backstories
- Self-aware about football clichés — lean into them, then twist them
- Short and punchy — 2-3 sentences max per bio
- Mix genuine football insight with absurdist humour

For each player, generate:
1. "bio": A 2-3 sentence humorous character description
2. "tags": 2-4 comedic tags (e.g., "Sunday League Legend", "Injury Magnet", "Kit Collector", "Offside Trap Survivor", "Pre-Match Napper", "Chipped the Keeper Once", "Slide Tackle Enthusiast")
3. "strengths": 2-3 word phrases for what they're good at (based on their model/position)
4. "weaknesses": 1-2 word phrases for comedic flaws
5. "quirk": One absurd detail (e.g., "Refuses to head the ball on Tuesdays", "Only scores bangers", "Celebrates every throw-in")

Return ONLY a JSON array. No markdown, no code blocks, no explanation."""

USER_TEMPLATE = """Generate bios for these {count} fictional football players:

{players}

Return a JSON array of {count} objects with keys: name, bio, tags, strengths, weaknesses, quirk"""


def format_player_for_prompt(p: dict) -> str:
    parts = [f"Name: {p['name']}"]
    if p.get("nation"):
        parts.append(f"Nation: {p['nation']}")
    if p.get("position"):
        parts.append(f"Position: {p['position']}")
    if p.get("model"):
        parts.append(f"Playing Style: {p['model']}")
    if p.get("primary"):
        parts.append(f"Primary Class: {p['primary']}")
    if p.get("character"):
        parts.append(f"Character: {p['character']}")
    if p.get("physique"):
        parts.append(f"Physique: {p['physique']}")
    if p.get("level"):
        parts.append(f"Level: {p['level']}")
    return " | ".join(parts)


def main():
    router = LLMRouter(verbose=True)
    if not router.available_providers():
        print("ERROR: No LLM providers configured (need GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY)")
        sys.exit(1)
    print(f"LLM providers: {', '.join(router.available_providers())}")

    if not INPUT_PATH.exists():
        print(f"ERROR: {INPUT_PATH} not found. Run 81_airtable_kc_ingest.py first")
        sys.exit(1)

    with open(INPUT_PATH) as f:
        players = json.load(f)

    print(f"Loaded {len(players)} fake players")

    # Load existing results if resuming
    existing: dict[str, dict] = {}
    if RESUME and OUTPUT_PATH.exists():
        with open(OUTPUT_PATH) as f:
            for c in json.load(f):
                existing[c["name"]] = c
        print(f"Resuming: {len(existing)} already processed")

    if LIMIT:
        players = players[:LIMIT]

    # Filter out already-processed
    to_process = [p for p in players if p["name"] not in existing]
    print(f"To process: {len(to_process)} players")

    if DRY_RUN:
        print(f"\n[DRY RUN] Would process {len(to_process)} in batches of {BATCH_SIZE}")
        print(f"Sample prompt for first batch:")
        batch = to_process[:BATCH_SIZE]
        player_lines = "\n".join(f"  {i+1}. {format_player_for_prompt(p)}" for i, p in enumerate(batch))
        print(USER_TEMPLATE.format(count=len(batch), players=player_lines))
        return

    results = list(existing.values())
    processed = 0
    errors = 0

    for batch_start in range(0, len(to_process), BATCH_SIZE):
        batch = to_process[batch_start:batch_start + BATCH_SIZE]
        player_lines = "\n".join(
            f"  {i+1}. {format_player_for_prompt(p)}" for i, p in enumerate(batch)
        )
        prompt = USER_TEMPLATE.format(count=len(batch), players=player_lines)

        batch_num = batch_start // BATCH_SIZE + 1
        print(f"  Batch {batch_num}/{(len(to_process) + BATCH_SIZE - 1) // BATCH_SIZE}: {len(batch)} players...", end=" ", flush=True)

        full_prompt = SYSTEM_PROMPT + "\n\n" + prompt
        result = router.call(full_prompt, json_mode=True)

        if not result or not result.parsed:
            print("FAILED")
            errors += len(batch)
            continue

        try:
            bios = result.parsed
            # Groq wraps in {"players": [...]} — unwrap
            if isinstance(bios, dict):
                for key in ("players", "bios", "characters", "results"):
                    if key in bios and isinstance(bios[key], list):
                        bios = bios[key]
                        break
            if not isinstance(bios, list):
                raise ValueError(f"Expected list, got {type(bios).__name__}")

            # Match bios to players by order
            for i, bio_data in enumerate(bios):
                if i >= len(batch):
                    break
                p = batch[i]
                char = {
                    "name": p["name"],
                    "nation": p.get("nation"),
                    "position": p.get("position"),
                    "model": p.get("model"),
                    "primary": p.get("primary"),
                    "secondary": p.get("secondary"),
                    "level": p.get("level"),
                    "character": p.get("character"),
                    "physique": p.get("physique"),
                    "bio": bio_data.get("bio", ""),
                    "tags": bio_data.get("tags", []),
                    "strengths": bio_data.get("strengths", []),
                    "weaknesses": bio_data.get("weaknesses", []),
                    "quirk": bio_data.get("quirk", ""),
                }
                results.append(char)
                processed += 1

            print(f"OK ({len(bios)} bios) [{result.provider}]")

        except (json.JSONDecodeError, ValueError) as e:
            print(f"PARSE ERROR: {e}")
            errors += len(batch)

        # Save progress every 5 batches
        if (batch_start // BATCH_SIZE + 1) % 5 == 0:
            with open(OUTPUT_PATH, "w") as f:
                json.dump(results, f, indent=2, ensure_ascii=False)

        time.sleep(2)  # rate limit courtesy

    # Final save
    with open(OUTPUT_PATH, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    router.print_stats()
    print(f"\nDone: {processed} bios generated, {errors} errors")
    print(f"Total characters: {len(results)}")
    print(f"Wrote to {OUTPUT_PATH}")

    # Copy to web app
    web_data = Path("apps/web/public/data")
    if web_data.exists():
        out = web_data / "kc_characters.json"
        with open(out, "w") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"Copied to {out}")

    # Sample output
    print("\n── Sample bios ──")
    for c in results[:5]:
        print(f"\n{c['name']} ({c.get('position','?')} / {c.get('model','?')})")
        print(f"  Bio: {c['bio']}")
        print(f"  Tags: {c['tags']}")
        print(f"  Quirk: {c['quirk']}")


if __name__ == "__main__":
    main()
