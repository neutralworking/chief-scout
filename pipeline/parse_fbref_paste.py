#!/usr/bin/env python3
"""
parse_fbref_paste.py — Convert tab-separated FBRef paste into clean CSV.

FBRef's "Copy table" output is tab-separated with:
  - Repeated header rows every 25 data rows
  - A trailing "Matches" column (link text, not useful)
  - Numbers with commas (e.g. "2,250") that need quoting in CSV

Usage:
    python parse_fbref_paste.py INPUT_TSV OUTPUT_CSV
    python parse_fbref_paste.py --stdin OUTPUT_CSV          # read from stdin
    cat paste.txt | python parse_fbref_paste.py - output.csv

Examples:
    python parse_fbref_paste.py raw_shooting.txt fbref_pages/9_2025-2026_shooting.csv
    pbpaste | python parse_fbref_paste.py - fbref_pages/9_2025-2026_shooting.csv
"""

import argparse
import csv
import sys
from pathlib import Path


def parse_fbref_paste(lines: list[str]) -> tuple[list[str], list[list[str]]]:
    """Parse tab-separated FBRef lines into header + data rows.

    Strips:
      - Repeated header rows (lines where first field is 'Rk')
      - Blank/whitespace-only lines
      - 'Matches' column (last column if header is 'Matches')
    """
    header = None
    data_rows = []
    drop_last_col = False

    for line in lines:
        line = line.rstrip("\n\r")
        if not line.strip():
            continue

        fields = line.split("\t")

        # Detect header row
        if fields[0].strip() == "Rk":
            if header is None:
                header = [f.strip() for f in fields]
                # Check if last column is "Matches" — drop it
                if header[-1] == "Matches":
                    header = header[:-1]
                    drop_last_col = True
            # Skip all header rows (first and repeats)
            continue

        # Data row
        if drop_last_col:
            fields = fields[:-1]

        # Strip whitespace from each field
        fields = [f.strip() for f in fields]

        # Skip empty rows that slipped through
        if not any(fields):
            continue

        data_rows.append(fields)

    if header is None:
        raise ValueError("No header row found (expected a line starting with 'Rk')")

    return header, data_rows


def write_csv(header: list[str], rows: list[list[str]], output_path: str) -> int:
    """Write header + rows as CSV. Returns number of data rows written."""
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        for row in rows:
            # Pad or trim row to match header length
            if len(row) < len(header):
                row = row + [""] * (len(header) - len(row))
            elif len(row) > len(header):
                row = row[: len(header)]
            writer.writerow(row)
    return len(rows)


def main():
    parser = argparse.ArgumentParser(
        description="Convert tab-separated FBRef paste into clean CSV."
    )
    parser.add_argument(
        "input",
        help="Input TSV file path, or '-' / '--stdin' to read from stdin",
    )
    parser.add_argument("output", help="Output CSV file path")
    args = parser.parse_args()

    # Read input
    if args.input in ("-", "--stdin"):
        lines = sys.stdin.readlines()
    else:
        path = Path(args.input)
        if not path.exists():
            print(f"Error: input file not found: {path}", file=sys.stderr)
            sys.exit(1)
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)

    # Parse and write
    header, rows = parse_fbref_paste(lines)
    count = write_csv(header, rows, args.output)

    print(f"Wrote {count} rows ({len(header)} columns) to {args.output}")
    print(f"Columns: {', '.join(header)}")


if __name__ == "__main__":
    main()
