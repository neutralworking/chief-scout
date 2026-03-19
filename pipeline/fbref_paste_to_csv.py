"""
fbref_paste_to_csv.py — Convert FBRef table copy-paste into clean CSV.

FBRef's HTML tables, when copied from the browser, produce text with no clear
delimiters. This script parses the known column layout and outputs proper CSV
to fbref_pages/{comp_id}_{season}_{stat_type}.csv.

Usage:
    python fbref_paste_to_csv.py --file paste.txt
    python fbref_paste_to_csv.py --file paste.txt --comp 9 --season 2025-2026
    python fbref_paste_to_csv.py --file paste.txt --comp 12 --season 2025-2026

The input format (from FBRef "Standard Stats" table) looks like:
  1Brenden Aaronsonus USAMF,FWLeeds United25-145200029231,90821.2437400100.190.140.330.190.33Matches
"""
import argparse
import csv
import re
import sys
from pathlib import Path

parser = argparse.ArgumentParser(description="Convert FBRef paste to CSV")
parser.add_argument("--file", type=str, required=True, help="Input file")
parser.add_argument("--comp", type=int, default=9, help="Competition ID (default: 9 = PL)")
parser.add_argument("--season", default="2025-2026", help="Season string")
parser.add_argument("--stat-type", default="standard", help="Stat type")
parser.add_argument("--output", type=str, help="Output path (default: fbref_pages/{comp}_{season}_{type}.csv)")
args = parser.parse_args()

PAGES_DIR = Path(__file__).parent / "fbref_pages"
PAGES_DIR.mkdir(exist_ok=True)

# ── FBRef nation codes that use 3 lowercase chars ────────────────────────────
# UK nations use 3-char codes (eng, wls, nir, sct); all others use 2-char ISO
NATION_3CHAR = {"eng", "wls", "nir", "sct"}

# ── Known club names ─────────────────────────────────────────────────────────
CLUBS = [
    # Premier League
    "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton",
    "Burnley", "Chelsea", "Crystal Palace", "Everton", "Fulham",
    "Leeds United", "Leicester City", "Liverpool", "Manchester City",
    "Manchester Utd", "Newcastle United", "Nottingham Forest",
    "Sunderland", "Tottenham Hotspur", "West Ham United", "Wolves",
    # La Liga
    "Alavés", "Athletic Club", "Atlético Madrid", "Barcelona", "Celta Vigo",
    "Elche", "Espanyol", "Getafe", "Girona", "Levante", "Mallorca",
    "Osasuna", "Oviedo", "Rayo Vallecano", "Real Betis", "Real Madrid",
    "Real Sociedad", "Sevilla", "Valencia", "Villarreal",
    # Bundesliga
    "Bayern Munich", "Dortmund", "RB Leipzig", "Leverkusen", "Freiburg",
    "Stuttgart", "Eint Frankfurt", "Wolfsburg", "Hoffenheim", "Werder Bremen",
    "Mainz 05", "Augsburg", "Mönchengladbach", "Union Berlin", "Bochum",
    "Heidenheim", "St. Pauli", "Holstein Kiel",
    # Serie A
    "Atalanta", "Bologna", "Cagliari", "Como", "Empoli", "Fiorentina",
    "Genoa", "Hellas Verona", "Inter", "Juventus", "Lazio", "Lecce",
    "Milan", "Monza", "Napoli", "Parma", "Roma", "Salernitana",
    "Sassuolo", "Torino", "Udinese", "Venezia",
    # Ligue 1
    "Angers", "Auxerre", "Brest", "Le Havre", "Lens", "Lille", "Lyon",
    "Marseille", "Monaco", "Montpellier", "Nantes", "Nice", "Paris S-G",
    "Reims", "Rennes", "Saint-Étienne", "Strasbourg", "Toulouse",
]
CLUBS.sort(key=len, reverse=True)


