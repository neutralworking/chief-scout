"""
Knowledge Base utilities — templates, slug helpers, frontmatter, index generation.

Usage:
    from lib.kb import slug, article_path, write_article, render_player_article
    from lib.kb import build_category_index, build_master_index
"""
from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from config import REPO_ROOT

KB_ROOT = REPO_ROOT / "kb"
CATEGORIES = ["players", "archetypes", "tactics", "clubs", "concepts", "queries"]

VAULT_MEN = REPO_ROOT / "docs" / "research" / "rsg.db" / "main" / "men"
VAULT_WOMEN = REPO_ROOT / "docs" / "research" / "rsg.db" / "main" / "women"
SCOUTING_DIR = REPO_ROOT / "docs" / "Scouting"
FORMATIONS_DIR = REPO_ROOT / "docs" / "formations"

# Model category groupings for archetype articles
MODEL_CATEGORIES = {
    "Mental":    ["Controller", "Commander", "Creator"],
    "Tactical":  ["Cover", "Engine", "Destroyer"],
    "Technical": ["Dribbler", "Passer", "Striker"],
    "Physical":  ["Target", "Sprinter", "Powerhouse"],
    "Specialist": ["GK"],
}


# ── Slug / Path helpers ──────────────────────────────────────────────────────

def slug(name: str) -> str:
    """Convert a name to a filename-safe slug. 'Bukayo Saka' → 'bukayo-saka'."""
    # Normalize unicode (é → e, ü → u, etc.)
    text = unicodedata.normalize("NFKD", name)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def article_path(category: str, name: str) -> Path:
    """Return kb/{category}/{slug}.md for a given article name."""
    return KB_ROOT / category / f"{slug(name)}.md"


def read_article(category: str, name: str) -> str | None:
    """Read an article if it exists, None otherwise."""
    path = article_path(category, name)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def write_article(category: str, name: str, content: str, dry_run: bool = False) -> Path:
    """Write article to disk. Creates parent dirs if needed. Returns path."""
    path = article_path(category, name)
    if dry_run:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


# ── Frontmatter ──────────────────────────────────────────────────────────────

