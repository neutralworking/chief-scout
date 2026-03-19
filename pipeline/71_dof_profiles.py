"""
32_dof_profiles.py — DOF deep profiling for seed players.

Assigns pursuit_status and personality (MBTI) based on football knowledge.
Only targets the 98 curated seed players from 14_seed_profiles.py.

Usage:
    python 32_dof_profiles.py                  # assign profiles
    python 32_dof_profiles.py --dry-run        # preview only
"""
from __future__ import annotations

import argparse
import re
import psycopg2
import psycopg2.extras

from config import POSTGRES_DSN

parser = argparse.ArgumentParser(description="DOF deep profiling")
parser.add_argument("--dry-run", action="store_true")
args = parser.parse_args()


# ── DOF pursuit status assessments ───────────────────────────────────────────
# Based on real-world transfer market logic:
# Priority = active target we'd pursue immediately
# Interested = strong interest, monitoring for opportunity
# Watch = talent worth tracking, not ready/available yet
# Scout Further = need more data before committing
# Monitor = keep tabs on, low urgency
# Pass = not a fit / too expensive / wrong profile
PURSUIT_MAP: dict[str, str] = {
    # Elite untouchables — Pass (not realistically available)
    "Erling Haaland": "Pass",
    "Kylian Mbappé": "Pass",
    "Vinícius Júnior": "Pass",
    "Rodri": "Pass",
    "Jude Bellingham": "Pass",
    "Lamine Yamal": "Pass",
    "Phil Foden": "Pass",

    # Declining or expensive veterans — Pass
    "Kevin De Bruyne": "Pass",
    "Toni Kroos": "Pass",
    "Casemiro": "Pass",
    "Thiago Silva": "Pass",
    "Ángel Di María": "Pass",
    "Dani Carvajal": "Pass",
    "Granit Xhaka": "Pass",
    "Antoine Griezmann": "Pass",
    "Mohamed Salah": "Pass",
    "Son Heung-min": "Pass",

    # Priority targets — realistic, high-impact, available
    "Viktor Gyökeres": "Priority",
    "Jarrad Branthwaite": "Priority",
    "Martín Zubimendi": "Priority",
    "Nico Paz": "Priority",
    "Carlos Baleba": "Priority",

    # Interested — strong fits, would move if price right
    "Bernardo Silva": "Interested",
    "Bukayo Saka": "Interested",
    "Vitinha": "Interested",
    "Ronald Araujo": "Interested",
    "Nuno Mendes": "Interested",
    "Theo Hernandez": "Interested",
    "Alphonso Davies": "Interested",
    "João Neves": "Interested",
    "Maghnes Akliouche": "Interested",
    "Zion Suzuki": "Interested",
    "Kenan Yıldız": "Interested",

    # Watch — exciting talents, tracking development
    "William Saliba": "Watch",
    "Alessandro Bastoni": "Watch",
    "Pedri": "Watch",
    "Jamal Musiala": "Watch",
    "Declan Rice": "Watch",
    "Aurélien Tchouameni": "Watch",
    "Alexander Isak": "Watch",
    "Gianluigi Donnarumma": "Watch",
    "Achraf Hakimi": "Watch",
    "Josko Gvardiol": "Watch",
    "Moisés Caicedo": "Watch",
    "Pedro Porro": "Watch",
    "Trent Alexander-Arnold": "Watch",
    "Pau Cubarsí": "Watch",
    "Florian Wirtz": "Watch",
    "Cole Palmer": "Watch",
    "Ryan Gravenberch": "Watch",
    "Warren Zaïre-Emery": "Watch",

    # Scout Further — need more evidence
    "Victor Osimhen": "Scout Further",
    "Randal Kolo Muani": "Scout Further",
    "Jørgen Strand Larsen": "Scout Further",
    "Ousmane Dembélé": "Scout Further",
    "Raphinha": "Scout Further",
    "Ibrahima Konaté": "Scout Further",
    "Sandro Tonali": "Scout Further",

    # Monitor — keeping tabs, lower priority
    "Riccardo Calafiori": "Monitor",
    "Jordan Pickford": "Monitor",
    "Jaidon Anthony": "Monitor",
    "Davis Keillor-Dunn": "Monitor",
    "Alisson Becker": "Monitor",
    "Ben Chilwell": "Monitor",
    "Nico Paz": "Priority",  # already set above
    "Bruno Fernandes": "Monitor",
    "Martin Ødegaard": "Monitor",
    "Harry Kane": "Monitor",
    "Virgil van Dijk": "Monitor",
    "Marc-André ter Stegen": "Monitor",
    "Thibaut Courtois": "Monitor",
    "Leroy Sané": "Monitor",
    "Khvicha Kvaratskhelia": "Monitor",
    "Dani Olmo": "Monitor",
    "Marcus Rashford": "Monitor",
    "Alejandro Garnacho": "Monitor",
    "Nico Williams": "Monitor",
    "Diogo Jota": "Monitor",
    "Kai Havertz": "Monitor",
    "Ollie Watkins": "Monitor",
    "Lisandro Martínez": "Monitor",
    "Antonio Rüdiger": "Monitor",
    "Gabriel Magalhães": "Monitor",
    "Éderson": "Monitor",
    "André Onana": "Monitor",
    "Mike Maignan": "Monitor",
    "Bruno Guimarães": "Monitor",
    "Federico Valverde": "Monitor",
    "Joshua Kimmich": "Monitor",
    "Amadou Onana": "Monitor",
    "Yves Bissouma": "Monitor",
    "Manuel Ugarte": "Monitor",
    "Edson Álvarez": "Monitor",
    "Cheick Doucouré": "Monitor",
    "Palhinha": "Monitor",
    "Enzo Fernández": "Monitor",
    "Kobbie Mainoo": "Monitor",
    "Rúben Dias": "Monitor",
    "Marquinhos": "Monitor",
    "Julián Álvarez": "Monitor",
    "Lautaro Martínez": "Monitor",
}