def parse_row(line: str) -> dict | None:
    """Parse a single FBRef standard stats row from copy-pasted text."""
    line = line.strip()
    if not line or line.startswith("Rk") or line.startswith("Playing"):
        return None

    # Strip trailing "Matches" + any FBRef header that got concatenated
    line = re.sub(r"Matches(?:Rk.*)?$", "", line)

    # ── Rank ──
    m = re.match(r"^(\d+)", line)
    if not m:
        return None
    rk = int(m.group(1))
    line = line[m.end():]

    # ── Find position + club ──
    # Try compound positions first (FW,MF etc.), then single positions.
    # Use non-overlapping search but scan every possible start position.
    position = None
    club = None
    before_pos = None

    # Try every position in the string for a position code followed by a club
    for i in range(len(line)):
        # Try compound first (5 chars: XX,YY)
        for plen in (5, 2):
            candidate = line[i:i + plen]
            if plen == 5 and re.fullmatch(r"(?:GK|DF|MF|FW),(?:GK|DF|MF|FW)", candidate):
                pass
            elif plen == 2 and candidate in ("GK", "DF", "MF", "FW"):
                pass
            else:
                continue
            after = line[i + plen:]
            for c in CLUBS:
                if after.startswith(c):
                    position = candidate
                    club = c
                    before_pos = line[:i]
                    line = after[len(c):]
                    break
            if position:
                break
        if position:
            break

    if not position or not club:
        return None

    # ── Extract nation (uppercase 2-3 chars at end, preceded by lowercase 2-3 chars) ──
    nation_m = re.search(r"\s([A-Z]{2,3})$", before_pos)
    if not nation_m:
        return None
    upper_code = nation_m.group(1)
    before_upper = before_pos[:nation_m.start()]

    if len(before_upper) >= 3 and before_upper[-3:] in NATION_3CHAR:
        lc_code = before_upper[-3:]
        player_name = before_upper[:-3]
    elif len(before_upper) >= 2:
        lc_code = before_upper[-2:]
        player_name = before_upper[:-2]
    else:
        return None

    nation = f"{lc_code} {upper_code}"
    if not player_name:
        return None

    # ── Age (dd-ddd) and Born (dddd) ──
    age_m = re.match(r"(\d{1,2}-\d{1,3})", line)
    if not age_m:
        return None
    age = age_m.group(1)
    line = line[age_m.end():]

    born_m = re.match(r"(\d{4})", line)
    if not born_m:
        return None
    born = born_m.group(1)
    line = line[born_m.end():]

    # ── Numeric blob ──
    # Structure: MP Starts Min 90s Gls Ast G+A G-PK PK PKatt CrdY CrdR Per90x5
    # Per-90 values at end: each d+.dd (usually single digit, rarely double)
    # Try single-digit first (most common), fall back to multi-digit
    per90_m = re.search(r"(\d\.\d{2})(\d\.\d{2})(\d\.\d{2})(\d\.\d{2})(\d\.\d{2})$", line)
    if not per90_m:
        # Try allowing multi-digit per-90 values (rare: players with very few minutes)
        per90_m = re.search(r"(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})(\d+\.\d{2})$", line)
    if not per90_m:
        return None
    counting_blob = line[:per90_m.start()]

    # Find the decimal point (belongs to 90s value — the only decimal in counting stats)
    dot_pos = counting_blob.find(".")
    if dot_pos < 0:
        return None

    before_dot = counting_blob[:dot_pos]
    dec_digit = counting_blob[dot_pos + 1] if dot_pos + 1 < len(counting_blob) else "0"
    after_90s_dec = counting_blob[dot_pos + 2:] if dot_pos + 2 < len(counting_blob) else ""

    # Split before_dot into MP, Starts, Min, 90s_integer_part
    clean_before = before_dot.replace(",", "")

    best = None
    best_diff = float("inf")

    for mp_len in (1, 2):
        for st_len in (1, 2):
            for min_len in range(1, 5):
                idx = mp_len + st_len + min_len
                if idx >= len(clean_before):
                    continue
                try:
                    mp = int(clean_before[:mp_len])
                    starts = int(clean_before[mp_len:mp_len + st_len])
                    minutes = int(clean_before[mp_len + st_len:idx])
                    nineties_int = clean_before[idx:]
                    nineties = float(f"{nineties_int}.{dec_digit}")
                except (ValueError, IndexError):
                    continue

                if starts > mp or mp > 50 or minutes > 5000 or nineties > 50:
                    continue

                expected_min = round(nineties * 90)
                diff = abs(minutes - expected_min)
                if diff < best_diff:
                    best_diff = diff
                    best = (mp, starts, minutes, nineties)

    if best is None or best_diff > 30:
        return None
    mp, starts, minutes, nineties = best

    # Parse Gls Ast G+A G-PK PK PKatt CrdY CrdR from remaining digits
    int_fields = _parse_8_ints(after_90s_dec)
    if int_fields is None:
        return None
    gls, ast, gpa, gpk, pk, pka, crdy, crdr = int_fields

    return {
        "Rk": str(rk),
        "Player": player_name,
        "Nation": nation,
        "Pos": position,
        "Squad": club,
        "Age": age,
        "Born": born,
        "MP": str(mp),
        "Starts": str(starts),
        "Min": str(minutes),
        "90s": f"{nineties:.1f}",
        "Gls": str(gls),
        "Ast": str(ast),
        "G+A": str(gpa),
        "G-PK": str(gpk),
        "PK": str(pk),
        "PKatt": str(pka),
        "CrdY": str(crdy),
        "CrdR": str(crdr),
    }