def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Extract YAML-like frontmatter + body from markdown.

    Returns (meta_dict, body_string). If no frontmatter, meta is empty.
    Simple key: value parser — no PyYAML dependency needed.
    """
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
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        # Parse list values: [a, b, c]
        if val.startswith("[") and val.endswith("]"):
            val = [v.strip().strip('"').strip("'") for v in val[1:-1].split(",") if v.strip()]
        meta[key] = val

    return meta, body


def make_frontmatter(meta: dict) -> str:
    """Generate YAML frontmatter string from a dict."""
    lines = ["---"]
    for key, val in meta.items():
        if isinstance(val, list):
            items = ", ".join(str(v) for v in val)
            lines.append(f"{key}: [{items}]")
        else:
            lines.append(f"{key}: {val}")
    lines.append("---")
    return "\n".join(lines)


# ── Templates ────────────────────────────────────────────────────────────────

def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _grade_bar(score: float, max_score: float = 10) -> str:
    """Visual bar: ████████░░ 8/10"""
    filled = round(score)
    empty = round(max_score) - filled
    return f"{'█' * filled}{'░' * empty} {score:.0f}/{max_score:.0f}"


def render_player_article(
    player: dict,
    grades: list[dict],
    traits: list[dict],
    personality: dict | None,
    narrative: str | None = None,
    scouting_note: str | None = None,
    synthesis: str | None = None,
) -> str:
    """Render a player KB article from structured data.

    Args:
        player: Dict with keys from people + player_profiles + player_status + player_market.
        grades: List of {attribute, scout_grade, stat_score} dicts.
        traits: List of {trait, category, severity} dicts.
        personality: Dict with ei, sn, tf, jp scores or None.
        narrative: Raw text from rsg.db vault file.
        scouting_note: Text from docs/Scouting/ or player_status.scouting_notes.
        synthesis: Optional LLM-generated synthesis paragraph.
    """
    name = player.get("name", "Unknown")
    position = player.get("position", "—")
    club_name = player.get("club_name", "—")
    nation_name = player.get("nation_name", "—")
    age = player.get("age", "—")
    archetype = player.get("archetype", "—")
    model_id = player.get("model_id", "")
    level = player.get("level", "—")
    overall = player.get("overall", "—")
    pursuit = player.get("pursuit_status", "—")
    mvt = player.get("market_value_tier", "—")

    # Build tags for frontmatter
    tags = [t for t in [position, club_name, nation_name, archetype] if t and t != "—"]

    meta = {
        "title": name,
        "category": "players",
        "tags": tags,
        "updated": _today(),
        "source": "compiled",
        "confidence": "high" if grades else "low",
        "summary": f"{position} at {club_name}. Archetype: {archetype}.",
    }
    if player.get("id"):
        meta["person_id"] = player["id"]

    # Backlinks
    backlinks = []
    if archetype and archetype != "—":
        primary = archetype.split("-")[0].lower() if "-" in archetype else archetype.lower()
        backlinks.append(primary)
    if club_name and club_name != "—":
        backlinks.append(slug(club_name))
    if backlinks:
        meta["backlinks"] = backlinks

    sections = [make_frontmatter(meta), f"\n# {name}\n"]

    # Overview table
    sections.append("## Overview\n")
    sections.append("| Field | Value |")
    sections.append("|---|---|")
    sections.append(f"| **Position** | {position} |")
    sections.append(f"| **Club** | {club_name} |")
    sections.append(f"| **Nation** | {nation_name} |")
    sections.append(f"| **Age** | {age} |")
    sections.append(f"| **Archetype** | [[{slug(archetype.split('-')[0]) if archetype and '-' in archetype else slug(archetype) if archetype else '—'}]] {archetype} |")
    sections.append(f"| **Level** | {level} |")
    sections.append(f"| **Overall** | {overall} |")
    sections.append(f"| **Pursuit** | {pursuit} |")
    sections.append(f"| **Market Value Tier** | {mvt} |")

    # Synthesis
    if synthesis:
        sections.append(f"\n## Scout Summary\n\n{synthesis}")
    elif scouting_note:
        sections.append(f"\n## Scouting Notes\n\n{scouting_note}")

    # Top grades
    if grades:
        sections.append("\n## Attribute Grades\n")
        # Sort by best score descending
        sorted_grades = sorted(grades, key=lambda g: g.get("scout_grade") or g.get("stat_score") or 0, reverse=True)
        sections.append("| Attribute | Grade |")
        sections.append("|---|---|")
        for g in sorted_grades[:15]:
            score = g.get("scout_grade") or g.get("stat_score") or 0
            attr = g.get("attribute", "?").replace("_", " ").title()
            sections.append(f"| {attr} | {_grade_bar(score)} |")

    # Traits
    if traits:
        sections.append("\n## Traits\n")
        for t in sorted(traits, key=lambda x: x.get("severity", 0), reverse=True):
            severity = t.get("severity", "?")
            sections.append(f"- **{t.get('trait', '?')}** ({t.get('category', '?')}) — severity {severity}/10")

    # Personality
    if personality and any(personality.get(k) for k in ["ei", "sn", "tf", "jp"]):
        sections.append("\n## Personality\n")
        ei = personality.get("ei", "—")
        sn = personality.get("sn", "—")
        tf = personality.get("tf", "—")
        jp = personality.get("jp", "—")
        sections.append(f"- **Game Reading (EI)**: {ei}")
        sections.append(f"- **Motivation (SN)**: {sn}")
        sections.append(f"- **Social (TF)**: {tf}")
        sections.append(f"- **Pressure (JP)**: {jp}")
        comp = personality.get("competitiveness")
        coach = personality.get("coachability")
        if comp:
            sections.append(f"- **Competitiveness**: {comp}/10")
        if coach:
            sections.append(f"- **Coachability**: {coach}/10")

    # Raw narrative (collapsed)
    if narrative:
        # Truncate very long narratives
        truncated = narrative[:2000] + ("..." if len(narrative) > 2000 else "")
        sections.append(f"\n## Research Notes\n\n<details>\n<summary>Raw scouting narrative</summary>\n\n{truncated}\n\n</details>")

    return "\n".join(sections) + "\n"


def render_archetype_article(
    archetype: str,
    attributes: list[str],
    exemplars: list[dict],
    compounds: dict[str, str] | None = None,
) -> str:
    """Render an archetype KB article.

    Args:
        archetype: Model name (e.g. "Controller").
        attributes: List of 4 core attributes.
        exemplars: List of {name, position, club_name, overall} dicts — top players.
        compounds: Dict of compound archetype names → labels (e.g. "Controller-Creator" → "Playmaker").
    """
    # Find which category this model belongs to
    cat = "—"
    for category, models in MODEL_CATEGORIES.items():
        if archetype in models:
            cat = category
            break

    meta = {
        "title": archetype,
        "category": "archetypes",
        "tags": [cat, archetype],
        "updated": _today(),
        "source": "compiled",
        "confidence": "high",
        "summary": f"{cat} archetype. Core attributes: {', '.join(attributes)}.",
    }

    sections = [make_frontmatter(meta), f"\n# {archetype}\n"]
    sections.append(f"**Category**: {cat}  ")
    sections.append(f"**Core Attributes**: {', '.join(a.replace('_', ' ').title() for a in attributes)}\n")

    # Description
    descriptions = {
        "Controller": "The brain of the team. Controls tempo, reads the game ahead of time, and makes every possession count. Thrives in central positions where they can dictate play.",
        "Commander": "The vocal leader who organizes teammates and drives standards through communication and sheer force of will. The dressing room heartbeat.",
        "Creator": "The spark. Sees passes others don't, conjures moments from nothing, and carries the creative burden. Often the most-watched player on the pitch.",
        "Target": "Dominant in the air, wins aerial duels, and provides a focal point for crosses and set pieces. Physical presence in both boxes.",
        "Sprinter": "Pure speed — acceleration, top speed, and the ability to exploit space behind defensive lines. Changes games with explosive runs.",
        "Powerhouse": "Physical dominance through strength and aggression. Wins duels, shields the ball, and bullies opponents off possession.",
        "Cover": "The reader of the game. Anticipates danger, covers space, and positions intelligently to intercept and sweep. The defensive brain.",
        "Engine": "Tireless work rate. Presses, runs, recovers, and does it again for 90 minutes. The oxygen of the team.",
        "Destroyer": "The ball winner. Tackles, blocks, clears, and disrupts opposition attacks. Sacrifices possession stats for defensive impact.",
        "Dribbler": "Close control and the ability to beat defenders 1v1. Carries the ball under pressure and creates overloads through individual quality.",
        "Passer": "Distribution specialist. Accurate short and long passing, crosses, and through balls. Moves the ball precisely to create chances.",
        "Striker": "The finisher. Clinical from close range, mid-range, and distance. Converts chances and adds scoreboard pressure.",
        "GK": "Shot stopping, distribution, and command of the box. The last line of defense and the first point of attack.",
    }
    if archetype in descriptions:
        sections.append(f"> {descriptions[archetype]}\n")

    # Exemplars
    if exemplars:
        sections.append("## Top Exemplars\n")
        sections.append("| Player | Position | Club | Overall |")
        sections.append("|---|---|---|---|")
        for e in exemplars[:10]:
            pname = e.get("name", "?")
            sections.append(f"| [[{slug(pname)}]] {pname} | {e.get('position', '?')} | {e.get('club_name', '?')} | {e.get('overall', '?')} |")

    # Compound archetypes
    if compounds:
        sections.append("\n## Compound Archetypes\n")
        sections.append("| Compound | Label |")
        sections.append("|---|---|")
        for compound, label in sorted(compounds.items()):
            sections.append(f"| {compound} | {label} |")

    return "\n".join(sections) + "\n"


def render_club_article(club: dict, squad: list[dict]) -> str:
    """Render a club KB article."""
    name = club.get("name", "Unknown")

    meta = {
        "title": name,
        "category": "clubs",
        "tags": [club.get("league", ""), club.get("nation", "")],
        "updated": _today(),
        "source": "compiled",
        "confidence": "medium",
        "summary": f"{name}. {len(squad)} players in database.",
    }

    sections = [make_frontmatter(meta), f"\n# {name}\n"]
    sections.append(f"**League**: {club.get('league', '—')}  ")
    sections.append(f"**Nation**: {club.get('nation', '—')}  ")
    sections.append(f"**Players in DB**: {len(squad)}\n")

    if squad:
        sections.append("## Squad\n")
        sections.append("| Player | Position | Archetype | Overall |")
        sections.append("|---|---|---|---|")
        for p in sorted(squad, key=lambda x: x.get("position", "Z")):
            pname = p.get("name", "?")
            sections.append(f"| [[{slug(pname)}]] {pname} | {p.get('position', '?')} | {p.get('archetype', '?')} | {p.get('overall', '?')} |")

    return "\n".join(sections) + "\n"


def render_tactic_article(title: str, raw_content: str) -> str:
    """Wrap a raw formation/tactic document with KB frontmatter."""
    meta = {
        "title": title,
        "category": "tactics",
        "tags": ["formation"],
        "updated": _today(),
        "source": "compiled",
        "confidence": "medium",
        "summary": f"Tactical analysis of the {title} formation.",
    }
    return make_frontmatter(meta) + f"\n\n# {title}\n\n{raw_content}\n"


def render_query_article(question: str, answer: str, sources: list[str]) -> str:
    """Render a filed Q&A output."""
    meta = {
        "title": question[:80],
        "category": "queries",
        "tags": ["query"],
        "updated": _today(),
        "source": "query",
        "confidence": "medium",
        "summary": question[:200],
    }
    sections = [make_frontmatter(meta), f"\n# {question}\n"]
    sections.append(f"*Filed: {_today()}*\n")
    sections.append(f"## Answer\n\n{answer}\n")
    if sources:
        sections.append("## Sources\n")
        for s in sources:
            sections.append(f"- {s}")
    return "\n".join(sections) + "\n"


# ── Index generation ─────────────────────────────────────────────────────────

def _scan_articles(category: str) -> list[dict]:
    """Scan kb/{category}/ for articles, return list of parsed frontmatter dicts."""
    cat_dir = KB_ROOT / category
    if not cat_dir.exists():
        return []

    articles = []
    for path in sorted(cat_dir.glob("*.md")):
        if path.name.startswith("_"):
            continue
        text = path.read_text(encoding="utf-8")
        meta, body = parse_frontmatter(text)
        meta["_path"] = str(path.relative_to(KB_ROOT))
        meta["_slug"] = path.stem
        meta["_words"] = len(body.split())
        if "summary" not in meta:
            meta["summary"] = _extract_summary(body)
        articles.append(meta)
    return articles


def _extract_summary(text: str, max_chars: int = 200) -> str:
    """Extract first non-empty paragraph as summary."""
    for line in text.split("\n"):
        line = line.strip()
        if line and not line.startswith("#") and not line.startswith("|") and not line.startswith("---"):
            return line[:max_chars]
    return ""


def extract_backlinks(text: str) -> list[str]:
    """Find all [[wikilink]] references in article text."""
    return re.findall(r"\[\[([^\]]+)\]\]", text)


def build_category_index(category: str) -> str:
    """Build _index.md for a category by scanning its articles."""
    articles = _scan_articles(category)
    total_words = sum(a.get("_words", 0) for a in articles)

    lines = [
        f"# {category.title()} Index\n",
        f"> {len(articles)} articles | {total_words:,} words | Last rebuilt: {_today()}\n",
    ]

    if not articles:
        lines.append("*No articles yet.*\n")
        return "\n".join(lines)

    # Main listing
    lines.append("## Articles\n")
    lines.append("| Article | Summary |")
    lines.append("|---|---|")
    for a in articles:
        title = a.get("title", a["_slug"])
        summary = a.get("summary", "")
        if isinstance(summary, list):
            summary = ", ".join(summary)
        lines.append(f"| [[{a['_slug']}]] {title} | {summary[:100]} |")

    # Position grouping for players
    if category == "players":
        positions = {}
        for a in articles:
            tags = a.get("tags", [])
            if isinstance(tags, str):
                tags = [tags]
            for tag in tags:
                if tag in ("GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"):
                    positions.setdefault(tag, []).append(a)
        if positions:
            lines.append("\n## By Position\n")
            for pos in ["GK", "WD", "CD", "DM", "CM", "WM", "AM", "WF", "CF"]:
                if pos in positions:
                    names = ", ".join(f"[[{a['_slug']}]]" for a in positions[pos][:10])
                    lines.append(f"- **{pos}** ({len(positions[pos])}): {names}")

    # Category grouping for archetypes
    if category == "archetypes":
        lines.append("\n## By Category\n")
        for cat_name, models in MODEL_CATEGORIES.items():
            model_links = ", ".join(f"[[{slug(m)}]]" for m in models)
            lines.append(f"- **{cat_name}**: {model_links}")

    return "\n".join(lines) + "\n"


def build_master_index() -> str:
    """Build the master INDEX.md by scanning all categories."""
    lines = [
        "# Chief Scout Knowledge Base\n",
        f"> Auto-generated by `pipeline/96_kb_index.py` — do not edit manually.",
        f"> Last rebuilt: {_today()}\n",
    ]

    # Category overview
    lines.append("## Overview\n")
    lines.append("| Category | Articles | Words | Last Updated |")
    lines.append("|---|---|---|---|")

    total_articles = 0
    total_words = 0
    all_articles = []

    for cat in CATEGORIES:
        articles = _scan_articles(cat)
        words = sum(a.get("_words", 0) for a in articles)
        last_updated = "—"
        if articles:
            dates = [a.get("updated", "1970-01-01") for a in articles]
            dates = [d for d in dates if isinstance(d, str)]
            if dates:
                last_updated = max(dates)

        lines.append(f"| [{cat.title()}]({cat}/_index.md) | {len(articles)} | {words:,} | {last_updated} |")
        total_articles += len(articles)
        total_words += words
        all_articles.extend(articles)

    lines.append(f"| **Total** | **{total_articles}** | **{total_words:,}** | |")

    # Recently updated
    dated = [a for a in all_articles if isinstance(a.get("updated"), str)]
    dated.sort(key=lambda a: a.get("updated", ""), reverse=True)
    if dated:
        lines.append("\n## Recently Updated\n")
        for a in dated[:20]:
            cat = a.get("category", "?")
            title = a.get("title", a["_slug"])
            lines.append(f"- [[{a['_slug']}]] {title} ({cat}) — {a.get('updated', '?')}")

    # Stale articles
    stale = [a for a in dated if a.get("updated", "9999") < _stale_threshold()]
    if stale:
        lines.append(f"\n## Stale Articles (>{_STALE_DAYS} days)\n")
        for a in stale[:20]:
            lines.append(f"- [[{a['_slug']}]] {a.get('title', a['_slug'])} — last updated {a.get('updated', '?')}")

    return "\n".join(lines) + "\n"


_STALE_DAYS = 30

def _stale_threshold() -> str:
    """Return date string for stale threshold."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=_STALE_DAYS)
    return cutoff.strftime("%Y-%m-%d")