# ── Personality profiles (MBTI-based) ────────────────────────────────────────
# Codes: A=Analytical/I=Instinctive, N=self-motivated/X=occasion-driven,
#        L=vocal-leader/S=self-contained, C=confrontational/P=composed
# 16 types with football archetypes:
# ANLC=General, IXSP=Genius, ANSC=Machine, INLC=Captain, AXLC=Showman,
# INSP=Maestro, ANLP=Conductor, IXSC=Maverick, AXSC=Enforcer, AXSP=Technician,
# AXLP=Orchestrator, INLP=Guardian, INSC=Hunter, IXLC=Provocateur,
# IXLP=Playmaker, ANSP=Professor
PERSONALITY_MAP: dict[str, dict] = {
    # ── Goalkeepers ──
    "Alisson Becker":       {"type": "ANSP", "ei": 75, "sn": 30, "tf": 65, "jp": 25, "comp": 7, "coach": 9},
    "Gianluigi Donnarumma": {"type": "IXSP", "ei": 40, "sn": 70, "tf": 55, "jp": 25, "comp": 6, "coach": 7},
    "Jordan Pickford":      {"type": "IXLC", "ei": 35, "sn": 65, "tf": 40, "jp": 80, "comp": 8, "coach": 6},
    "Marc-André ter Stegen":{"type": "ANSP", "ei": 70, "sn": 35, "tf": 60, "jp": 20, "comp": 6, "coach": 8},
    "Thibaut Courtois":     {"type": "ANSC", "ei": 65, "sn": 30, "tf": 55, "jp": 70, "comp": 7, "coach": 7},
    "André Onana":          {"type": "IXSC", "ei": 35, "sn": 75, "tf": 55, "jp": 75, "comp": 7, "coach": 6},
    "Mike Maignan":         {"type": "INLC", "ei": 45, "sn": 65, "tf": 40, "jp": 80, "comp": 9, "coach": 7},
    "Zion Suzuki":          {"type": "ANSP", "ei": 70, "sn": 35, "tf": 60, "jp": 25, "comp": 6, "coach": 8},
    "Éderson":              {"type": "ANLP", "ei": 70, "sn": 30, "tf": 40, "jp": 20, "comp": 6, "coach": 8},

    # ── Defenders ──
    "William Saliba":       {"type": "ANSC", "ei": 70, "sn": 25, "tf": 60, "jp": 70, "comp": 8, "coach": 9},
    "Virgil van Dijk":      {"type": "INLC", "ei": 45, "sn": 60, "tf": 35, "jp": 80, "comp": 9, "coach": 8},
    "Alessandro Bastoni":   {"type": "ANLP", "ei": 75, "sn": 30, "tf": 40, "jp": 20, "comp": 7, "coach": 9},
    "Ronald Araujo":        {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 75, "comp": 9, "coach": 7},
    "Josko Gvardiol":       {"type": "ANSC", "ei": 65, "sn": 30, "tf": 60, "jp": 65, "comp": 8, "coach": 8},
    "Pau Cubarsí":          {"type": "ANSP", "ei": 70, "sn": 25, "tf": 55, "jp": 20, "comp": 7, "coach": 9},
    "Rúben Dias":           {"type": "INLC", "ei": 40, "sn": 60, "tf": 35, "jp": 80, "comp": 9, "coach": 8},
    "Marquinhos":           {"type": "ANLP", "ei": 70, "sn": 30, "tf": 40, "jp": 25, "comp": 7, "coach": 9},
    "Antonio Rüdiger":      {"type": "AXSC", "ei": 30, "sn": 65, "tf": 55, "jp": 80, "comp": 9, "coach": 6},
    "Gabriel Magalhães":    {"type": "INSC", "ei": 40, "sn": 60, "tf": 55, "jp": 70, "comp": 8, "coach": 8},
    "Lisandro Martínez":    {"type": "INLC", "ei": 45, "sn": 65, "tf": 35, "jp": 85, "comp": 10, "coach": 7},
    "Ibrahima Konaté":      {"type": "ANSC", "ei": 65, "sn": 30, "tf": 55, "jp": 65, "comp": 8, "coach": 8},
    "Jarrad Branthwaite":   {"type": "ANSP", "ei": 70, "sn": 25, "tf": 60, "jp": 20, "comp": 7, "coach": 9},
    "Riccardo Calafiori":   {"type": "AXLP", "ei": 30, "sn": 70, "tf": 40, "jp": 25, "comp": 7, "coach": 8},

    # ── Fullbacks/Wingbacks ──
    "Trent Alexander-Arnold":{"type": "IXLP", "ei": 30, "sn": 75, "tf": 40, "jp": 20, "comp": 7, "coach": 7},
    "Achraf Hakimi":        {"type": "IXSC", "ei": 35, "sn": 70, "tf": 55, "jp": 75, "comp": 8, "coach": 7},
    "Alphonso Davies":      {"type": "IXSP", "ei": 35, "sn": 75, "tf": 55, "jp": 25, "comp": 7, "coach": 7},
    "Theo Hernandez":       {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 75, "comp": 8, "coach": 6},
    "Nuno Mendes":          {"type": "ANSP", "ei": 65, "sn": 35, "tf": 55, "jp": 20, "comp": 7, "coach": 8},
    "Pedro Porro":          {"type": "IXLC", "ei": 30, "sn": 70, "tf": 40, "jp": 80, "comp": 8, "coach": 7},
    "Dani Carvajal":        {"type": "INLC", "ei": 45, "sn": 60, "tf": 35, "jp": 85, "comp": 9, "coach": 8},
    "Joshua Kimmich":       {"type": "ANLC", "ei": 80, "sn": 25, "tf": 35, "jp": 80, "comp": 9, "coach": 8},
    "Ben Chilwell":         {"type": "ANSP", "ei": 65, "sn": 30, "tf": 55, "jp": 25, "comp": 5, "coach": 7},

    # ── Defensive Midfielders ──
    "Rodri":                {"type": "ANLP", "ei": 80, "sn": 20, "tf": 40, "jp": 15, "comp": 8, "coach": 9},
    "Casemiro":             {"type": "INLC", "ei": 40, "sn": 65, "tf": 35, "jp": 85, "comp": 9, "coach": 7},
    "Aurélien Tchouameni":  {"type": "ANSC", "ei": 70, "sn": 30, "tf": 55, "jp": 65, "comp": 8, "coach": 9},
    "Martín Zubimendi":     {"type": "ANSP", "ei": 75, "sn": 25, "tf": 60, "jp": 20, "comp": 7, "coach": 9},
    "Moisés Caicedo":       {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 70, "comp": 8, "coach": 8},
    "Carlos Baleba":        {"type": "ANSP", "ei": 65, "sn": 30, "tf": 55, "jp": 20, "comp": 7, "coach": 9},
    "Amadou Onana":         {"type": "AXSC", "ei": 30, "sn": 65, "tf": 55, "jp": 75, "comp": 8, "coach": 7},
    "Yves Bissouma":        {"type": "IXSC", "ei": 35, "sn": 70, "tf": 55, "jp": 75, "comp": 7, "coach": 5},
    "Manuel Ugarte":        {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 75, "comp": 9, "coach": 7},
    "Edson Álvarez":        {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 70, "comp": 8, "coach": 7},
    "Cheick Doucouré":      {"type": "ANSC", "ei": 65, "sn": 30, "tf": 55, "jp": 65, "comp": 7, "coach": 8},
    "Palhinha":             {"type": "INLC", "ei": 40, "sn": 60, "tf": 35, "jp": 80, "comp": 9, "coach": 7},

    # ── Central Midfielders ──
    "Kevin De Bruyne":      {"type": "AXLP", "ei": 25, "sn": 75, "tf": 40, "jp": 20, "comp": 9, "coach": 7},
    "Jude Bellingham":      {"type": "INLC", "ei": 40, "sn": 65, "tf": 35, "jp": 85, "comp": 10, "coach": 8},
    "Pedri":                {"type": "ANLP", "ei": 75, "sn": 25, "tf": 40, "jp": 15, "comp": 7, "coach": 9},
    "Declan Rice":          {"type": "ANLC", "ei": 75, "sn": 25, "tf": 35, "jp": 75, "comp": 8, "coach": 9},
    "Vitinha":              {"type": "INSP", "ei": 40, "sn": 65, "tf": 55, "jp": 20, "comp": 7, "coach": 8},
    "João Neves":           {"type": "ANSP", "ei": 70, "sn": 25, "tf": 55, "jp": 20, "comp": 7, "coach": 9},
    "Bruno Guimarães":      {"type": "ANLP", "ei": 70, "sn": 30, "tf": 40, "jp": 20, "comp": 8, "coach": 8},
    "Federico Valverde":    {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 75, "comp": 9, "coach": 8},
    "Granit Xhaka":         {"type": "ANLC", "ei": 75, "sn": 25, "tf": 35, "jp": 80, "comp": 8, "coach": 7},
    "Sandro Tonali":        {"type": "INSP", "ei": 40, "sn": 65, "tf": 55, "jp": 25, "comp": 8, "coach": 8},
    "Ryan Gravenberch":     {"type": "ANSP", "ei": 65, "sn": 30, "tf": 55, "jp": 20, "comp": 7, "coach": 8},
    "Warren Zaïre-Emery":   {"type": "ANSP", "ei": 70, "sn": 25, "tf": 55, "jp": 20, "comp": 7, "coach": 9},
    "Kobbie Mainoo":        {"type": "INSP", "ei": 45, "sn": 60, "tf": 55, "jp": 20, "comp": 7, "coach": 8},
    "Enzo Fernández":       {"type": "ANLP", "ei": 70, "sn": 30, "tf": 40, "jp": 25, "comp": 8, "coach": 8},
    "Bruno Fernandes":      {"type": "AXLC", "ei": 25, "sn": 70, "tf": 35, "jp": 85, "comp": 9, "coach": 6},

    # ── Attacking Midfielders ──
    "Jamal Musiala":        {"type": "IXSP", "ei": 30, "sn": 80, "tf": 55, "jp": 15, "comp": 7, "coach": 8},
    "Martin Ødegaard":      {"type": "ANLP", "ei": 75, "sn": 25, "tf": 40, "jp": 20, "comp": 7, "coach": 9},
    "Florian Wirtz":        {"type": "IXSP", "ei": 30, "sn": 80, "tf": 55, "jp": 15, "comp": 7, "coach": 9},
    "Cole Palmer":          {"type": "IXSP", "ei": 25, "sn": 80, "tf": 55, "jp": 15, "comp": 8, "coach": 7},
    "Dani Olmo":            {"type": "INSP", "ei": 40, "sn": 65, "tf": 55, "jp": 20, "comp": 7, "coach": 8},
    "Nico Paz":             {"type": "IXSP", "ei": 30, "sn": 75, "tf": 55, "jp": 20, "comp": 6, "coach": 8},
    "Maghnes Akliouche":    {"type": "IXSP", "ei": 30, "sn": 75, "tf": 55, "jp": 20, "comp": 6, "coach": 8},

    # ── Wingers/Wide ──
    "Bukayo Saka":          {"type": "INSP", "ei": 45, "sn": 60, "tf": 55, "jp": 20, "comp": 8, "coach": 9},
    "Lamine Yamal":         {"type": "IXSP", "ei": 25, "sn": 85, "tf": 55, "jp": 15, "comp": 8, "coach": 8},
    "Vinícius Júnior":      {"type": "IXLC", "ei": 25, "sn": 80, "tf": 35, "jp": 85, "comp": 9, "coach": 5},
    "Kylian Mbappé":        {"type": "AXLC", "ei": 25, "sn": 75, "tf": 35, "jp": 80, "comp": 10, "coach": 6},
    "Phil Foden":           {"type": "IXSP", "ei": 30, "sn": 80, "tf": 55, "jp": 15, "comp": 7, "coach": 8},
    "Ousmane Dembélé":      {"type": "IXSC", "ei": 25, "sn": 85, "tf": 55, "jp": 75, "comp": 6, "coach": 4},
    "Raphinha":             {"type": "INLC", "ei": 40, "sn": 65, "tf": 35, "jp": 80, "comp": 8, "coach": 7},
    "Bernardo Silva":       {"type": "ANSP", "ei": 75, "sn": 25, "tf": 55, "jp": 15, "comp": 8, "coach": 9},
    "Kenan Yıldız":         {"type": "IXSP", "ei": 30, "sn": 75, "tf": 55, "jp": 20, "comp": 7, "coach": 8},
    "Mohamed Salah":        {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 70, "comp": 9, "coach": 7},
    "Son Heung-min":        {"type": "INSP", "ei": 40, "sn": 65, "tf": 55, "jp": 20, "comp": 8, "coach": 9},
    "Leroy Sané":           {"type": "IXSC", "ei": 30, "sn": 75, "tf": 55, "jp": 65, "comp": 6, "coach": 6},
    "Khvicha Kvaratskhelia": {"type": "IXSC", "ei": 30, "sn": 80, "tf": 55, "jp": 70, "comp": 8, "coach": 7},
    "Marcus Rashford":      {"type": "IXSC", "ei": 30, "sn": 70, "tf": 55, "jp": 65, "comp": 5, "coach": 5},
    "Nico Williams":        {"type": "IXSP", "ei": 30, "sn": 80, "tf": 55, "jp": 20, "comp": 7, "coach": 8},
    "Alejandro Garnacho":   {"type": "IXLC", "ei": 25, "sn": 80, "tf": 35, "jp": 80, "comp": 8, "coach": 6},
    "Jaidon Anthony":       {"type": "ANSP", "ei": 65, "sn": 30, "tf": 55, "jp": 25, "comp": 6, "coach": 8},

    # ── Centre Forwards ──
    "Erling Haaland":       {"type": "INSC", "ei": 40, "sn": 70, "tf": 55, "jp": 75, "comp": 10, "coach": 7},
    "Harry Kane":           {"type": "INLP", "ei": 40, "sn": 65, "tf": 35, "jp": 20, "comp": 9, "coach": 9},
    "Viktor Gyökeres":      {"type": "INSC", "ei": 40, "sn": 70, "tf": 55, "jp": 70, "comp": 9, "coach": 8},
    "Alexander Isak":       {"type": "IXSP", "ei": 30, "sn": 75, "tf": 55, "jp": 20, "comp": 7, "coach": 8},
    "Victor Osimhen":       {"type": "INLC", "ei": 40, "sn": 70, "tf": 35, "jp": 80, "comp": 9, "coach": 6},
    "Julián Álvarez":       {"type": "INSP", "ei": 45, "sn": 60, "tf": 55, "jp": 20, "comp": 8, "coach": 9},
    "Lautaro Martínez":     {"type": "INLC", "ei": 40, "sn": 65, "tf": 35, "jp": 80, "comp": 9, "coach": 7},
    "Antoine Griezmann":    {"type": "ANSP", "ei": 70, "sn": 30, "tf": 55, "jp": 20, "comp": 8, "coach": 9},
    "Kai Havertz":          {"type": "AXSP", "ei": 30, "sn": 70, "tf": 55, "jp": 20, "comp": 6, "coach": 7},
    "Ollie Watkins":        {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 70, "comp": 8, "coach": 8},
    "Diogo Jota":           {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 70, "comp": 8, "coach": 8},
    "Randal Kolo Muani":    {"type": "AXSP", "ei": 30, "sn": 70, "tf": 55, "jp": 25, "comp": 6, "coach": 7},
    "Jørgen Strand Larsen": {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 65, "comp": 8, "coach": 8},
    "Davis Keillor-Dunn":   {"type": "INSC", "ei": 40, "sn": 65, "tf": 55, "jp": 65, "comp": 7, "coach": 7},
}


