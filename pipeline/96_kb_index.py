"""
96_kb_index.py — Rebuild Knowledge Base indexes.

Scans kb/ articles, extracts frontmatter, and generates:
- INDEX.md (master index with category overview, recent updates, stale detection)
- Per-category _index.md files with article listings and cross-references

Can run independently of 95_compile_kb.py (e.g. after manual article additions).

Usage:
    python 96_kb_index.py              # rebuild all indexes
    python 96_kb_index.py --dry-run    # preview without writing
    python 96_kb_index.py --stats      # print KB statistics only
"""
from __future__ import annotations

import argparse

from lib.kb import (
    KB_ROOT, CATEGORIES,
    build_category_index, build_master_index,
    _scan_articles, extract_backlinks,
)

# ── CLI ────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Rebuild KB indexes")
parser.add_argument("--dry-run", action="store_true", help="Preview without writing files")
parser.add_argument("--stats", action="store_true", help="Print statistics only")
args = parser.parse_args()

DRY_RUN = args.dry_run


def print_stats():
    """Print KB statistics."""
    print("── KB Statistics ──────────────────────────────────────")
    total_articles = 0
    total_words = 0

    for cat in CATEGORIES:
        articles = _scan_articles(cat)
        words = sum(a.get("_words", 0) for a in articles)
        total_articles += len(articles)
        total_words += words
        print(f"  {cat:12s}  {len(articles):5d} articles  {words:8,d} words")

    print(f"  {'─' * 40}")
    print(f"  {'TOTAL':12s}  {total_articles:5d} articles  {total_words:8,d} words")

    # Backlink health
    all_slugs = set()
    broken_links = []
    for cat in CATEGORIES:
        cat_dir = KB_ROOT / cat
        if not cat_dir.exists():
            continue
        for path in cat_dir.glob("*.md"):
            if path.name.startswith("_"):
                continue
            all_slugs.add(path.stem)

    for cat in CATEGORIES:
        cat_dir = KB_ROOT / cat
        if not cat_dir.exists():
            continue
        for path in cat_dir.glob("*.md"):
            if path.name.startswith("_"):
                continue
            text = path.read_text(encoding="utf-8")
            for link in extract_backlinks(text):
                if link not in all_slugs:
                    broken_links.append((path.stem, link))

    if broken_links:
        print(f"\n  Broken backlinks: {len(broken_links)}")
        for src, target in broken_links[:10]:
            print(f"    {src} → [[{target}]] (missing)")
        if len(broken_links) > 10:
            print(f"    ... and {len(broken_links) - 10} more")
    else:
        print(f"\n  Backlink health: ✓ all links resolve")


def rebuild_indexes():
    """Rebuild all index files."""
    print("── 96  Rebuild KB Indexes ──────────────────────────────")
    print(f"  Mode: {'DRY RUN' if DRY_RUN else 'LIVE'}\n")

    # Per-category indexes
    for cat in CATEGORIES:
        cat_dir = KB_ROOT / cat
        if not cat_dir.exists():
            continue

        index_content = build_category_index(cat)
        index_path = cat_dir / "_index.md"

        articles = _scan_articles(cat)
        print(f"  {cat:12s}  {len(articles):4d} articles → _index.md")

        if not DRY_RUN:
            index_path.write_text(index_content, encoding="utf-8")

    # Master index
    master_content = build_master_index()
    master_path = KB_ROOT / "INDEX.md"
    print(f"\n  Master INDEX.md generated")

    if not DRY_RUN:
        master_path.write_text(master_content, encoding="utf-8")

    if DRY_RUN:
        print(f"\n  --- Preview: INDEX.md ---")
        print(master_content[:1000])
        print("  ...")

    print("\n── Done ───────────────────────────────────────────────")


def main():
    if args.stats:
        print_stats()
        return

    rebuild_indexes()
    print()
    print_stats()


if __name__ == "__main__":
    main()