def _parse_8_ints(blob: str) -> tuple | None:
    """Parse 8 concatenated small integers (Gls Ast G+A G-PK PK PKatt CrdY CrdR).

    Uses constraint G+A == Gls + Ast and G-PK == Gls - PK to validate.
    """
    if not blob:
        return (0,) * 8

    results = []
    _backtrack(blob, 0, [], 8, results)

    for r in results:
        gls, ast, gpa, gpk, pk, pka, crdy, crdr = r
        if gpa == gls + ast and gpk == gls - pk and pka >= pk:
            return tuple(r)

    for r in results:
        gls, ast, gpa, gpk, pk, pka, crdy, crdr = r
        if gpa == gls + ast:
            return tuple(r)

    return tuple(results[0]) if results else None


def _backtrack(s: str, pos: int, current: list, n: int, results: list):
    """Split s[pos:] into n non-negative integers (1-2 digits each)."""
    if len(results) > 200:
        return
    if len(current) == n:
        if pos == len(s):
            results.append(current[:])
        return

    remaining = n - len(current)
    remaining_chars = len(s) - pos
    if remaining_chars < remaining or remaining_chars > remaining * 2:
        return

    for dlen in (1, 2):
        if pos + dlen <= len(s):
            val = int(s[pos:pos + dlen])
            if val <= 50:
                current.append(val)
                _backtrack(s, pos + dlen, current, n, results)
                current.pop()


def main():
    text = Path(args.file).read_text(encoding="utf-8", errors="replace")
    lines = text.strip().split("\n")

    rows = []
    failed = []
    for line in lines:
        row = parse_row(line)
        if row:
            rows.append(row)
        elif line.strip() and re.match(r"^\d+[A-Z]", line.strip()):
            failed.append(line.strip()[:80])

    output_path = args.output or str(PAGES_DIR / f"{args.comp}_{args.season}_{args.stat_type}.csv")

    fieldnames = ["Rk", "Player", "Nation", "Pos", "Squad", "Age", "Born",
                   "MP", "Starts", "Min", "90s", "Gls", "Ast", "G+A", "G-PK",
                   "PK", "PKatt", "CrdY", "CrdR"]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} players to {output_path}")
    if failed:
        print(f"  {len(failed)} rows failed to parse:")
        for f_line in failed[:10]:
            print(f"    {f_line}")


if __name__ == "__main__":
    main()
