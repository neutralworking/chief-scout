#!/usr/bin/env python3
"""
kb_search.py — Full-text search over the Knowledge Base.

Searches kb/ articles by matching query words against titles, tags, and body text.
Returns ranked results with snippets. No external dependencies (stdlib only).

Usage:
    python pipeline/tools/kb_search.py "pressing midfielder"
    python pipeline/tools/kb_search.py "controller" --category archetypes
    python pipeline/tools/kb_search.py "arsenal" --limit 5
    python pipeline/tools/kb_search.py "xG" --json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Resolve KB root relative to this script
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
KB_ROOT = REPO_ROOT / "kb"

CATEGORIES = ["players", "archetypes", "tactics", "clubs", "concepts", "queries"]


def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Simple YAML frontmatter parser."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("---", 3)
    if end == -1:
        return {}, text
    raw = text[3:end].strip()
    body = text[end + 3:].strip()
    meta = {}
    for line in raw.split("\n"):
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, _, val = line.partition(":")
        meta[key.strip()] = val.strip().strip('"').strip("'")
    return meta, body


def extract_snippet(text: str, query_words: list[str], context: int = 100) -> str:
    """Extract a snippet around the best matching region."""
    text_lower = text.lower()
    best_pos = -1
    best_score = 0

    for i in range(0, len(text_lower) - 20, 50):
        window = text_lower[i:i + 200]
        score = sum(1 for w in query_words if w in window)
        if score > best_score:
            best_score = score
            best_pos = i

    if best_pos == -1:
        return text[:200].replace("\n", " ").strip()

    start = max(0, best_pos - 20)
    end = min(len(text), best_pos + context + 80)
    snippet = text[start:end].replace("\n", " ").strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet


def search(query: str, category: str | None = None, limit: int = 10) -> list[dict]:
    """Search KB articles. Returns list of {path, title, score, snippet}."""
    words = [w.lower() for w in re.split(r"\s+", query.strip()) if len(w) >= 2]
    if not words:
        return []

    results = []
    cats = [category] if category else CATEGORIES

    for cat in cats:
        cat_dir = KB_ROOT / cat
        if not cat_dir.exists():
            continue

        for path in cat_dir.glob("*.md"):
            if path.name.startswith("_"):
                continue

            text = path.read_text(encoding="utf-8")
            meta, body = parse_frontmatter(text)
            body_lower = body.lower()
            title = meta.get("title", path.stem)
            title_lower = title.lower()
            tags_str = meta.get("tags", "").lower()

            # Score: title match (3x), tags (2x), body (1x per occurrence, capped)
            score = 0
            for w in words:
                if w in title_lower:
                    score += 3
                if w in tags_str:
                    score += 2
                body_count = body_lower.count(w)
                score += min(body_count, 5)  # Cap body matches

            if score > 0:
                snippet = extract_snippet(body, words)
                results.append({
                    "path": str(path.relative_to(REPO_ROOT)),
                    "title": title,
                    "category": cat,
                    "score": score,
                    "snippet": snippet,
                })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]


def main():
    parser = argparse.ArgumentParser(description="Search the Knowledge Base")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--category", default=None, choices=CATEGORIES, help="Filter by category")
    parser.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    results = search(args.query, category=args.category, limit=args.limit)

    if args.json:
        print(json.dumps(results, indent=2))
        return

    if not results:
        print(f"No results for \"{args.query}\"")
        sys.exit(0)

    for r in results:
        print(f"\n=== {r['path']} (score: {r['score']}) ===")
        print(f"  {r['snippet']}")

    # Count total articles for context
    total = 0
    for cat in CATEGORIES:
        cat_dir = KB_ROOT / cat
        if cat_dir.exists():
            total += sum(1 for f in cat_dir.glob("*.md") if not f.name.startswith("_"))

    print(f"\nFound {len(results)} results for \"{args.query}\" across {total} articles.")


if __name__ == "__main__":
    main()