def main():
    print("32 — DOF Deep Profiling (Seed Players)")

    conn = psycopg2.connect(POSTGRES_DSN)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Get seed player names
    with open("14_seed_profiles.py", "r") as f:
        content = f.read()
    names = re.findall(r"# ─+\s+\d+\.\s+(.+?)\s+─+", content)
    print(f"  {len(names)} seed players in script")

    # Resolve IDs
    placeholders = ",".join(["%s"] * len(names))
    cur.execute(
        f"SELECT id, name FROM people WHERE name IN ({placeholders})",
        names,
    )
    name_to_id: dict[str, int] = {}
    for row in cur.fetchall():
        # Prefer higher ID (more recent) if duplicates
        if row["name"] not in name_to_id or row["id"] > name_to_id[row["name"]]:
            name_to_id[row["name"]] = row["id"]
    print(f"  {len(name_to_id)} found in DB")

    # ── Apply pursuit status ──────────────────────────────────────────────
    pursuit_updates = 0
    for name, status in PURSUIT_MAP.items():
        pid = name_to_id.get(name)
        if not pid:
            continue
        # Ensure player_status row exists
        cur.execute(
            "INSERT INTO player_status (person_id) VALUES (%s) ON CONFLICT DO NOTHING",
            (pid,),
        )
        cur.execute(
            "UPDATE player_status SET pursuit_status = %s WHERE person_id = %s AND (pursuit_status IS NULL OR pursuit_status != %s)",
            (status, pid, status),
        )
        if cur.rowcount > 0:
            pursuit_updates += 1

    print(f"  Pursuit status updates: {pursuit_updates}")

    # ── Apply personality profiles ────────────────────────────────────────
    personality_updates = 0
    for name, p in PERSONALITY_MAP.items():
        pid = name_to_id.get(name)
        if not pid:
            continue
        cur.execute("""
            INSERT INTO player_personality (person_id, ei, sn, tf, jp, competitiveness, coachability)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (person_id) DO UPDATE SET
                ei = EXCLUDED.ei, sn = EXCLUDED.sn, tf = EXCLUDED.tf, jp = EXCLUDED.jp,
                competitiveness = EXCLUDED.competitiveness, coachability = EXCLUDED.coachability
        """, (pid, p["ei"], p["sn"], p["tf"], p["jp"], p["comp"], p["coach"]))
        personality_updates += 1

    print(f"  Personality profiles: {personality_updates}")

    if args.dry_run:
        print("\n--dry-run: no writes.")
        conn.rollback()
    else:
        conn.commit()
        print(f"\n  Done. {pursuit_updates} pursuit + {personality_updates} personality updates committed.")

    conn.close()


if __name__ == "__main__":
    main()
