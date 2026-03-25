"""
Calibration module for Chief Scout role scoring.

Provides:
- League strength lookup (player → club → league → coefficient)
- Score band classification
- Reference profile validation (anchor players with target role scores)
"""


# ── Score Bands ────────────────────────────────────────────────────────────────

SCORE_BANDS = [
    (93, 95, "Generational",  "Ballon d'Or winner tier"),
    (90, 92, "World Class",   "Ballon d'Or shortlist"),
    (87, 89, "Elite",         "Top 50 globally"),
    (84, 86, "International", "Regular international, top-flight star"),
    (80, 83, "Established",   "Consistent top-flight starter"),
    (75, 79, "Professional",  "Solid professional, strong second tier"),
    (70, 74, "Capable",       "Good second-tier or top-flight squad player"),
    (65, 69, "Competitive",   "Lower-league starter or development prospect"),
    (0,  64, "Foundation",    "Early career or lower division"),
]


def get_score_band(score):
    """Return (band_name, band_description) for a role score."""
    if score is None:
        return ("Unrated", "Insufficient data")
    for lo, hi, name, desc in SCORE_BANDS:
        if lo <= score <= hi:
            return (name, desc)
    return ("Foundation", "Early career or lower division")


# ── Reference Profiles ─────────────────────────────────────────────────────────
# Anchor players with target role score ranges.
# Derived from levels 87+ (trusted) and football knowledge.
# Used for post-pipeline validation — if these are off, the scoring is wrong.
#
# Format: "Player Name": (position, level, target_low, target_high)

REFERENCE_PROFILES = {
    # CF
    "Kylian Mbappé":       ("CF", 92, 91, 95),
    "Harry Kane":          ("CF", 92, 90, 93),
    "Erling Haaland":      ("CF", 90, 89, 92),
    "Julian Alvarez":      ("CF", 89, 86, 89),
    "Lautaro Martinez":    ("CF", 88, 85, 88),
    "Victor Osimhen":      ("CF", 88, 85, 88),
    # WF
    "Lamine Yamal":        ("WF", 92, 90, 93),
    "Bukayo Saka":         ("WF", 90, 88, 91),
    "Vinicius Junior":     ("WF", 89, 87, 90),  # not BdO-level this season
    "Raphinha":            ("WF", 89, 86, 89),
    # AM
    "Martin Odegaard":     ("AM", 89, 87, 89),
    "Cole Palmer":         ("AM", 89, 87, 90),
    "Florian Wirtz":       ("AM", 88, 86, 89),
    # CM
    "Jude Bellingham":     ("CM", 90, 89, 92),
    "Pedri":               ("CM", 91, 89, 91),
    "Declan Rice":         ("CM", 90, 88, 90),
    "Nicolo Barella":      ("CM", 88, 85, 88),
    # DM
    "Rodri":               ("DM", 88, 87, 90),
    "Joshua Kimmich":      ("DM", 89, 86, 89),
    # CD — deflated ~0.91 from raw, targets are post-deflator
    "William Saliba":      ("CD", 89, 76, 82),
    "Virgil van Dijk":     ("CD", 89, 74, 80),
    "Gabriel Magalhaes":   ("CD", 90, 79, 85),
    "Ruben Dias":          ("CD", 88, 74, 80),
    # WD — deflated ~0.93 from raw
    "Achraf Hakimi":       ("WD", 90, 79, 85),
    "Reece James":         ("WD", 89, 74, 80),
    # GK — deliberately lower than equivalent-level outfield
    "Alisson Becker":      ("GK", 87, 80, 85),
    "Thibaut Courtois":    ("GK", 90, 83, 87),
    "David Raya":          ("GK", 89, 82, 86),
    "Ederson":             ("GK", 87, 80, 85),
}


def load_player_league_strengths(conn):
    """Load league strength factors for all players.

    Join path: people → clubs → league_coefficients.
    Returns {person_id: strength_factor}. Default 1.0 for missing.
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT p.id, lc.strength_factor
        FROM people p
        JOIN clubs c ON c.id = p.club_id
        JOIN league_coefficients lc ON lc.league_name = c.league_name AND lc.season = '2025'
        WHERE p.club_id IS NOT NULL
    """)
    strengths = {}
    for row in cur.fetchall():
        strengths[row[0]] = float(row[1])
    cur.close()
    return strengths


def validate_anchors(results, conn=None):
    """Compare computed role scores against reference profiles.

    Prints warnings for any player whose score deviates from the target range
    by more than the tolerance.
    """
    # Build name → result lookup
    result_map = {}
    for r in results:
        if r.get("name"):
            result_map[r["name"]] = r

    # If we don't have names in results, try to load from DB
    if not result_map and conn:
        pid_to_result = {r["person_id"]: r for r in results}
        cur = conn.cursor()
        pids = list(pid_to_result.keys())
        if pids:
            cur.execute("SELECT id, name FROM people WHERE id = ANY(%s)", (pids,))
            for row in cur.fetchall():
                pid, name = row
                if pid in pid_to_result:
                    result_map[name] = pid_to_result[pid]
            cur.close()

    print("\n── Anchor Validation ──")
    passed = 0
    warned = 0
    missing = 0

    for name, (pos, level, target_lo, target_hi) in REFERENCE_PROFILES.items():
        r = result_map.get(name)
        if not r:
            missing += 1
            continue

        rs = r.get("best_role_score")
        if rs is None:
            print(f"  WARN  {name:<25} RS=NULL (expected {target_lo}-{target_hi})")
            warned += 1
            continue

        if rs < target_lo - 3:
            print(f"  LOW   {name:<25} RS={rs} (expected {target_lo}-{target_hi}, delta={rs - target_lo})")
            warned += 1
        elif rs > target_hi + 3:
            print(f"  HIGH  {name:<25} RS={rs} (expected {target_lo}-{target_hi}, delta={rs - target_hi})")
            warned += 1
        else:
            passed += 1

    print(f"\n  Passed: {passed}  Warned: {warned}  Missing: {missing}")
    return warned == 0
