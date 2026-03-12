"""
14_seed_profiles.py — Seed all 98 Chief Scout player profiles into Supabase.

Codifies 98 profiles across all positions (GK, CD, WD, DM, CM, WM, AM, WF, CF).
Inserts into: people, player_profiles, player_personality, player_market,
              player_status, attribute_grades.

Usage:
    python pipeline/14_seed_profiles.py [--dry-run]
"""
from __future__ import annotations

import sys
import psycopg2
from psycopg2.extras import execute_values

from config import POSTGRES_DSN

DRY_RUN = "--dry-run" in sys.argv

# ── Player definitions ───────────────────────────────────────────────────────
# Each player is a dict with keys matching the target tables.
# Attribute grades use the 0-16 scout scale.
# Personality: ei/sn/tf/jp on 0-100 scale.
#   ei >= 50 → Analytical(A), < 50 → Instinctive(I)
#   sn >= 50 → Extrinsic(X),  < 50 → Intrinsic(N)
#   tf >= 50 → Soloist(S),    < 50 → Leader(L)
#   jp >= 50 → Competitor(C), < 50 → Composer(P)

PLAYERS = [
    # ─── 1. Kevin De Bruyne ─────────────────────────────────────────────
    {
        "person": {
            "name": "Kevin De Bruyne",
            "dob": "1991-06-28",
            "height_cm": 181,
            "preferred_foot": "Right",
            "nation": "Belgium",
            "club": "Manchester City",
        },
        "profile": {
            "position": "CM",
            "level": 86,
            "overall": 91,
            "archetype": "Controller-Creator",
            "blueprint": "Maestro",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 78, "sn": 25, "tf": 30, "jp": 72,
            "competitiveness": 9, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 2, "market_premium": -2,
            "scarcity_score": 95, "transfer_fee_eur": 120000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Generational playmaker. Vision, passing range, and creativity at the absolute "
                "peak of the sport. Engine has declined post-30 but brain compensates. "
                "Injury record a concern — hamstring and knee issues recurring since 2022. "
                "Contract winding down. Benchmark profile for Controller-Creator archetype. "
                "Not acquirable — legacy player at Man City."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (16, "High"),
            "skills": (14, "High"), "take_ons": (12, "Medium"),
            "pass_accuracy": (16, "High"), "crossing": (14, "High"),
            "pass_range": (16, "High"), "through_balls": (16, "High"),
            "awareness": (16, "High"), "discipline": (14, "High"),
            "interceptions": (12, "Medium"), "positioning": (14, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (13, "Medium"), "pressing": (14, "High"),
            "stamina": (12, "Medium"), "versatility": (14, "High"),
            "acceleration": (12, "Medium"), "balance": (13, "Medium"),
            "movement": (15, "High"), "pace": (12, "Medium"),
            "aggression": (12, "Medium"), "duels": (11, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (13, "Medium"),
        },
    },

    # ─── 2. Alisson Becker ──────────────────────────────────────────────
    {
        "person": {
            "name": "Alisson Becker",
            "dob": "1992-10-02",
            "height_cm": 191,
            "preferred_foot": "Right",
            "nation": "Brazil",
            "club": "Liverpool",
        },
        "profile": {
            "position": "GK",
            "level": 88,
            "overall": 90,
            "archetype": "GK-Controller",
            "blueprint": "Complete Keeper",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 70, "sn": 30, "tf": 35, "jp": 65,
            "competitiveness": 8, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 0,
            "scarcity_score": 90, "transfer_fee_eur": 100000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Elite shot-stopper with exceptional distribution. Sweeper-keeper range "
                "among the best in the world. Command of area and composure under pressure "
                "set the standard. Age 32 — still performing at peak. "
                "Benchmark for GK-Controller archetype. Not acquirable."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (10, "Low"), "first_touch": (14, "High"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (15, "High"), "crossing": (10, "Low"),
            "pass_range": (15, "High"), "through_balls": (10, "Low"),
            "awareness": (16, "High"), "discipline": (15, "High"),
            "interceptions": (13, "Medium"), "positioning": (16, "High"),
            "blocking": (15, "High"), "clearances": (14, "High"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (12, "Medium"), "pressing": (10, "Low"),
            "stamina": (12, "Medium"), "versatility": (10, "Low"),
            "acceleration": (13, "Medium"), "balance": (14, "High"),
            "movement": (14, "High"), "pace": (12, "Medium"),
            "aggression": (12, "Medium"), "duels": (13, "Medium"),
            "shielding": (10, "Low"), "throwing": (15, "High"),
            "aerial_duels": (16, "High"), "heading": (12, "Medium"),
            "jumping": (15, "High"), "volleys": (10, "Low"),
        },
    },

    # ─── 3. Lamine Yamal ───────────────────────────────────────────────
    {
        "person": {
            "name": "Lamine Yamal",
            "dob": "2007-07-13",
            "height_cm": 180,
            "preferred_foot": "Left",
            "nation": "Spain",
            "club": "Barcelona",
        },
        "profile": {
            "position": "WF",
            "level": 91,
            "overall": 88,
            "archetype": "Dribbler-Creator",
            "blueprint": "Wizard",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 40, "sn": 30, "tf": 55, "jp": 45,
            "competitiveness": 9, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 5,
            "scarcity_score": 99, "transfer_fee_eur": 200000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Generational talent. Already a Euro 2024 best young player at 16. "
                "Electric dribbler with elite vision for his age. Left foot is devastating "
                "from the right channel. First touch, close control, and decision-making "
                "all way beyond his years. Benchmark for Dribbler-Creator archetype. "
                "Not acquirable — Barcelona cornerstone."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (15, "High"), "first_touch": (16, "High"),
            "skills": (15, "High"), "take_ons": (16, "High"),
            "pass_accuracy": (14, "High"), "crossing": (14, "High"),
            "pass_range": (13, "Medium"), "through_balls": (15, "High"),
            "awareness": (14, "High"), "discipline": (12, "Medium"),
            "interceptions": (10, "Low"), "positioning": (12, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (13, "Medium"), "pressing": (13, "Medium"),
            "stamina": (13, "Medium"), "versatility": (12, "Medium"),
            "acceleration": (16, "High"), "balance": (15, "High"),
            "movement": (15, "High"), "pace": (15, "High"),
            "aggression": (11, "Medium"), "duels": (11, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (11, "Medium"),
        },
    },

    # ─── 4. Casemiro ───────────────────────────────────────────────────
    {
        "person": {
            "name": "Casemiro",
            "dob": "1992-02-23",
            "height_cm": 185,
            "preferred_foot": "Right",
            "nation": "Brazil",
            "club": "Manchester United",
        },
        "profile": {
            "position": "DM",
            "level": 84,
            "overall": 78,
            "archetype": "Destroyer-Cover",
            "blueprint": "Anchor",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 72, "sn": 40, "tf": 30, "jp": 75,
            "competitiveness": 9, "coachability": 9,
        },
        "market": {
            "market_value_tier": 4, "true_mvt": 5, "market_premium": -5,
            "scarcity_score": 15, "transfer_fee_eur": 60000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Five-time Champions League winner at Real Madrid. Elite reading of the game "
                "and positional intelligence remain, but physical decline is severe. "
                "Pace, recovery speed, and stamina all visibly diminished since 2023. "
                "High-profile errors increasing in frequency. At 33, contract is a burden. "
                "Verdict: Pass — the player who won those titles no longer exists at this level."
            ),
            "squad_role": "rotation",
        },
        "attributes": {
            "carries": (10, "Medium"), "first_touch": (12, "Medium"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (13, "Medium"), "crossing": (10, "Low"),
            "pass_range": (13, "Medium"), "through_balls": (10, "Low"),
            "awareness": (15, "High"), "discipline": (14, "High"),
            "interceptions": (14, "High"), "positioning": (15, "High"),
            "blocking": (14, "High"), "clearances": (14, "High"),
            "marking": (14, "High"), "tackling": (14, "High"),
            "intensity": (11, "Medium"), "pressing": (11, "Medium"),
            "stamina": (10, "Medium"), "versatility": (10, "Low"),
            "acceleration": (10, "Medium"), "balance": (11, "Medium"),
            "movement": (12, "Medium"), "pace": (10, "Medium"),
            "aggression": (14, "High"), "duels": (14, "High"),
            "shielding": (14, "High"), "throwing": (10, "Low"),
            "aerial_duels": (14, "High"), "heading": (13, "Medium"),
            "jumping": (13, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 5. Rodri ──────────────────────────────────────────────────────
    {
        "person": {
            "name": "Rodri",
            "dob": "1996-06-22",
            "height_cm": 191,
            "preferred_foot": "Right",
            "nation": "Spain",
            "club": "Manchester City",
        },
        "profile": {
            "position": "DM",
            "level": 88,
            "overall": 92,
            "archetype": "Controller-Destroyer",
            "blueprint": "Conductor",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 75, "sn": 30, "tf": 35, "jp": 70,
            "competitiveness": 9, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 3,
            "scarcity_score": 98, "transfer_fee_eur": 120000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "2024 Ballon d'Or winner. The benchmark DM in world football. "
                "Combines elite passing, game-reading, and defensive positioning. "
                "ACL injury in Sept 2024 — recovery timeline into 2025-26. "
                "Man City's record without him tells the story. "
                "Benchmark for Controller-Destroyer archetype. Not acquirable."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (15, "High"),
            "skills": (11, "Medium"), "take_ons": (11, "Medium"),
            "pass_accuracy": (16, "High"), "crossing": (11, "Medium"),
            "pass_range": (16, "High"), "through_balls": (14, "High"),
            "awareness": (16, "High"), "discipline": (16, "High"),
            "interceptions": (15, "High"), "positioning": (16, "High"),
            "blocking": (14, "High"), "clearances": (13, "Medium"),
            "marking": (14, "High"), "tackling": (15, "High"),
            "intensity": (14, "High"), "pressing": (15, "High"),
            "stamina": (14, "High"), "versatility": (13, "Medium"),
            "acceleration": (12, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (11, "Medium"),
            "aggression": (13, "Medium"), "duels": (14, "High"),
            "shielding": (14, "High"), "throwing": (10, "Low"),
            "aerial_duels": (14, "High"), "heading": (13, "Medium"),
            "jumping": (13, "Medium"), "volleys": (11, "Medium"),
        },
    },

    # ─── 6. Achraf Hakimi ──────────────────────────────────────────────
    {
        "person": {
            "name": "Achraf Hakimi",
            "dob": "1998-11-04",
            "height_cm": 181,
            "preferred_foot": "Right",
            "nation": "Morocco",
            "club": "PSG",
        },
        "profile": {
            "position": "WD",
            "level": 90,
            "overall": 86,
            "archetype": "Sprinter-Engine",
            "blueprint": "Flanker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 55, "sn": 55, "tf": 55, "jp": 65,
            "competitiveness": 8, "coachability": 7,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 1,
            "scarcity_score": 88, "transfer_fee_eur": 60000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Elite attacking RB/RWB. Blistering pace and relentless engine — "
                "covers more ground than almost any defender in Europe. "
                "Excellent final-third output for a fullback. Defensively improved under "
                "Luis Enrique. Benchmark for Sprinter-Engine archetype at WD position. "
                "Not acquirable — PSG cornerstone, contract to 2026."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (13, "Medium"),
            "skills": (12, "Medium"), "take_ons": (14, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (14, "High"),
            "pass_range": (11, "Medium"), "through_balls": (11, "Medium"),
            "awareness": (13, "Medium"), "discipline": (12, "Medium"),
            "interceptions": (13, "Medium"), "positioning": (12, "Medium"),
            "blocking": (12, "Medium"), "clearances": (12, "Medium"),
            "marking": (12, "Medium"), "tackling": (13, "Medium"),
            "intensity": (15, "High"), "pressing": (14, "High"),
            "stamina": (15, "High"), "versatility": (13, "Medium"),
            "acceleration": (16, "High"), "balance": (14, "High"),
            "movement": (14, "High"), "pace": (16, "High"),
            "aggression": (13, "Medium"), "duels": (13, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (11, "Low"), "heading": (10, "Low"),
            "jumping": (11, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 7. Jordan Pickford ────────────────────────────────────────────
    {
        "person": {
            "name": "Jordan Pickford",
            "dob": "1994-03-07",
            "height_cm": 185,
            "preferred_foot": "Left",
            "nation": "England",
            "club": "Everton",
        },
        "profile": {
            "position": "GK",
            "level": 88,
            "overall": 85,
            "archetype": "GK-Controller",
            "blueprint": "Shotstopper",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 35, "sn": 60, "tf": 55, "jp": 60,
            "competitiveness": 8, "coachability": 6,
        },
        "market": {
            "market_value_tier": 3, "true_mvt": 3, "market_premium": -1,
            "scarcity_score": 40, "transfer_fee_eur": 25000000, "hg": True,
        },
        "status": {
            "pursuit_status": "Monitor",
            "scouting_notes": (
                "England no.1. Elite shot-stopping reflexes. Distribution with feet is "
                "above average for a PL keeper. Occasional lapses in concentration and "
                "temperament — has improved significantly in recent seasons. "
                "At 31, still in his prime window. HG-qualified. "
                "Monitor — potential value signing if Everton's financial situation forces a sale."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (10, "Low"), "first_touch": (12, "Medium"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (13, "Medium"), "crossing": (10, "Low"),
            "pass_range": (13, "Medium"), "through_balls": (10, "Low"),
            "awareness": (14, "High"), "discipline": (12, "Medium"),
            "interceptions": (11, "Medium"), "positioning": (14, "High"),
            "blocking": (15, "High"), "clearances": (13, "Medium"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (12, "Medium"), "pressing": (10, "Low"),
            "stamina": (12, "Medium"), "versatility": (10, "Low"),
            "acceleration": (13, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (12, "Medium"),
            "aggression": (13, "Medium"), "duels": (12, "Medium"),
            "shielding": (10, "Low"), "throwing": (14, "High"),
            "aerial_duels": (14, "High"), "heading": (11, "Medium"),
            "jumping": (14, "High"), "volleys": (10, "Low"),
        },
    },

    # ─── 8. Victor Osimhen ─────────────────────────────────────────────
    {
        "person": {
            "name": "Victor Osimhen",
            "dob": "1998-12-29",
            "height_cm": 186,
            "preferred_foot": "Right",
            "nation": "Nigeria",
            "club": "Galatasaray",
        },
        "profile": {
            "position": "CF",
            "level": 87,
            "overall": 87,
            "archetype": "Striker-Sprinter",
            "blueprint": "Colossus",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 35, "sn": 55, "tf": 60, "jp": 70,
            "competitiveness": 9, "coachability": 6,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 2, "market_premium": 3,
            "scarcity_score": 80, "transfer_fee_eur": 75000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Scout Further",
            "scouting_notes": (
                "Elite centre-forward. Explosive pace and aerial power — classic No.9. "
                "Serie A title winner at Napoli 2022-23 (26 goals). Loan at Galatasaray "
                "has been prolific. Release clause and wage demands complicate any deal. "
                "Character concerns — past disciplinary issues and dressing room friction. "
                "Scout further — elite talent but risk-reward profile needs careful assessment."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (12, "Medium"), "first_touch": (13, "Medium"),
            "skills": (11, "Medium"), "take_ons": (12, "Medium"),
            "pass_accuracy": (11, "Medium"), "crossing": (10, "Low"),
            "pass_range": (10, "Low"), "through_balls": (10, "Low"),
            "awareness": (13, "Medium"), "discipline": (11, "Medium"),
            "interceptions": (10, "Low"), "positioning": (14, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (14, "High"), "pressing": (15, "High"),
            "stamina": (14, "High"), "versatility": (10, "Low"),
            "acceleration": (16, "High"), "balance": (13, "Medium"),
            "movement": (16, "High"), "pace": (15, "High"),
            "aggression": (14, "High"), "duels": (14, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (15, "High"), "heading": (15, "High"),
            "jumping": (15, "High"), "volleys": (11, "Medium"),
        },
    },

    # ─── 9. Jørgen Strand Larsen ───────────────────────────────────────
    {
        "person": {
            "name": "Jørgen Strand Larsen",
            "dob": "2000-02-06",
            "height_cm": 193,
            "preferred_foot": "Right",
            "nation": "Norway",
            "club": "Crystal Palace",
        },
        "profile": {
            "position": "CF",
            "level": 84,
            "overall": 82,
            "archetype": "Striker-Target",
            "blueprint": "Target Man",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 40, "sn": 35, "tf": 40, "jp": 60,
            "competitiveness": 8, "coachability": 8,
        },
        "market": {
            "market_value_tier": 2, "true_mvt": 2, "market_premium": 1,
            "scarcity_score": 65, "transfer_fee_eur": 30000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Scout Further",
            "scouting_notes": (
                "6ft 4in target forward with surprising technical quality for his frame. "
                "Prolific at Celta Vigo — 13 goals in 2023-24 La Liga. "
                "Excellent aerial presence and hold-up play. Work rate is outstanding — "
                "presses from the front relentlessly. First touch is better than expected. "
                "PL adaptation still being assessed at Crystal Palace. "
                "Scout further — could be a genuine PL No.9 if adaptation goes well."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (11, "Medium"), "first_touch": (13, "Medium"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (12, "Medium"), "crossing": (10, "Low"),
            "pass_range": (10, "Low"), "through_balls": (10, "Low"),
            "awareness": (12, "Medium"), "discipline": (12, "Medium"),
            "interceptions": (10, "Low"), "positioning": (14, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (14, "High"), "pressing": (14, "High"),
            "stamina": (14, "High"), "versatility": (10, "Low"),
            "acceleration": (12, "Medium"), "balance": (12, "Medium"),
            "movement": (13, "Medium"), "pace": (12, "Medium"),
            "aggression": (14, "High"), "duels": (14, "High"),
            "shielding": (14, "High"), "throwing": (10, "Low"),
            "aerial_duels": (16, "High"), "heading": (15, "High"),
            "jumping": (15, "High"), "volleys": (12, "Medium"),
        },
    },

    # ─── 10. Ousmane Dembélé ───────────────────────────────────────────
    {
        "person": {
            "name": "Ousmane Dembélé",
            "dob": "1997-05-15",
            "height_cm": 178,
            "preferred_foot": "Both",
            "nation": "France",
            "club": "PSG",
        },
        "profile": {
            "position": "WF",
            "level": 92,
            "overall": 87,
            "archetype": "Dribbler-Sprinter",
            "blueprint": "Wizard",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 30, "sn": 55, "tf": 60, "jp": 35,
            "competitiveness": 6, "coachability": 5,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": -1,
            "scarcity_score": 75, "transfer_fee_eur": 80000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Mercurial two-footed winger with elite dribbling and pace. "
                "Decision-making remains inconsistent — final ball quality fluctuates. "
                "Injury history at Barcelona was alarming; has been healthier at PSG. "
                "Luis Enrique has imposed more tactical discipline. "
                "Benchmark for Dribbler-Sprinter archetype. Not acquirable."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (15, "High"), "first_touch": (14, "High"),
            "skills": (16, "High"), "take_ons": (16, "High"),
            "pass_accuracy": (12, "Medium"), "crossing": (13, "Medium"),
            "pass_range": (11, "Medium"), "through_balls": (13, "Medium"),
            "awareness": (12, "Medium"), "discipline": (10, "Medium"),
            "interceptions": (10, "Low"), "positioning": (11, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (13, "Medium"), "pressing": (12, "Medium"),
            "stamina": (13, "Medium"), "versatility": (13, "Medium"),
            "acceleration": (16, "High"), "balance": (15, "High"),
            "movement": (14, "High"), "pace": (16, "High"),
            "aggression": (10, "Low"), "duels": (10, "Low"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (11, "Medium"),
        },
    },

    # ─── 11. Maghnes Akliouche ─────────────────────────────────────────
    {
        "person": {
            "name": "Maghnes Akliouche",
            "dob": "2002-02-25",
            "height_cm": 175,
            "preferred_foot": "Right",
            "nation": "France",
            "club": "Monaco",
        },
        "profile": {
            "position": "WF",
            "level": 85,
            "overall": 80,
            "archetype": "Creator-Dribbler",
            "blueprint": "Playmaker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 35, "sn": 30, "tf": 45, "jp": 40,
            "competitiveness": 7, "coachability": 8,
        },
        "market": {
            "market_value_tier": 2, "true_mvt": 2, "market_premium": 2,
            "scarcity_score": 72, "transfer_fee_eur": 35000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Interested",
            "scouting_notes": (
                "Elegant creative winger with excellent close control and vision. "
                "Comfortable across RW and AM. Progressing well at Monaco — "
                "increasing G+A output season on season. France U21 regular. "
                "Good dribbling in tight spaces, intelligent movement off the ball. "
                "Verdict: Scout Further → Sign — fits our Creator-Dribbler need, "
                "acquirable at reasonable price."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "Medium"), "first_touch": (14, "High"),
            "skills": (14, "High"), "take_ons": (14, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (12, "Medium"),
            "pass_range": (12, "Medium"), "through_balls": (13, "Medium"),
            "awareness": (13, "Medium"), "discipline": (12, "Medium"),
            "interceptions": (10, "Low"), "positioning": (12, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (13, "Medium"), "pressing": (12, "Medium"),
            "stamina": (13, "Medium"), "versatility": (13, "Medium"),
            "acceleration": (14, "High"), "balance": (14, "High"),
            "movement": (13, "Medium"), "pace": (13, "Medium"),
            "aggression": (10, "Low"), "duels": (11, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (11, "Medium"),
        },
    },

    # ─── 12. Nico Paz ──────────────────────────────────────────────────
    {
        "person": {
            "name": "Nico Paz",
            "dob": "2004-01-09",
            "height_cm": 178,
            "preferred_foot": "Left",
            "nation": "Argentina",
            "club": "Como",
        },
        "profile": {
            "position": "AM",
            "level": 85,
            "overall": 79,
            "archetype": "Creator-Controller",
            "blueprint": "Playmaker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 40, "sn": 25, "tf": 40, "jp": 35,
            "competitiveness": 7, "coachability": 8,
        },
        "market": {
            "market_value_tier": 2, "true_mvt": 2, "market_premium": 3,
            "scarcity_score": 70, "transfer_fee_eur": 25000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Monitor",
            "scouting_notes": (
                "Real Madrid academy product on loan at Como. Left-footed No.10 "
                "with excellent vision and weight of pass. Composure beyond his years. "
                "Strong first half of 2025-26 in Serie A has raised his stock. "
                "Real Madrid buyback clause likely — limits acquirability. "
                "Monitor — elite ceiling but acquisition path blocked."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (15, "High"),
            "skills": (13, "Medium"), "take_ons": (12, "Medium"),
            "pass_accuracy": (14, "High"), "crossing": (12, "Medium"),
            "pass_range": (14, "High"), "through_balls": (15, "High"),
            "awareness": (14, "High"), "discipline": (12, "Medium"),
            "interceptions": (10, "Low"), "positioning": (12, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (11, "Medium"), "pressing": (11, "Medium"),
            "stamina": (12, "Medium"), "versatility": (11, "Medium"),
            "acceleration": (12, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (11, "Medium"),
            "aggression": (10, "Low"), "duels": (10, "Low"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (12, "Medium"),
        },
    },

    # ─── 13. Randal Kolo Muani ─────────────────────────────────────────
    {
        "person": {
            "name": "Randal Kolo Muani",
            "dob": "1998-12-05",
            "height_cm": 187,
            "preferred_foot": "Right",
            "nation": "France",
            "club": "Tottenham Hotspur",
        },
        "profile": {
            "position": "CF",
            "level": 82,
            "overall": 82,
            "archetype": "Sprinter-Engine",
            "blueprint": "Runner",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 45, "sn": 35, "tf": 45, "jp": 55,
            "competitiveness": 7, "coachability": 7,
        },
        "market": {
            "market_value_tier": 2, "true_mvt": 3, "market_premium": -2,
            "scarcity_score": 45, "transfer_fee_eur": 60000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Scout Further",
            "scouting_notes": (
                "Athletic, high-IQ forward with excellent movement in the box. "
                "Outstanding pressing intensity — Eintracht Frankfurt version was electric. "
                "PSG spell has been disappointing — limited minutes, confidence down. "
                "Loan to Spurs to rebuild. Versatile across the front line. "
                "Scout further — talent is clear but PSG chapter raises questions."
            ),
            "squad_role": "rotation",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (13, "Medium"),
            "skills": (11, "Medium"), "take_ons": (12, "Medium"),
            "pass_accuracy": (12, "Medium"), "crossing": (10, "Low"),
            "pass_range": (10, "Low"), "through_balls": (11, "Medium"),
            "awareness": (13, "Medium"), "discipline": (12, "Medium"),
            "interceptions": (10, "Low"), "positioning": (13, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (15, "High"), "pressing": (15, "High"),
            "stamina": (14, "High"), "versatility": (13, "Medium"),
            "acceleration": (15, "High"), "balance": (13, "Medium"),
            "movement": (14, "High"), "pace": (15, "High"),
            "aggression": (12, "Medium"), "duels": (13, "Medium"),
            "shielding": (12, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (13, "Medium"), "heading": (12, "Medium"),
            "jumping": (13, "Medium"), "volleys": (11, "Medium"),
        },
    },

    # ─── 14. Jaidon Anthony ────────────────────────────────────────────
    {
        "person": {
            "name": "Jaidon Anthony",
            "dob": "1999-01-01",
            "height_cm": 175,
            "preferred_foot": "Right",
            "nation": "England",
            "club": "Burnley",
        },
        "profile": {
            "position": "WF",
            "level": 83,
            "overall": 75,
            "archetype": "Sprinter-Dribbler",
            "blueprint": "Flanker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 40, "sn": 40, "tf": 45, "jp": 45,
            "competitiveness": 7, "coachability": 7,
        },
        "market": {
            "market_value_tier": 4, "true_mvt": 4, "market_premium": 0,
            "scarcity_score": 25, "transfer_fee_eur": 5000000, "hg": True,
        },
        "status": {
            "pursuit_status": "Scout Further",
            "scouting_notes": (
                "Quick, direct left winger who takes defenders on. "
                "Good Championship output — contributed to Bournemouth promotion. "
                "Loan at Burnley to prove PL readiness. HG-qualified. "
                "Lacks end product consistency — final ball and finishing need improvement. "
                "Scout further — value proposition at his price point is interesting."
            ),
            "squad_role": "rotation",
        },
        "attributes": {
            "carries": (12, "Medium"), "first_touch": (12, "Medium"),
            "skills": (12, "Medium"), "take_ons": (13, "Medium"),
            "pass_accuracy": (11, "Medium"), "crossing": (11, "Medium"),
            "pass_range": (10, "Low"), "through_balls": (10, "Low"),
            "awareness": (11, "Medium"), "discipline": (11, "Medium"),
            "interceptions": (10, "Low"), "positioning": (11, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (13, "Medium"), "pressing": (12, "Medium"),
            "stamina": (13, "Medium"), "versatility": (11, "Medium"),
            "acceleration": (14, "High"), "balance": (13, "Medium"),
            "movement": (12, "Medium"), "pace": (14, "High"),
            "aggression": (11, "Medium"), "duels": (11, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (10, "Low"),
        },
    },

    # ─── 15. Zion Suzuki ──────────────────────────────────────────────
    {
        "person": {
            "name": "Zion Suzuki",
            "dob": "2002-08-21",
            "height_cm": 190,
            "preferred_foot": "Right",
            "nation": "Japan",
            "club": "Parma",
        },
        "profile": {
            "position": "GK",
            "level": 83,
            "overall": 79,
            "archetype": "GK-Controller",
            "blueprint": "Modern Keeper",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 55, "sn": 30, "tf": 40, "jp": 55,
            "competitiveness": 7, "coachability": 8,
        },
        "market": {
            "market_value_tier": 3, "true_mvt": 3, "market_premium": 2,
            "scarcity_score": 60, "transfer_fee_eur": 15000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Interested",
            "scouting_notes": (
                "Impressive young GK starting in Serie A at 23. Good shot-stopping "
                "and composure with the ball at feet. Distribution is above average. "
                "Parma relegation battle gives him valuable pressure experience. "
                "Japan international. Price point accessible. "
                "Verdict: Scout Further → Sign — strong GK prospect at value price."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (10, "Low"), "first_touch": (12, "Medium"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (13, "Medium"), "crossing": (10, "Low"),
            "pass_range": (13, "Medium"), "through_balls": (10, "Low"),
            "awareness": (13, "Medium"), "discipline": (13, "Medium"),
            "interceptions": (11, "Medium"), "positioning": (13, "Medium"),
            "blocking": (14, "High"), "clearances": (12, "Medium"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (11, "Medium"), "pressing": (10, "Low"),
            "stamina": (11, "Medium"), "versatility": (10, "Low"),
            "acceleration": (12, "Medium"), "balance": (12, "Medium"),
            "movement": (12, "Medium"), "pace": (11, "Medium"),
            "aggression": (11, "Medium"), "duels": (12, "Medium"),
            "shielding": (10, "Low"), "throwing": (13, "Medium"),
            "aerial_duels": (14, "High"), "heading": (11, "Medium"),
            "jumping": (14, "High"), "volleys": (10, "Low"),
        },
    },

    # ─── 16. Pau Cubarsí ──────────────────────────────────────────────
    {
        "person": {
            "name": "Pau Cubarsí",
            "dob": "2007-01-22",
            "height_cm": 182,
            "preferred_foot": "Right",
            "nation": "Spain",
            "club": "Barcelona",
        },
        "profile": {
            "position": "CD",
            "level": 84,
            "overall": 82,
            "archetype": "Cover-Passer",
            "blueprint": "Ball-Playing CB",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 72, "sn": 25, "tf": 35, "jp": 65,
            "competitiveness": 8, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 5,
            "scarcity_score": 95, "transfer_fee_eur": 100000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Extraordinary CB talent at 18. Reading of the game is elite for his age. "
                "Composure on the ball and progressive passing from deep are outstanding. "
                "Already a Spain international and Barcelona starter. "
                "Formal grading pending — archetype assessment based on match observation. "
                "Benchmark — not acquirable, Barcelona cornerstone."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (14, "High"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (15, "High"), "crossing": (10, "Low"),
            "pass_range": (14, "High"), "through_balls": (12, "Medium"),
            "awareness": (15, "High"), "discipline": (14, "High"),
            "interceptions": (14, "High"), "positioning": (15, "High"),
            "blocking": (13, "Medium"), "clearances": (14, "High"),
            "marking": (14, "High"), "tackling": (14, "High"),
            "intensity": (13, "Medium"), "pressing": (13, "Medium"),
            "stamina": (13, "Medium"), "versatility": (12, "Medium"),
            "acceleration": (13, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (13, "Medium"),
            "aggression": (12, "Medium"), "duels": (13, "Medium"),
            "shielding": (12, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (13, "Medium"), "heading": (12, "Medium"),
            "jumping": (12, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 17. João Neves ───────────────────────────────────────────────
    {
        "person": {
            "name": "João Neves",
            "dob": "2004-09-27",
            "height_cm": 174,
            "preferred_foot": "Right",
            "nation": "Portugal",
            "club": "PSG",
        },
        "profile": {
            "position": "CM",
            "level": 88,
            "overall": 84,
            "archetype": "Controller-Engine",
            "blueprint": "Conductor",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 65, "sn": 25, "tf": 35, "jp": 60,
            "competitiveness": 8, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 3,
            "scarcity_score": 85, "transfer_fee_eur": 70000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Outstanding young CM. Exceptional passing accuracy and press resistance. "
                "Relentless engine — covers immense ground while maintaining quality. "
                "Already a Portugal international and PSG regular at 21. "
                "Benfica product — technically refined. "
                "Benchmark for Controller-Engine archetype. Not acquirable."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (15, "High"),
            "skills": (12, "Medium"), "take_ons": (12, "Medium"),
            "pass_accuracy": (15, "High"), "crossing": (11, "Medium"),
            "pass_range": (14, "High"), "through_balls": (14, "High"),
            "awareness": (15, "High"), "discipline": (14, "High"),
            "interceptions": (14, "High"), "positioning": (14, "High"),
            "blocking": (12, "Medium"), "clearances": (11, "Medium"),
            "marking": (12, "Medium"), "tackling": (13, "Medium"),
            "intensity": (15, "High"), "pressing": (15, "High"),
            "stamina": (15, "High"), "versatility": (13, "Medium"),
            "acceleration": (13, "Medium"), "balance": (14, "High"),
            "movement": (14, "High"), "pace": (13, "Medium"),
            "aggression": (12, "Medium"), "duels": (12, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (11, "Medium"),
        },
    },

    # ─── 18. Declan Rice ───────────────────────────────────────────────
    {
        "person": {
            "name": "Declan Rice",
            "dob": "1999-01-14",
            "height_cm": 185,
            "preferred_foot": "Right",
            "nation": "England",
            "club": "Arsenal",
        },
        "profile": {
            "position": "CM",
            "level": 91,
            "overall": 88,
            "archetype": "Engine-Cover",
            "blueprint": "Driver",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 70, "sn": 40, "tf": 30, "jp": 70,
            "competitiveness": 9, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 2,
            "scarcity_score": 90, "transfer_fee_eur": 105000000, "hg": True,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Complete modern midfielder. Exceptional engine — covers every blade of grass. "
                "Defensive positioning and interception timing are elite. "
                "Has added goalscoring and progressive carrying under Arteta. "
                "England international, Arsenal's midfield anchor. "
                "Benchmark for Engine-Cover archetype. Not acquirable — £105m fee, long contract."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (14, "High"),
            "skills": (11, "Medium"), "take_ons": (12, "Medium"),
            "pass_accuracy": (14, "High"), "crossing": (11, "Medium"),
            "pass_range": (13, "Medium"), "through_balls": (12, "Medium"),
            "awareness": (15, "High"), "discipline": (15, "High"),
            "interceptions": (15, "High"), "positioning": (15, "High"),
            "blocking": (13, "Medium"), "clearances": (13, "Medium"),
            "marking": (13, "Medium"), "tackling": (14, "High"),
            "intensity": (16, "High"), "pressing": (15, "High"),
            "stamina": (16, "High"), "versatility": (14, "High"),
            "acceleration": (13, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (13, "Medium"),
            "aggression": (13, "Medium"), "duels": (14, "High"),
            "shielding": (14, "High"), "throwing": (10, "Low"),
            "aerial_duels": (13, "Medium"), "heading": (12, "Medium"),
            "jumping": (13, "Medium"), "volleys": (11, "Medium"),
        },
    },

    # ─── 19. Carlos Baleba ─────────────────────────────────────────────
    {
        "person": {
            "name": "Carlos Baleba",
            "dob": "2004-01-03",
            "height_cm": 185,
            "preferred_foot": "Right",
            "nation": "Cameroon",
            "club": "Brighton",
        },
        "profile": {
            "position": "DM",
            "level": 83,
            "overall": 78,
            "archetype": "Engine-Destroyer",
            "blueprint": "Ball Winner",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 45, "sn": 30, "tf": 40, "jp": 65,
            "competitiveness": 8, "coachability": 8,
        },
        "market": {
            "market_value_tier": 3, "true_mvt": 3, "market_premium": 2,
            "scarcity_score": 60, "transfer_fee_eur": 25000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Interested",
            "scouting_notes": (
                "Dynamic ball-winning midfielder. Exceptional intensity and work rate — "
                "presses relentlessly and wins the ball back in dangerous areas. "
                "Brighton development pathway proven (Caicedo, Bissouma). "
                "Technical quality on the ball is developing — not yet a Controller. "
                "At 21, upside is significant. Price point accessible. "
                "Verdict: Scout Further → Sign — fits Engine-Destroyer need."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (12, "Medium"), "first_touch": (12, "Medium"),
            "skills": (10, "Low"), "take_ons": (11, "Medium"),
            "pass_accuracy": (12, "Medium"), "crossing": (10, "Low"),
            "pass_range": (11, "Medium"), "through_balls": (10, "Low"),
            "awareness": (13, "Medium"), "discipline": (13, "Medium"),
            "interceptions": (14, "High"), "positioning": (13, "Medium"),
            "blocking": (13, "Medium"), "clearances": (12, "Medium"),
            "marking": (13, "Medium"), "tackling": (14, "High"),
            "intensity": (15, "High"), "pressing": (15, "High"),
            "stamina": (15, "High"), "versatility": (12, "Medium"),
            "acceleration": (13, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (13, "Medium"),
            "aggression": (14, "High"), "duels": (14, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (12, "Medium"), "heading": (11, "Medium"),
            "jumping": (12, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 20. Davis Keillor-Dunn ────────────────────────────────────────
    {
        "person": {
            "name": "Davis Keillor-Dunn",
            "dob": "1997-11-10",
            "height_cm": 180,
            "preferred_foot": "Right",
            "nation": "England",
            "club": "Wrexham",
        },
        "profile": {
            "position": "CF",
            "level": 74,
            "overall": 72,
            "archetype": "Striker-Creator",
            "blueprint": "Poacher",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 40, "sn": 45, "tf": 45, "jp": 50,
            "competitiveness": 7, "coachability": 7,
        },
        "market": {
            "market_value_tier": 5, "true_mvt": 5, "market_premium": 0,
            "scarcity_score": 15, "transfer_fee_eur": 1500000, "hg": True,
        },
        "status": {
            "pursuit_status": "Monitor",
            "scouting_notes": (
                "Championship striker with intelligent movement and creative link play. "
                "Good first touch and awareness for a forward at this level. "
                "Contributing to Wrexham's rise through the leagues. "
                "Ceiling likely Championship/lower PL. HG-qualified. "
                "Monitor — interesting archetype for squad depth at value price."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (11, "Medium"), "first_touch": (12, "Medium"),
            "skills": (11, "Medium"), "take_ons": (11, "Medium"),
            "pass_accuracy": (12, "Medium"), "crossing": (10, "Low"),
            "pass_range": (10, "Low"), "through_balls": (11, "Medium"),
            "awareness": (12, "Medium"), "discipline": (11, "Medium"),
            "interceptions": (10, "Low"), "positioning": (13, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (12, "Medium"), "pressing": (12, "Medium"),
            "stamina": (12, "Medium"), "versatility": (11, "Medium"),
            "acceleration": (12, "Medium"), "balance": (12, "Medium"),
            "movement": (13, "Medium"), "pace": (12, "Medium"),
            "aggression": (11, "Medium"), "duels": (11, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (11, "Medium"), "heading": (11, "Medium"),
            "jumping": (11, "Medium"), "volleys": (11, "Medium"),
        },
    },

    # ─── 21. Kenan Yıldız ─────────────────────────────────────────────
    {
        "person": {
            "name": "Kenan Yıldız",
            "dob": "2005-05-04",
            "height_cm": 176,
            "preferred_foot": "Left",
            "nation": "Turkey",
            "club": "Juventus",
        },
        "profile": {
            "position": "WF",
            "level": 86,
            "overall": 84,
            "archetype": "Creator-Dribbler",
            "blueprint": "No.10",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 35, "sn": 30, "tf": 55, "jp": 35,
            "competitiveness": 8, "coachability": 7,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 4,
            "scarcity_score": 90, "transfer_fee_eur": 135000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Juventus #10. Architecturally a No.10 deployed wide-left. "
                "Ceiling attributes: Spatial Awareness 8, Guile 8, First Touch 8, Long Range 8. "
                "Weak Foot 5/5 confirmed. Set Pieces 7. Clinical 6 — conversion trails finishing quality. "
                "2025-26: 9G 7A in 31 apps, FotMob 7.53. Derby della Mole solo goal, Derby d'Italia brace. "
                "One of the top three creative AM talents in Europe at his age. "
                "Benchmark — contract to 2029, not acquirable. Chief Scout Value: EUR120-150m."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "Medium"), "first_touch": (15, "High"),
            "skills": (14, "High"), "take_ons": (14, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (12, "Medium"),
            "pass_range": (13, "Medium"), "through_balls": (14, "High"),
            "awareness": (15, "High"), "discipline": (12, "Medium"),
            "interceptions": (10, "Low"), "positioning": (13, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (12, "Medium"), "pressing": (12, "Medium"),
            "stamina": (13, "Medium"), "versatility": (13, "Medium"),
            "acceleration": (14, "High"), "balance": (14, "High"),
            "movement": (14, "High"), "pace": (13, "Medium"),
            "aggression": (10, "Low"), "duels": (11, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (12, "Medium"),
        },
    },

    # ─── 22. Riccardo Calafiori ────────────────────────────────────────
    {
        "person": {
            "name": "Riccardo Calafiori",
            "dob": "2002-05-19",
            "height_cm": 188,
            "preferred_foot": "Left",
            "nation": "Italy",
            "club": "Arsenal",
        },
        "profile": {
            "position": "WD",
            "level": 85,
            "overall": 83,
            "archetype": "Passer-Cover",
            "blueprint": "Ball-Playing Fullback",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 72, "sn": 30, "tf": 35, "jp": 68,
            "competitiveness": 8, "coachability": 8,
        },
        "market": {
            "market_value_tier": 2, "true_mvt": 2, "market_premium": 1,
            "scarcity_score": 75, "transfer_fee_eur": 42000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Monitor",
            "scouting_notes": (
                "Ball-playing LCB/LB hybrid. Smooth progressive carrier — drives from deep "
                "with power and close control. Shields the ball exceptionally well under pressure. "
                "Strong in wide-channel defending. Aerial presence at 188cm unusual for a fullback. "
                "Passing range from deep is a standout trait. Still adapting to PL intensity. "
                "Arteta uses him as inverted LB and LCB in a back 3. Italy international — started Euro 2024. "
                "Verdict: Monitor — already at a top club, not available, but track development."
            ),
            "squad_role": "rotation",
        },
        "attributes": {
            "carries": (15, "High"), "first_touch": (14, "High"),
            "skills": (11, "Medium"), "take_ons": (12, "Medium"),
            "pass_accuracy": (15, "High"), "crossing": (13, "Medium"),
            "pass_range": (16, "High"), "through_balls": (12, "Medium"),
            "awareness": (15, "High"), "discipline": (14, "High"),
            "interceptions": (14, "Medium"), "positioning": (14, "High"),
            "blocking": (13, "Medium"), "clearances": (13, "Medium"),
            "marking": (13, "Medium"), "tackling": (14, "High"),
            "intensity": (14, "Medium"), "pressing": (13, "Medium"),
            "stamina": (14, "Medium"), "versatility": (16, "High"),
            "acceleration": (13, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (12, "Medium"),
            "aggression": (14, "High"), "duels": (14, "Medium"),
            "shielding": (16, "High"), "throwing": (10, "Low"),
            "aerial_duels": (15, "High"), "heading": (13, "Medium"),
            "jumping": (14, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 23. Ben Chilwell ─────────────────────────────────────────────
    {
        "person": {
            "name": "Ben Chilwell",
            "dob": "1996-12-21",
            "height_cm": 178,
            "preferred_foot": "Left",
            "nation": "England",
            "club": "Chelsea",
        },
        "profile": {
            "position": "WD",
            "level": 79,
            "overall": 74,
            "archetype": "Passer-Engine",
            "blueprint": "Attacking Fullback",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 65, "sn": 60, "tf": 40, "jp": 38,
            "competitiveness": 6, "coachability": 7,
        },
        "market": {
            "market_value_tier": 4, "true_mvt": 5, "market_premium": -2,
            "scarcity_score": 20, "transfer_fee_eur": 55800000, "hg": True,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Once a top-tier attacking LB — excellent crosser, intelligent runner. "
                "ACL tear (Nov 2021) was the turning point. Recurring knee issues have limited him "
                "to ~30 PL appearances across three seasons combined. At 29, physical decline "
                "from chronic injury is severe — pace, acceleration, and recovery all diminished. "
                "Chelsea looking to move him on. High wages, low suitors. "
                "England career effectively over. Verdict: Pass — too much injury risk."
            ),
            "squad_role": "surplus",
            "fitness_tag": "injury_prone",
            "contract_tag": "expiring",
        },
        "attributes": {
            "carries": (11, "Medium"), "first_touch": (13, "Medium"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (14, "Medium"), "crossing": (15, "High"),
            "pass_range": (13, "Medium"), "through_balls": (11, "Medium"),
            "awareness": (13, "Medium"), "discipline": (13, "Medium"),
            "interceptions": (12, "Low"), "positioning": (13, "Medium"),
            "blocking": (10, "Low"), "clearances": (11, "Low"),
            "marking": (11, "Low"), "tackling": (12, "Medium"),
            "intensity": (10, "Medium"), "pressing": (10, "Medium"),
            "stamina": (10, "Medium"), "versatility": (11, "Medium"),
            "acceleration": (10, "Medium"), "balance": (12, "Medium"),
            "movement": (13, "Medium"), "pace": (10, "Medium"),
            "aggression": (11, "Medium"), "duels": (11, "Low"),
            "shielding": (11, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (11, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (10, "Low"),
        },
    },

    # ─── 24. William Saliba ────────────────────────────────────────────
    {
        "person": {
            "name": "William Saliba",
            "dob": "2001-03-24",
            "height_cm": 192,
            "preferred_foot": "Right",
            "nation": "France",
            "club": "Arsenal",
        },
        "profile": {
            "position": "CD",
            "level": 88,
            "overall": 87,
            "archetype": "Cover-Destroyer",
            "blueprint": "Modern CB",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 68, "sn": 30, "tf": 40, "jp": 70,
            "competitiveness": 8, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 0,
            "scarcity_score": 90, "transfer_fee_eur": 90000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Watch",
            "scouting_notes": (
                "Elite ball-playing centre-back. Composed on the ball, aggressive in duels, "
                "excellent recovery pace for his frame. Cornerstone of Arsenal's title challenge. "
                "France international since 22. Still has ceiling to reach — could become "
                "the best CB in the Premier League."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (12, "Medium"), "first_touch": (13, "Medium"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (14, "High"), "crossing": (10, "Low"),
            "pass_range": (13, "Medium"), "through_balls": (10, "Low"),
            "awareness": (15, "High"), "discipline": (15, "High"),
            "interceptions": (15, "High"), "positioning": (15, "High"),
            "blocking": (14, "High"), "clearances": (14, "High"),
            "marking": (15, "High"), "tackling": (15, "High"),
            "intensity": (14, "High"), "pressing": (13, "Medium"),
            "stamina": (14, "High"), "versatility": (11, "Medium"),
            "acceleration": (13, "Medium"), "balance": (13, "Medium"),
            "movement": (12, "Medium"), "pace": (14, "High"),
            "aggression": (14, "High"), "duels": (15, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (15, "High"), "heading": (14, "High"),
            "jumping": (14, "High"), "volleys": (10, "Low"),
        },
    },

    # ─── 25. Ronald Araujo ─────────────────────────────────────────────
    {
        "person": {
            "name": "Ronald Araujo",
            "dob": "1999-03-07",
            "height_cm": 188,
            "preferred_foot": "Right",
            "nation": "Uruguay",
            "club": "Barcelona",
        },
        "profile": {
            "position": "CD",
            "level": 85,
            "overall": 85,
            "archetype": "Destroyer",
            "blueprint": "Aggressive CB",
            "profile_tier": 2,
        },
        "personality": {
            "ei": 45, "sn": 35, "tf": 60, "jp": 75,
            "competitiveness": 9, "coachability": 7,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 5,
            "scarcity_score": 80, "transfer_fee_eur": 70000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Interested",
            "scouting_notes": (
                "Physically dominant CB. Raw pace, aerial power, and aggression in duels "
                "make him a nightmare for strikers. On-ball game improving under Xavi/Flick. "
                "Injury record a concern — long-term hamstring issues. Versatile enough to "
                "play RB in emergencies. Uruguay captain material."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (11, "Medium"), "first_touch": (12, "Medium"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (13, "Medium"), "crossing": (10, "Low"),
            "pass_range": (12, "Medium"), "through_balls": (10, "Low"),
            "awareness": (14, "High"), "discipline": (13, "Medium"),
            "interceptions": (14, "High"), "positioning": (14, "High"),
            "blocking": (14, "High"), "clearances": (15, "High"),
            "marking": (14, "High"), "tackling": (15, "High"),
            "intensity": (14, "High"), "pressing": (13, "Medium"),
            "stamina": (14, "High"), "versatility": (12, "Medium"),
            "acceleration": (14, "High"), "balance": (13, "Medium"),
            "movement": (12, "Medium"), "pace": (15, "High"),
            "aggression": (15, "High"), "duels": (15, "High"),
            "shielding": (14, "High"), "throwing": (10, "Low"),
            "aerial_duels": (15, "High"), "heading": (14, "High"),
            "jumping": (15, "High"), "volleys": (10, "Low"),
        },
    },

    # ─── 26. Alessandro Bastoni ────────────────────────────────────────
    {
        "person": {
            "name": "Alessandro Bastoni",
            "dob": "1999-04-13",
            "height_cm": 190,
            "preferred_foot": "Left",
            "nation": "Italy",
            "club": "Inter Milan",
        },
        "profile": {
            "position": "CD",
            "level": 87,
            "overall": 87,
            "archetype": "Cover-Passer",
            "blueprint": "Progressor CB",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 65, "sn": 30, "tf": 35, "jp": 55,
            "competitiveness": 7, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 0,
            "scarcity_score": 92, "transfer_fee_eur": 80000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Watch",
            "scouting_notes": (
                "Left-footed ball-playing CB — rare profile. Progressive passing from deep is "
                "elite. Comfortable stepping into midfield with the ball. Key to Inter's "
                "three-at-the-back system. Italy regular. Underrated internationally due to "
                "Serie A visibility bias."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (14, "High"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (15, "High"), "crossing": (11, "Medium"),
            "pass_range": (14, "High"), "through_balls": (12, "Medium"),
            "awareness": (15, "High"), "discipline": (14, "High"),
            "interceptions": (14, "High"), "positioning": (14, "High"),
            "blocking": (13, "Medium"), "clearances": (14, "High"),
            "marking": (14, "High"), "tackling": (14, "High"),
            "intensity": (13, "Medium"), "pressing": (12, "Medium"),
            "stamina": (13, "Medium"), "versatility": (12, "Medium"),
            "acceleration": (12, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (12, "Medium"),
            "aggression": (12, "Medium"), "duels": (13, "Medium"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (14, "High"), "heading": (13, "Medium"),
            "jumping": (13, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 27. Josko Gvardiol ───────────────────────────────────────────
    {
        "person": {
            "name": "Josko Gvardiol",
            "dob": "2002-01-23",
            "height_cm": 185,
            "preferred_foot": "Left",
            "nation": "Croatia",
            "club": "Manchester City",
        },
        "profile": {
            "position": "CD",
            "level": 86,
            "overall": 85,
            "archetype": "Cover-Engine",
            "blueprint": "Hybrid Defender",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 55, "sn": 40, "tf": 45, "jp": 70,
            "competitiveness": 8, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 10,
            "scarcity_score": 95, "transfer_fee_eur": 90000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Watch",
            "scouting_notes": (
                "Versatile left-footed defender. Can play CB or LB at the highest level. "
                "Exceptional dribbling and carrying for a centre-back — Guardiola has used him "
                "as an inverted full-back to devastating effect. Still only 24, enormous ceiling. "
                "Croatia international. Premium price tag reflects scarcity of profile."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (13, "Medium"),
            "skills": (11, "Medium"), "take_ons": (12, "Medium"),
            "pass_accuracy": (14, "High"), "crossing": (12, "Medium"),
            "pass_range": (13, "Medium"), "through_balls": (11, "Medium"),
            "awareness": (14, "High"), "discipline": (14, "High"),
            "interceptions": (14, "High"), "positioning": (14, "High"),
            "blocking": (13, "Medium"), "clearances": (14, "High"),
            "marking": (14, "High"), "tackling": (14, "High"),
            "intensity": (14, "High"), "pressing": (14, "High"),
            "stamina": (14, "High"), "versatility": (15, "High"),
            "acceleration": (14, "High"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (14, "High"),
            "aggression": (13, "Medium"), "duels": (14, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (14, "High"), "heading": (13, "Medium"),
            "jumping": (13, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 28. Jarrad Branthwaite ────────────────────────────────────────
    {
        "person": {
            "name": "Jarrad Branthwaite",
            "dob": "2002-06-27",
            "height_cm": 195,
            "preferred_foot": "Left",
            "nation": "England",
            "club": "Everton",
        },
        "profile": {
            "position": "CD",
            "level": 81,
            "overall": 79,
            "archetype": "Destroyer",
            "blueprint": "Traditional CB",
            "profile_tier": 2,
        },
        "personality": {
            "ei": 40, "sn": 35, "tf": 50, "jp": 65,
            "competitiveness": 8, "coachability": 8,
        },
        "market": {
            "market_value_tier": 2, "true_mvt": 2, "market_premium": 5,
            "scarcity_score": 85, "transfer_fee_eur": 50000000, "hg": True,
        },
        "status": {
            "pursuit_status": "Priority",
            "scouting_notes": (
                "Best young English CB prospect. Left-footed, aerially dominant at 6'5, "
                "excellent timing in the tackle. Leadership qualities beyond his years — "
                "Everton captain material. Injury concerns (groin) but recovers well. "
                "HG-eligible. Acquirable if Everton are relegated or need to sell."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (11, "Medium"), "first_touch": (12, "Medium"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (13, "Medium"), "crossing": (10, "Low"),
            "pass_range": (12, "Medium"), "through_balls": (10, "Low"),
            "awareness": (13, "Medium"), "discipline": (14, "High"),
            "interceptions": (14, "High"), "positioning": (14, "High"),
            "blocking": (14, "High"), "clearances": (15, "High"),
            "marking": (14, "High"), "tackling": (15, "High"),
            "intensity": (13, "Medium"), "pressing": (12, "Medium"),
            "stamina": (13, "Medium"), "versatility": (11, "Medium"),
            "acceleration": (12, "Medium"), "balance": (12, "Medium"),
            "movement": (11, "Medium"), "pace": (12, "Medium"),
            "aggression": (14, "High"), "duels": (14, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (15, "High"), "heading": (15, "High"),
            "jumping": (15, "High"), "volleys": (10, "Low"),
        },
    },

    # ─── 29. Alphonso Davies ───────────────────────────────────────────
    {
        "person": {
            "name": "Alphonso Davies",
            "dob": "2000-11-02",
            "height_cm": 183,
            "preferred_foot": "Left",
            "nation": "Canada",
            "club": "Real Madrid",
        },
        "profile": {
            "position": "WD",
            "level": 86,
            "overall": 86,
            "archetype": "Engine-Sprinter",
            "blueprint": "Overlapping Full-Back",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 35, "sn": 50, "tf": 55, "jp": 60,
            "competitiveness": 7, "coachability": 7,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 0,
            "scarcity_score": 88, "transfer_fee_eur": 50000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Elite athletic LB. Raw pace is top-tier in world football. Progressive "
                "carrying and 1v1 defending both strong. Moved to Real Madrid as a free agent. "
                "Defensive concentration can dip in low-tempo phases. Canada captain."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (13, "Medium"),
            "skills": (12, "Medium"), "take_ons": (14, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (13, "Medium"),
            "pass_range": (12, "Medium"), "through_balls": (10, "Low"),
            "awareness": (13, "Medium"), "discipline": (12, "Medium"),
            "interceptions": (13, "Medium"), "positioning": (12, "Medium"),
            "blocking": (12, "Medium"), "clearances": (12, "Medium"),
            "marking": (12, "Medium"), "tackling": (13, "Medium"),
            "intensity": (15, "High"), "pressing": (14, "High"),
            "stamina": (15, "High"), "versatility": (13, "Medium"),
            "acceleration": (16, "High"), "balance": (13, "Medium"),
            "movement": (14, "High"), "pace": (16, "High"),
            "aggression": (12, "Medium"), "duels": (13, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (11, "Low"), "heading": (11, "Low"),
            "jumping": (12, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 30. Theo Hernandez ────────────────────────────────────────────
    {
        "person": {
            "name": "Theo Hernandez",
            "dob": "1997-10-06",
            "height_cm": 184,
            "preferred_foot": "Left",
            "nation": "France",
            "club": "AC Milan",
        },
        "profile": {
            "position": "WD",
            "level": 84,
            "overall": 86,
            "archetype": "Engine-Sprinter",
            "blueprint": "Attacking Full-Back",
            "profile_tier": 2,
        },
        "personality": {
            "ei": 40, "sn": 55, "tf": 60, "jp": 55,
            "competitiveness": 8, "coachability": 6,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": -5,
            "scarcity_score": 82, "transfer_fee_eur": 60000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Interested",
            "scouting_notes": (
                "One of the most attacking LBs in football. Elite pace, powerful carries, "
                "and goal threat from deep. Defensive lapses remain — can be caught out of "
                "position. Milan contract situation uncertain. France regular. "
                "Potential acquisition if Milan price drops."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (15, "High"), "first_touch": (13, "Medium"),
            "skills": (12, "Medium"), "take_ons": (14, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (14, "High"),
            "pass_range": (12, "Medium"), "through_balls": (11, "Medium"),
            "awareness": (12, "Medium"), "discipline": (11, "Medium"),
            "interceptions": (12, "Medium"), "positioning": (11, "Medium"),
            "blocking": (11, "Medium"), "clearances": (12, "Medium"),
            "marking": (11, "Medium"), "tackling": (12, "Medium"),
            "intensity": (14, "High"), "pressing": (13, "Medium"),
            "stamina": (14, "High"), "versatility": (11, "Medium"),
            "acceleration": (15, "High"), "balance": (13, "Medium"),
            "movement": (14, "High"), "pace": (15, "High"),
            "aggression": (13, "Medium"), "duels": (13, "Medium"),
            "shielding": (12, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (12, "Medium"), "heading": (12, "Medium"),
            "jumping": (12, "Medium"), "volleys": (11, "Medium"),
        },
    },

    # ─── 31. Nuno Mendes ──────────────────────────────────────────────
    {
        "person": {
            "name": "Nuno Mendes",
            "dob": "2002-06-19",
            "height_cm": 176,
            "preferred_foot": "Left",
            "nation": "Portugal",
            "club": "Paris Saint-Germain",
        },
        "profile": {
            "position": "WD",
            "level": 89,
            "overall": 84,
            "archetype": "Engine",
            "blueprint": "Two-Way Full-Back",
            "profile_tier": 2,
        },
        "personality": {
            "ei": 45, "sn": 40, "tf": 45, "jp": 60,
            "competitiveness": 7, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 2, "market_premium": -5,
            "scarcity_score": 85, "transfer_fee_eur": 55000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Interested",
            "scouting_notes": (
                "Dynamic LB with excellent two-way game. Defensively sound and aggressive "
                "in the press. Good crosser and progressive runner. Still developing — enormous "
                "upside at 23. Portugal regular. PSG might sell if right offer comes."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (13, "Medium"),
            "skills": (11, "Medium"), "take_ons": (13, "Medium"),
            "pass_accuracy": (13, "Medium"), "crossing": (13, "Medium"),
            "pass_range": (12, "Medium"), "through_balls": (10, "Low"),
            "awareness": (13, "Medium"), "discipline": (13, "Medium"),
            "interceptions": (13, "Medium"), "positioning": (13, "Medium"),
            "blocking": (12, "Medium"), "clearances": (12, "Medium"),
            "marking": (13, "Medium"), "tackling": (13, "Medium"),
            "intensity": (14, "High"), "pressing": (14, "High"),
            "stamina": (14, "High"), "versatility": (12, "Medium"),
            "acceleration": (15, "High"), "balance": (13, "Medium"),
            "movement": (14, "High"), "pace": (15, "High"),
            "aggression": (13, "Medium"), "duels": (13, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (11, "Low"), "heading": (11, "Low"),
            "jumping": (12, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 32. Trent Alexander-Arnold ────────────────────────────────────
    {
        "person": {
            "name": "Trent Alexander-Arnold",
            "dob": "1998-10-07",
            "height_cm": 180,
            "preferred_foot": "Right",
            "nation": "England",
            "club": "Real Madrid",
        },
        "profile": {
            "position": "WD",
            "level": 88,
            "overall": 88,
            "archetype": "Creator-Passer",
            "blueprint": "Playmaking Full-Back",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 70, "sn": 30, "tf": 35, "jp": 55,
            "competitiveness": 7, "coachability": 7,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 5,
            "scarcity_score": 98, "transfer_fee_eur": 0, "hg": True,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Unique profile — a genuine playmaker playing RB. Crossing, long-range passing, "
                "and set-piece delivery are world-class. Defensive 1v1 remains a vulnerability. "
                "Moved to Real Madrid on a free transfer. England regular. "
                "Scarcity score near-maximum — no comparable profile exists."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (14, "High"),
            "skills": (12, "Medium"), "take_ons": (11, "Medium"),
            "pass_accuracy": (16, "High"), "crossing": (16, "High"),
            "pass_range": (16, "High"), "through_balls": (14, "High"),
            "awareness": (15, "High"), "discipline": (12, "Medium"),
            "interceptions": (12, "Medium"), "positioning": (12, "Medium"),
            "blocking": (11, "Medium"), "clearances": (11, "Medium"),
            "marking": (11, "Medium"), "tackling": (12, "Medium"),
            "intensity": (13, "Medium"), "pressing": (12, "Medium"),
            "stamina": (13, "Medium"), "versatility": (14, "High"),
            "acceleration": (12, "Medium"), "balance": (12, "Medium"),
            "movement": (13, "Medium"), "pace": (12, "Medium"),
            "aggression": (11, "Medium"), "duels": (11, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (12, "Medium"),
        },
    },

    # ─── 33. Pedro Porro ──────────────────────────────────────────────
    {
        "person": {
            "name": "Pedro Porro",
            "dob": "1999-09-13",
            "height_cm": 173,
            "preferred_foot": "Right",
            "nation": "Spain",
            "club": "Tottenham Hotspur",
        },
        "profile": {
            "position": "WD",
            "level": 84,
            "overall": 84,
            "archetype": "Engine-Dribbler",
            "blueprint": "Inverted Full-Back",
            "profile_tier": 2,
        },
        "personality": {
            "ei": 40, "sn": 50, "tf": 55, "jp": 65,
            "competitiveness": 8, "coachability": 7,
        },
        "market": {
            "market_value_tier": 2, "true_mvt": 2, "market_premium": 0,
            "scarcity_score": 75, "transfer_fee_eur": 50000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Watch",
            "scouting_notes": (
                "Aggressive, attack-minded RB. Excellent dribbler and crosser from wide. "
                "Defensively inconsistent — caught upfield too often. Spain international. "
                "Good option if Spurs rebuild. Suits a system with a covering CB."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (13, "Medium"),
            "skills": (12, "Medium"), "take_ons": (14, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (14, "High"),
            "pass_range": (12, "Medium"), "through_balls": (11, "Medium"),
            "awareness": (12, "Medium"), "discipline": (11, "Medium"),
            "interceptions": (12, "Medium"), "positioning": (12, "Medium"),
            "blocking": (11, "Medium"), "clearances": (11, "Medium"),
            "marking": (11, "Medium"), "tackling": (12, "Medium"),
            "intensity": (14, "High"), "pressing": (14, "High"),
            "stamina": (14, "High"), "versatility": (12, "Medium"),
            "acceleration": (14, "High"), "balance": (13, "Medium"),
            "movement": (14, "High"), "pace": (14, "High"),
            "aggression": (13, "Medium"), "duels": (13, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (11, "Medium"), "volleys": (11, "Medium"),
        },
    },

    # ─── 34. Aurélien Tchouameni ───────────────────────────────────────
    {
        "person": {
            "name": "Aurélien Tchouameni",
            "dob": "2000-01-27",
            "height_cm": 187,
            "preferred_foot": "Right",
            "nation": "France",
            "club": "Real Madrid",
        },
        "profile": {
            "position": "DM",
            "level": 86,
            "overall": 86,
            "archetype": "Destroyer-Engine",
            "blueprint": "Box-to-Box Anchor",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 60, "sn": 30, "tf": 40, "jp": 68,
            "competitiveness": 8, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 0,
            "scarcity_score": 85, "transfer_fee_eur": 80000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Watch",
            "scouting_notes": (
                "Complete DM. Long-range passing, ball recovery, and positional intelligence "
                "are all elite. Has filled in at CB for Real Madrid comfortably. "
                "France international. Still growing — could become Casemiro's successor "
                "at the top level. Not easily acquirable from Madrid."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (13, "Medium"),
            "skills": (10, "Low"), "take_ons": (11, "Medium"),
            "pass_accuracy": (14, "High"), "crossing": (10, "Low"),
            "pass_range": (14, "High"), "through_balls": (12, "Medium"),
            "awareness": (15, "High"), "discipline": (15, "High"),
            "interceptions": (15, "High"), "positioning": (15, "High"),
            "blocking": (14, "High"), "clearances": (13, "Medium"),
            "marking": (14, "High"), "tackling": (15, "High"),
            "intensity": (14, "High"), "pressing": (14, "High"),
            "stamina": (14, "High"), "versatility": (14, "High"),
            "acceleration": (13, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (13, "Medium"),
            "aggression": (13, "Medium"), "duels": (14, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (14, "High"), "heading": (13, "Medium"),
            "jumping": (13, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 35. Martín Zubimendi ──────────────────────────────────────────
    {
        "person": {
            "name": "Martín Zubimendi",
            "dob": "1999-02-02",
            "height_cm": 180,
            "preferred_foot": "Right",
            "nation": "Spain",
            "club": "Real Sociedad",
        },
        "profile": {
            "position": "DM",
            "level": 87,
            "overall": 85,
            "archetype": "Controller",
            "blueprint": "Deep-Lying Playmaker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 72, "sn": 22, "tf": 30, "jp": 50,
            "competitiveness": 7, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 2, "market_premium": -5,
            "scarcity_score": 90, "transfer_fee_eur": 60000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Priority",
            "scouting_notes": (
                "Elegant deep-lying playmaker. Metronomic passing, intelligent positioning, "
                "and composure under pressure. Not physically dominant — relies on brain. "
                "Spain Euro 2024 starter. Release clause reportedly ~€60M. "
                "Has turned down Liverpool before — loyalty to Sociedad. Top target."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (15, "High"),
            "skills": (12, "Medium"), "take_ons": (11, "Medium"),
            "pass_accuracy": (16, "High"), "crossing": (10, "Low"),
            "pass_range": (15, "High"), "through_balls": (14, "High"),
            "awareness": (16, "High"), "discipline": (15, "High"),
            "interceptions": (14, "High"), "positioning": (15, "High"),
            "blocking": (12, "Medium"), "clearances": (11, "Medium"),
            "marking": (13, "Medium"), "tackling": (13, "Medium"),
            "intensity": (12, "Medium"), "pressing": (13, "Medium"),
            "stamina": (13, "Medium"), "versatility": (11, "Medium"),
            "acceleration": (11, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (11, "Medium"),
            "aggression": (11, "Medium"), "duels": (12, "Medium"),
            "shielding": (12, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (11, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (11, "Medium"),
        },
    },

    # ─── 36. Jude Bellingham ───────────────────────────────────────────
    {
        "person": {
            "name": "Jude Bellingham",
            "dob": "2003-06-29",
            "height_cm": 186,
            "preferred_foot": "Right",
            "nation": "England",
            "club": "Real Madrid",
        },
        "profile": {
            "position": "CM",
            "level": 89,
            "overall": 89,
            "archetype": "Engine-Commander",
            "blueprint": "Box-to-Box Creator",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 40, "sn": 45, "tf": 60, "jp": 80,
            "competitiveness": 10, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 15,
            "scarcity_score": 95, "transfer_fee_eur": 150000000, "hg": True,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Generational talent. Combines physical dynamism with technical excellence "
                "and elite mentality. Goals, assists, pressing, defending — does everything. "
                "Already a Ballon d'Or contender at 22. England talisman. "
                "Not acquirable — Real Madrid long-term project."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (15, "High"), "first_touch": (15, "High"),
            "skills": (13, "Medium"), "take_ons": (14, "High"),
            "pass_accuracy": (14, "High"), "crossing": (12, "Medium"),
            "pass_range": (14, "High"), "through_balls": (13, "Medium"),
            "awareness": (15, "High"), "discipline": (14, "High"),
            "interceptions": (13, "Medium"), "positioning": (14, "High"),
            "blocking": (12, "Medium"), "clearances": (11, "Medium"),
            "marking": (12, "Medium"), "tackling": (13, "Medium"),
            "intensity": (15, "High"), "pressing": (15, "High"),
            "stamina": (15, "High"), "versatility": (14, "High"),
            "acceleration": (14, "High"), "balance": (14, "High"),
            "movement": (15, "High"), "pace": (14, "High"),
            "aggression": (14, "High"), "duels": (14, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (14, "High"), "heading": (13, "Medium"),
            "jumping": (14, "High"), "volleys": (12, "Medium"),
        },
    },

    # ─── 37. Pedri ────────────────────────────────────────────────────
    {
        "person": {
            "name": "Pedri",
            "dob": "2002-11-25",
            "height_cm": 174,
            "preferred_foot": "Right",
            "nation": "Spain",
            "club": "Barcelona",
        },
        "profile": {
            "position": "CM",
            "level": 89,
            "overall": 87,
            "archetype": "Controller-Creator",
            "blueprint": "Interior Playmaker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 75, "sn": 20, "tf": 30, "jp": 45,
            "competitiveness": 7, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 10,
            "scarcity_score": 92, "transfer_fee_eur": 100000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Xavi-esque midfielder. Close control in tight spaces, weight of pass, "
                "and spatial awareness are all exceptional. Not physically imposing — relies "
                "on intelligence and technique. Injury history (hamstring, thigh) is concerning. "
                "Barcelona and Spain cornerstone. Release clause astronomical."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (16, "High"),
            "skills": (14, "High"), "take_ons": (14, "High"),
            "pass_accuracy": (16, "High"), "crossing": (11, "Medium"),
            "pass_range": (14, "High"), "through_balls": (15, "High"),
            "awareness": (16, "High"), "discipline": (14, "High"),
            "interceptions": (12, "Medium"), "positioning": (14, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (11, "Medium"), "tackling": (11, "Medium"),
            "intensity": (12, "Medium"), "pressing": (13, "Medium"),
            "stamina": (12, "Medium"), "versatility": (13, "Medium"),
            "acceleration": (12, "Medium"), "balance": (15, "High"),
            "movement": (15, "High"), "pace": (11, "Medium"),
            "aggression": (10, "Low"), "duels": (11, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (12, "Medium"),
        },
    },

    # ─── 38. Moisés Caicedo ───────────────────────────────────────────
    {
        "person": {
            "name": "Moisés Caicedo",
            "dob": "2001-11-02",
            "height_cm": 178,
            "preferred_foot": "Right",
            "nation": "Ecuador",
            "club": "Chelsea",
        },
        "profile": {
            "position": "CM",
            "level": 88,
            "overall": 84,
            "archetype": "Engine-Destroyer",
            "blueprint": "Ball-Winning Midfielder",
            "profile_tier": 2,
        },
        "personality": {
            "ei": 45, "sn": 40, "tf": 50, "jp": 72,
            "competitiveness": 9, "coachability": 7,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 2, "market_premium": 10,
            "scarcity_score": 78, "transfer_fee_eur": 115000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Watch",
            "scouting_notes": (
                "Tireless ball-winner. Covers enormous ground, aggressive in the press, "
                "and has improved passing range significantly. Chelsea paid record fee but "
                "performances have justified it. Ecuador captain. Still maturing tactically."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (12, "Medium"),
            "skills": (10, "Low"), "take_ons": (11, "Medium"),
            "pass_accuracy": (13, "Medium"), "crossing": (10, "Low"),
            "pass_range": (13, "Medium"), "through_balls": (11, "Medium"),
            "awareness": (14, "High"), "discipline": (14, "High"),
            "interceptions": (15, "High"), "positioning": (14, "High"),
            "blocking": (13, "Medium"), "clearances": (12, "Medium"),
            "marking": (13, "Medium"), "tackling": (15, "High"),
            "intensity": (15, "High"), "pressing": (15, "High"),
            "stamina": (15, "High"), "versatility": (13, "Medium"),
            "acceleration": (13, "Medium"), "balance": (13, "Medium"),
            "movement": (13, "Medium"), "pace": (13, "Medium"),
            "aggression": (14, "High"), "duels": (14, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (12, "Medium"), "heading": (11, "Medium"),
            "jumping": (12, "Medium"), "volleys": (10, "Low"),
        },
    },

    # ─── 39. Vitinha ──────────────────────────────────────────────────
    {
        "person": {
            "name": "Vitinha",
            "dob": "2000-02-13",
            "height_cm": 172,
            "preferred_foot": "Right",
            "nation": "Portugal",
            "club": "Paris Saint-Germain",
        },
        "profile": {
            "position": "CM",
            "level": 90,
            "overall": 85,
            "archetype": "Controller-Dribbler",
            "blueprint": "Technical Midfielder",
            "profile_tier": 2,
        },
        "personality": {
            "ei": 68, "sn": 25, "tf": 35, "jp": 55,
            "competitiveness": 7, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 2, "market_premium": -5,
            "scarcity_score": 80, "transfer_fee_eur": 70000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Interested",
            "scouting_notes": (
                "Silky midfielder with elite close control and press resistance. "
                "Glides past pressure with ease. Progressive passer. Slight frame limits "
                "aerial contribution. Portugal regular. PSG's midfield conductor. "
                "Could be available if PSG restructure."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (15, "High"),
            "skills": (14, "High"), "take_ons": (14, "High"),
            "pass_accuracy": (15, "High"), "crossing": (11, "Medium"),
            "pass_range": (14, "High"), "through_balls": (13, "Medium"),
            "awareness": (15, "High"), "discipline": (13, "Medium"),
            "interceptions": (12, "Medium"), "positioning": (13, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (11, "Medium"), "tackling": (12, "Medium"),
            "intensity": (13, "Medium"), "pressing": (13, "Medium"),
            "stamina": (13, "Medium"), "versatility": (12, "Medium"),
            "acceleration": (13, "Medium"), "balance": (15, "High"),
            "movement": (14, "High"), "pace": (12, "Medium"),
            "aggression": (10, "Low"), "duels": (11, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (11, "Medium"),
        },
    },

    # ─── 40. Jamal Musiala ────────────────────────────────────────────
    {
        "person": {
            "name": "Jamal Musiala",
            "dob": "2003-02-26",
            "height_cm": 183,
            "preferred_foot": "Right",
            "nation": "Germany",
            "club": "Bayern Munich",
        },
        "profile": {
            "position": "AM",
            "level": 89,
            "overall": 89,
            "archetype": "Creator-Dribbler",
            "blueprint": "Floating Playmaker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 55, "sn": 30, "tf": 40, "jp": 50,
            "competitiveness": 7, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 15,
            "scarcity_score": 95, "transfer_fee_eur": 150000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Dribbling genius. Glides past defenders with effortless close control. "
                "Finds pockets of space instinctively. Creative output improving every season. "
                "Germany's crown jewel. Bayern trying to lock him down long-term. "
                "Not acquirable — would cost a world record fee."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (16, "High"), "first_touch": (16, "High"),
            "skills": (15, "High"), "take_ons": (16, "High"),
            "pass_accuracy": (14, "High"), "crossing": (12, "Medium"),
            "pass_range": (13, "Medium"), "through_balls": (14, "High"),
            "awareness": (15, "High"), "discipline": (12, "Medium"),
            "interceptions": (10, "Low"), "positioning": (13, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (13, "Medium"), "pressing": (12, "Medium"),
            "stamina": (13, "Medium"), "versatility": (14, "High"),
            "acceleration": (14, "High"), "balance": (15, "High"),
            "movement": (15, "High"), "pace": (13, "Medium"),
            "aggression": (10, "Low"), "duels": (12, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (12, "Medium"),
        },
    },

    # ─── 41. Bukayo Saka ─────────────────────────────────────────────
    {
        "person": {
            "name": "Bukayo Saka",
            "dob": "2001-09-05",
            "height_cm": 178,
            "preferred_foot": "Left",
            "nation": "England",
            "club": "Arsenal",
        },
        "profile": {
            "position": "WF",
            "level": 88,
            "overall": 88,
            "archetype": "Creator-Engine",
            "blueprint": "Inverted Winger",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 50, "sn": 35, "tf": 35, "jp": 70,
            "competitiveness": 9, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 10,
            "scarcity_score": 92, "transfer_fee_eur": 120000000, "hg": True,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Complete winger. Goals, assists, defensive work rate — does it all. "
                "Equally dangerous cutting inside or going to the byline. "
                "Mental toughness exceptional for his age — Euro 2024 penalty miss "
                "hasn't affected him. Arsenal and England's most important player."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (15, "High"), "first_touch": (15, "High"),
            "skills": (14, "High"), "take_ons": (15, "High"),
            "pass_accuracy": (14, "High"), "crossing": (14, "High"),
            "pass_range": (13, "Medium"), "through_balls": (13, "Medium"),
            "awareness": (14, "High"), "discipline": (14, "High"),
            "interceptions": (12, "Medium"), "positioning": (13, "Medium"),
            "blocking": (11, "Medium"), "clearances": (10, "Low"),
            "marking": (11, "Medium"), "tackling": (12, "Medium"),
            "intensity": (14, "High"), "pressing": (14, "High"),
            "stamina": (14, "High"), "versatility": (15, "High"),
            "acceleration": (14, "High"), "balance": (14, "High"),
            "movement": (14, "High"), "pace": (14, "High"),
            "aggression": (12, "Medium"), "duels": (13, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (11, "Medium"), "volleys": (12, "Medium"),
        },
    },

    # ─── 42. Erling Haaland ───────────────────────────────────────────
    {
        "person": {
            "name": "Erling Haaland",
            "dob": "2000-07-21",
            "height_cm": 194,
            "preferred_foot": "Left",
            "nation": "Norway",
            "club": "Manchester City",
        },
        "profile": {
            "position": "CF",
            "level": 91,
            "overall": 92,
            "archetype": "Target-Sprinter",
            "blueprint": "Goal Machine",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 40, "sn": 50, "tf": 65, "jp": 85,
            "competitiveness": 10, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 20,
            "scarcity_score": 98, "transfer_fee_eur": 200000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Lethal finisher. Movement in the box, raw pace, and aerial power are "
                "unmatched in modern football. Limited involvement outside the box — "
                "reliant on service. Norway's only world-class player. "
                "Release clause reportedly active in 2025. Not acquirable."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (12, "Medium"), "first_touch": (13, "Medium"),
            "skills": (11, "Medium"), "take_ons": (11, "Medium"),
            "pass_accuracy": (11, "Medium"), "crossing": (10, "Low"),
            "pass_range": (10, "Low"), "through_balls": (10, "Low"),
            "awareness": (14, "High"), "discipline": (13, "Medium"),
            "interceptions": (10, "Low"), "positioning": (16, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (14, "High"), "pressing": (14, "High"),
            "stamina": (13, "Medium"), "versatility": (10, "Low"),
            "acceleration": (15, "High"), "balance": (13, "Medium"),
            "movement": (16, "High"), "pace": (15, "High"),
            "aggression": (14, "High"), "duels": (14, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (15, "High"), "heading": (15, "High"),
            "jumping": (15, "High"), "volleys": (13, "Medium"),
        },
    },

    # ─── 43. Viktor Gyökeres ──────────────────────────────────────────
    {
        "person": {
            "name": "Viktor Gyökeres",
            "dob": "1998-06-04",
            "height_cm": 187,
            "preferred_foot": "Right",
            "nation": "Sweden",
            "club": "Arsenal",
        },
        "profile": {
            "position": "CF",
            "level": 85,
            "overall": 86,
            "archetype": "Target-Engine",
            "blueprint": "Complete Striker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 42, "sn": 45, "tf": 55, "jp": 75,
            "competitiveness": 9, "coachability": 7,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 5,
            "scarcity_score": 85, "transfer_fee_eur": 75000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Priority",
            "scouting_notes": (
                "Prolific striker. 60+ goals in a calendar year at Sporting before Arsenal move Jan 2026. "
                "Pressing monster — intensity and work rate off the ball are relentless. "
                "Can play alone or in a pair. Late bloomer — Coventry → Sporting → Arsenal. "
                "Signed for ~€75M. Adapting to Premier League physicality."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (13, "Medium"), "first_touch": (13, "Medium"),
            "skills": (11, "Medium"), "take_ons": (12, "Medium"),
            "pass_accuracy": (12, "Medium"), "crossing": (10, "Low"),
            "pass_range": (11, "Medium"), "through_balls": (10, "Low"),
            "awareness": (14, "High"), "discipline": (13, "Medium"),
            "interceptions": (11, "Medium"), "positioning": (15, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (11, "Medium"),
            "intensity": (15, "High"), "pressing": (15, "High"),
            "stamina": (15, "High"), "versatility": (12, "Medium"),
            "acceleration": (14, "High"), "balance": (13, "Medium"),
            "movement": (15, "High"), "pace": (14, "High"),
            "aggression": (14, "High"), "duels": (14, "High"),
            "shielding": (13, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (14, "High"), "heading": (13, "Medium"),
            "jumping": (13, "Medium"), "volleys": (12, "Medium"),
        },
    },

    # ─── 44. Alexander Isak ───────────────────────────────────────────
    {
        "person": {
            "name": "Alexander Isak",
            "dob": "1999-09-21",
            "height_cm": 192,
            "preferred_foot": "Right",
            "nation": "Sweden",
            "club": "Newcastle United",
        },
        "profile": {
            "position": "CF",
            "level": 87,
            "overall": 87,
            "archetype": "Sprinter-Dribbler",
            "blueprint": "Mobile Striker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 55, "sn": 35, "tf": 45, "jp": 60,
            "competitiveness": 8, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 5,
            "scarcity_score": 88, "transfer_fee_eur": 90000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Watch",
            "scouting_notes": (
                "Elegant striker with pace, dribbling, and clinical finishing. "
                "Movement between the lines is intelligent. Links play well despite height. "
                "Newcastle's talisman. Sweden captain. Would require a massive fee."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (14, "High"),
            "skills": (13, "Medium"), "take_ons": (14, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (10, "Low"),
            "pass_range": (11, "Medium"), "through_balls": (11, "Medium"),
            "awareness": (14, "High"), "discipline": (13, "Medium"),
            "interceptions": (10, "Low"), "positioning": (15, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (13, "Medium"), "pressing": (13, "Medium"),
            "stamina": (13, "Medium"), "versatility": (12, "Medium"),
            "acceleration": (15, "High"), "balance": (14, "High"),
            "movement": (15, "High"), "pace": (14, "High"),
            "aggression": (12, "Medium"), "duels": (13, "Medium"),
            "shielding": (12, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (13, "Medium"), "heading": (13, "Medium"),
            "jumping": (13, "Medium"), "volleys": (12, "Medium"),
        },
    },

    # ─── 45. Gianluigi Donnarumma ─────────────────────────────────────
    {
        "person": {
            "name": "Gianluigi Donnarumma",
            "dob": "1999-02-25",
            "height_cm": 196,
            "preferred_foot": "Right",
            "nation": "Italy",
            "club": "Paris Saint-Germain",
        },
        "profile": {
            "position": "GK",
            "level": 90,
            "overall": 87,
            "archetype": "Commander",
            "blueprint": "Shot-Stopper",
            "profile_tier": 2,
        },
        "personality": {
            "ei": 45, "sn": 40, "tf": 55, "jp": 55,
            "competitiveness": 7, "coachability": 7,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": -5,
            "scarcity_score": 80, "transfer_fee_eur": 50000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Watch",
            "scouting_notes": (
                "Elite shot-stopper with enormous frame. Reflexes and one-on-one saving "
                "are world-class. Distribution has improved but remains below elite. "
                "Italy captain. Euro 2020 hero. PSG contract situation fluctuates. "
                "Concentration lapses remain a concern."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (10, "Low"), "first_touch": (11, "Medium"),
            "skills": (10, "Low"), "take_ons": (10, "Low"),
            "pass_accuracy": (12, "Medium"), "crossing": (10, "Low"),
            "pass_range": (12, "Medium"), "through_balls": (10, "Low"),
            "awareness": (14, "High"), "discipline": (13, "Medium"),
            "interceptions": (10, "Low"), "positioning": (14, "High"),
            "blocking": (15, "High"), "clearances": (12, "Medium"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (11, "Medium"), "pressing": (10, "Low"),
            "stamina": (11, "Medium"), "versatility": (10, "Low"),
            "acceleration": (10, "Low"), "balance": (12, "Medium"),
            "movement": (11, "Medium"), "pace": (10, "Low"),
            "aggression": (12, "Medium"), "duels": (12, "Medium"),
            "shielding": (12, "Medium"), "throwing": (14, "High"),
            "aerial_duels": (14, "High"), "heading": (10, "Low"),
            "jumping": (14, "High"), "volleys": (10, "Low"),
        },
    },

    # ─── 46. Kylian Mbappé ────────────────────────────────────────────
    {
        "person": {
            "name": "Kylian Mbappé",
            "dob": "1998-12-20",
            "height_cm": 178,
            "preferred_foot": "Right",
            "nation": "France",
            "club": "Real Madrid",
        },
        "profile": {
            "position": "WF",
            "level": 93,
            "overall": 92,
            "archetype": "Sprinter-Striker",
            "blueprint": "Inside Forward",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 40, "sn": 55, "tf": 65, "jp": 80,
            "competitiveness": 10, "coachability": 6,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 20,
            "scarcity_score": 98, "transfer_fee_eur": 0, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Generational pace and finishing. Devastating in transition. "
                "Can play LW or central striker. Real Madrid marquee signing. "
                "France captain. Ego management reportedly a factor. "
                "Not acquirable — top 3 player in the world."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (15, "High"), "first_touch": (14, "High"),
            "skills": (14, "High"), "take_ons": (15, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (12, "Medium"),
            "pass_range": (11, "Medium"), "through_balls": (12, "Medium"),
            "awareness": (14, "High"), "discipline": (12, "Medium"),
            "interceptions": (10, "Low"), "positioning": (15, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (14, "High"), "pressing": (13, "Medium"),
            "stamina": (13, "Medium"), "versatility": (13, "Medium"),
            "acceleration": (16, "High"), "balance": (14, "High"),
            "movement": (16, "High"), "pace": (16, "High"),
            "aggression": (12, "Medium"), "duels": (13, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (12, "Medium"), "heading": (12, "Medium"),
            "jumping": (12, "Medium"), "volleys": (13, "Medium"),
        },
    },

    # ─── 47. Vinícius Júnior ──────────────────────────────────────────
    {
        "person": {
            "name": "Vinícius Júnior",
            "dob": "2000-07-12",
            "height_cm": 176,
            "preferred_foot": "Right",
            "nation": "Brazil",
            "club": "Real Madrid",
        },
        "profile": {
            "position": "WF",
            "level": 90,
            "overall": 91,
            "archetype": "Dribbler-Sprinter",
            "blueprint": "Explosive Winger",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 35, "sn": 55, "tf": 60, "jp": 70,
            "competitiveness": 9, "coachability": 7,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 20,
            "scarcity_score": 95, "transfer_fee_eur": 200000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Electrifying winger. Dribbling, pace, and big-game mentality are elite. "
                "Decision-making has matured enormously — now clinical in front of goal. "
                "Ballon d'Or winner. Brazil's talisman. Occasional temperament flashes. "
                "Not acquirable at any price."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (16, "High"), "first_touch": (15, "High"),
            "skills": (15, "High"), "take_ons": (16, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (13, "Medium"),
            "pass_range": (11, "Medium"), "through_balls": (12, "Medium"),
            "awareness": (14, "High"), "discipline": (11, "Medium"),
            "interceptions": (10, "Low"), "positioning": (14, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (14, "High"), "pressing": (13, "Medium"),
            "stamina": (13, "Medium"), "versatility": (13, "Medium"),
            "acceleration": (16, "High"), "balance": (15, "High"),
            "movement": (15, "High"), "pace": (16, "High"),
            "aggression": (12, "Medium"), "duels": (13, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (11, "Medium"), "volleys": (12, "Medium"),
        },
    },

    # ─── 48. Raphinha ─────────────────────────────────────────────────
    {
        "person": {
            "name": "Raphinha",
            "dob": "1996-12-14",
            "height_cm": 176,
            "preferred_foot": "Left",
            "nation": "Brazil",
            "club": "Barcelona",
        },
        "profile": {
            "position": "WF",
            "level": 89,
            "overall": 87,
            "archetype": "Engine-Creator",
            "blueprint": "Work-Rate Winger",
            "profile_tier": 2,
        },
        "personality": {
            "ei": 42, "sn": 45, "tf": 50, "jp": 72,
            "competitiveness": 9, "coachability": 8,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 2, "market_premium": -5,
            "scarcity_score": 72, "transfer_fee_eur": 60000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Watch",
            "scouting_notes": (
                "Relentless winger. Work rate and pressing are among the best in La Liga. "
                "Free-kick specialist. Improved finishing under Flick. Brazil regular. "
                "Thrived after initially being written off at Barcelona. Age 29 — "
                "still at peak but window is closing."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (14, "High"), "first_touch": (14, "High"),
            "skills": (13, "Medium"), "take_ons": (14, "High"),
            "pass_accuracy": (13, "Medium"), "crossing": (14, "High"),
            "pass_range": (12, "Medium"), "through_balls": (12, "Medium"),
            "awareness": (13, "Medium"), "discipline": (13, "Medium"),
            "interceptions": (11, "Medium"), "positioning": (13, "Medium"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (11, "Medium"), "tackling": (12, "Medium"),
            "intensity": (15, "High"), "pressing": (15, "High"),
            "stamina": (15, "High"), "versatility": (13, "Medium"),
            "acceleration": (14, "High"), "balance": (14, "High"),
            "movement": (14, "High"), "pace": (14, "High"),
            "aggression": (13, "Medium"), "duels": (13, "Medium"),
            "shielding": (11, "Medium"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (11, "Medium"), "volleys": (12, "Medium"),
        },
    },

    # ─── 49. Bernardo Silva ───────────────────────────────────────────
    {
        "person": {
            "name": "Bernardo Silva",
            "dob": "1994-08-10",
            "height_cm": 173,
            "preferred_foot": "Left",
            "nation": "Portugal",
            "club": "Manchester City",
        },
        "profile": {
            "position": "WM",
            "level": 87,
            "overall": 89,
            "archetype": "Controller-Engine",
            "blueprint": "Tireless Technician",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 65, "sn": 25, "tf": 35, "jp": 68,
            "competitiveness": 9, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": -5,
            "scarcity_score": 90, "transfer_fee_eur": 70000000, "hg": False,
        },
        "status": {
            "pursuit_status": "Interested",
            "scouting_notes": (
                "One of the most intelligent players in football. Pressing triggers, "
                "spatial awareness, and ball retention are elite. Can play CM, RW, or "
                "as a false 9. Guardiola's most trusted player. Portugal regular. "
                "Has wanted to leave City for Barcelona — could become available."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (15, "High"), "first_touch": (16, "High"),
            "skills": (14, "High"), "take_ons": (14, "High"),
            "pass_accuracy": (15, "High"), "crossing": (13, "Medium"),
            "pass_range": (14, "High"), "through_balls": (14, "High"),
            "awareness": (16, "High"), "discipline": (15, "High"),
            "interceptions": (13, "Medium"), "positioning": (14, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (12, "Medium"), "tackling": (12, "Medium"),
            "intensity": (15, "High"), "pressing": (16, "High"),
            "stamina": (15, "High"), "versatility": (15, "High"),
            "acceleration": (13, "Medium"), "balance": (14, "High"),
            "movement": (15, "High"), "pace": (12, "Medium"),
            "aggression": (13, "Medium"), "duels": (12, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (12, "Medium"),
        },
    },

    # ─── 50. Phil Foden ───────────────────────────────────────────────
    {
        "person": {
            "name": "Phil Foden",
            "dob": "2000-05-28",
            "height_cm": 171,
            "preferred_foot": "Left",
            "nation": "England",
            "club": "Manchester City",
        },
        "profile": {
            "position": "WM",
            "level": 87,
            "overall": 88,
            "archetype": "Creator-Dribbler",
            "blueprint": "Free-Roaming Attacker",
            "profile_tier": 1,
        },
        "personality": {
            "ei": 55, "sn": 30, "tf": 40, "jp": 55,
            "competitiveness": 7, "coachability": 9,
        },
        "market": {
            "market_value_tier": 1, "true_mvt": 1, "market_premium": 10,
            "scarcity_score": 88, "transfer_fee_eur": 100000000, "hg": True,
        },
        "status": {
            "pursuit_status": "Pass",
            "scouting_notes": (
                "Natural talent. Left foot is magical — dribbling, finishing, and creativity "
                "all elite. PFA Player of the Year. Can play anywhere across the front line. "
                "Small frame but deceptive strength. England's most gifted attacker. "
                "City academy product — deeply embedded. Not acquirable."
            ),
            "squad_role": "starter",
        },
        "attributes": {
            "carries": (15, "High"), "first_touch": (16, "High"),
            "skills": (15, "High"), "take_ons": (15, "High"),
            "pass_accuracy": (14, "High"), "crossing": (12, "Medium"),
            "pass_range": (13, "Medium"), "through_balls": (14, "High"),
            "awareness": (15, "High"), "discipline": (13, "Medium"),
            "interceptions": (10, "Low"), "positioning": (14, "High"),
            "blocking": (10, "Low"), "clearances": (10, "Low"),
            "marking": (10, "Low"), "tackling": (10, "Low"),
            "intensity": (13, "Medium"), "pressing": (13, "Medium"),
            "stamina": (13, "Medium"), "versatility": (15, "High"),
            "acceleration": (14, "High"), "balance": (15, "High"),
            "movement": (15, "High"), "pace": (13, "Medium"),
            "aggression": (10, "Low"), "duels": (11, "Medium"),
            "shielding": (10, "Low"), "throwing": (10, "Low"),
            "aerial_duels": (10, "Low"), "heading": (10, "Low"),
            "jumping": (10, "Low"), "volleys": (13, "Medium"),
        },
    },

    # ─── 51. Bruno Fernandes ───────────────────────────────────────────────
    {
        "person": {
            "name": "Bruno Fernandes",
            "dob": "1994-09-08",
            "height_cm": 179,
            "preferred_foot": "Right",
            "nation": "Portugal",
            "club": "Manchester United",
        },
        "profile": {"position": "AM", "level": 89},
    },

    # ─── 52. Martin Ødegaard ──────────────────────────────────────────────
    {
        "person": {
            "name": "Martin Ødegaard",
            "dob": "1998-12-17",
            "height_cm": 178,
            "preferred_foot": "Left",
            "nation": "Norway",
            "club": "Arsenal",
        },
        "profile": {"position": "AM", "level": 89},
    },

    # ─── 53. Florian Wirtz ────────────────────────────────────────────────
    {
        "person": {
            "name": "Florian Wirtz",
            "dob": "2003-05-03",
            "height_cm": 176,
            "preferred_foot": "Right",
            "nation": "Germany",
            "club": "Bayer Leverkusen",
        },
        "profile": {"position": "AM", "level": 88},
    },

    # ─── 54. Cole Palmer ──────────────────────────────────────────────────
    {
        "person": {
            "name": "Cole Palmer",
            "dob": "2002-05-06",
            "height_cm": 185,
            "preferred_foot": "Left",
            "nation": "England",
            "club": "Chelsea",
        },
        "profile": {"position": "AM", "level": 88},
    },

    # ─── 55. Mohamed Salah ────────────────────────────────────────────────
    {
        "person": {
            "name": "Mohamed Salah",
            "dob": "1992-06-15",
            "height_cm": 175,
            "preferred_foot": "Left",
            "nation": "Egypt",
            "club": "Liverpool",
        },
        "profile": {"position": "WF", "level": 87},
    },

    # ─── 56. Son Heung-min ────────────────────────────────────────────────
    {
        "person": {
            "name": "Son Heung-min",
            "dob": "1992-07-08",
            "height_cm": 183,
            "preferred_foot": "Right",
            "nation": "South Korea",
            "club": "Tottenham Hotspur",
        },
        "profile": {"position": "WF", "level": 84},
    },

    # ─── 57. Federico Valverde ────────────────────────────────────────────
    {
        "person": {
            "name": "Federico Valverde",
            "dob": "1998-07-22",
            "height_cm": 182,
            "preferred_foot": "Right",
            "nation": "Uruguay",
            "club": "Real Madrid",
        },
        "profile": {"position": "CM", "level": 89},
    },

    # ─── 58. Bruno Guimarães ──────────────────────────────────────────────
    {
        "person": {
            "name": "Bruno Guimarães",
            "dob": "1997-11-16",
            "height_cm": 182,
            "preferred_foot": "Right",
            "nation": "Brazil",
            "club": "Newcastle United",
        },
        "profile": {"position": "CM", "level": 87},
    },

    # ─── 59. Granit Xhaka ────────────────────────────────────────────────
    {
        "person": {
            "name": "Granit Xhaka",
            "dob": "1992-09-27",
            "height_cm": 185,
            "preferred_foot": "Left",
            "nation": "Switzerland",
            "club": "Bayer Leverkusen",
        },
        "profile": {"position": "CM", "level": 85},
    },

    # ─── 60. Kobbie Mainoo ────────────────────────────────────────────────
    {
        "person": {
            "name": "Kobbie Mainoo",
            "dob": "2005-04-19",
            "height_cm": 180,
            "preferred_foot": "Right",
            "nation": "England",
            "club": "Manchester United",
        },
        "profile": {"position": "CM", "level": 84},
    },

    # ─── 61. Virgil van Dijk ─────────────────────────────────────────────
    {
        "person": {
            "name": "Virgil van Dijk",
            "dob": "1991-07-08",
            "height_cm": 193,
            "preferred_foot": "Right",
            "nation": "Netherlands",
            "club": "Liverpool",
        },
        "profile": {"position": "CD", "level": 88},
    },

    # ─── 62. Rúben Dias ──────────────────────────────────────────────────
    {
        "person": {
            "name": "Rúben Dias",
            "dob": "1997-05-14",
            "height_cm": 187,
            "preferred_foot": "Right",
            "nation": "Portugal",
            "club": "Manchester City",
        },
        "profile": {"position": "CD", "level": 88},
    },

    # ─── 63. Marquinhos ──────────────────────────────────────────────────
    {
        "person": {
            "name": "Marquinhos",
            "dob": "1994-05-14",
            "height_cm": 183,
            "preferred_foot": "Right",
            "nation": "Brazil",
            "club": "Paris Saint-Germain",
        },
        "profile": {"position": "CD", "level": 87},
    },

    # ─── 64. Marc-André ter Stegen ────────────────────────────────────────
    {
        "person": {
            "name": "Marc-André ter Stegen",
            "dob": "1992-04-30",
            "height_cm": 187,
            "preferred_foot": "Right",
            "nation": "Germany",
            "club": "Barcelona",
        },
        "profile": {"position": "GK", "level": 86},
    },

    # ─── 65. Thibaut Courtois ─────────────────────────────────────────────
    {
        "person": {
            "name": "Thibaut Courtois",
            "dob": "1992-05-11",
            "height_cm": 199,
            "preferred_foot": "Left",
            "nation": "Belgium",
            "club": "Real Madrid",
        },
        "profile": {"position": "GK", "level": 89},
    },

    # ─── 66. Harry Kane ──────────────────────────────────────────────────
    {
        "person": {
            "name": "Harry Kane",
            "dob": "1993-07-28",
            "height_cm": 188,
            "preferred_foot": "Right",
            "nation": "England",
            "club": "Bayern Munich",
        },
        "profile": {"position": "CF", "level": 91},
    },

    # ─── 67. Julián Álvarez ──────────────────────────────────────────────
    {
        "person": {
            "name": "Julián Álvarez",
            "dob": "2000-01-31",
            "height_cm": 170,
            "preferred_foot": "Right",
            "nation": "Argentina",
            "club": "Atlético Madrid",
        },
        "profile": {"position": "CF", "level": 84},
    },

    # ─── 68. Lautaro Martínez ────────────────────────────────────────────
    {
        "person": {
            "name": "Lautaro Martínez",
            "dob": "1997-08-22",
            "height_cm": 174,
            "preferred_foot": "Right",
            "nation": "Argentina",
            "club": "Inter Milan",
        },
        "profile": {"position": "CF", "level": 89},
    },

    # ─── 69. Leroy Sané ──────────────────────────────────────────────────
    {
        "person": {
            "name": "Leroy Sané",
            "dob": "1996-01-11",
            "height_cm": 183,
            "preferred_foot": "Left",
            "nation": "Germany",
            "club": "Bayern Munich",
        },
        "profile": {"position": "WM", "level": 84},
    },

    # ─── 70. Khvicha Kvaratskhelia ────────────────────────────────────────
    {
        "person": {
            "name": "Khvicha Kvaratskhelia",
            "dob": "2001-02-12",
            "height_cm": 183,
            "preferred_foot": "Right",
            "nation": "Georgia",
            "club": "Paris Saint-Germain",
        },
        "profile": {"position": "WF", "level": 89},
    },

    # ─── 71. Dani Olmo ────────────────────────────────────────────────────
    {
        "person": {
            "name": "Dani Olmo",
            "dob": "1998-05-07",
            "height_cm": 179,
            "preferred_foot": "Right",
            "nation": "Spain",
            "club": "Barcelona",
        },
        "profile": {"position": "AM", "level": 87},
    },

    # ─── 72. Antoine Griezmann ────────────────────────────────────────────
    {
        "person": {
            "name": "Antoine Griezmann",
            "dob": "1991-03-21",
            "height_cm": 176,
            "preferred_foot": "Left",
            "nation": "France",
            "club": "Atlético Madrid",
        },
        "profile": {"position": "AM", "level": 88},
    },

    # ─── 73. Marcus Rashford ──────────────────────────────────────────────
    {
        "person": {
            "name": "Marcus Rashford",
            "dob": "1997-10-31",
            "height_cm": 185,
            "preferred_foot": "Right",
            "nation": "England",
            "club": "Manchester United",
        },
        "profile": {"position": "WF", "level": 85},
    },

    # ─── 74. Alejandro Garnacho ───────────────────────────────────────────
    {
        "person": {
            "name": "Alejandro Garnacho",
            "dob": "2004-07-01",
            "height_cm": 180,
            "preferred_foot": "Left",
            "nation": "Argentina",
            "club": "Manchester United",
        },
        "profile": {"position": "WF", "level": 84},
    },

    # ─── 75. Nico Williams ────────────────────────────────────────────────
    {
        "person": {
            "name": "Nico Williams",
            "dob": "2002-07-12",
            "height_cm": 181,
            "preferred_foot": "Right",
            "nation": "Spain",
            "club": "Athletic Bilbao",
        },
        "profile": {"position": "WF", "level": 86},
    },

    # ─── 76. Diogo Jota ──────────────────────────────────────────────────
    {
        "person": {
            "name": "Diogo Jota",
            "dob": "1996-12-04",
            "height_cm": 178,
            "preferred_foot": "Right",
            "nation": "Portugal",
            "club": "Liverpool",
            "active": False,
        },
        "profile": {"position": "CF", "level": 85},
    },

    # ─── 77. Kai Havertz ─────────────────────────────────────────────────
    {
        "person": {
            "name": "Kai Havertz",
            "dob": "1999-06-11",
            "height_cm": 193,
            "preferred_foot": "Left",
            "nation": "Germany",
            "club": "Arsenal",
        },
        "profile": {"position": "CF", "level": 88},
    },

    # ─── 78. Ollie Watkins ────────────────────────────────────────────────
    {
        "person": {
            "name": "Ollie Watkins",
            "dob": "1995-12-30",
            "height_cm": 180,
            "preferred_foot": "Right",
            "nation": "England",
            "club": "Aston Villa",
        },
        "profile": {"position": "CF", "level": 85},
    },

    # ─── 79. Lisandro Martínez ────────────────────────────────────────────
    {
        "person": {
            "name": "Lisandro Martínez",
            "dob": "1998-01-18",
            "height_cm": 175,
            "preferred_foot": "Left",
            "nation": "Argentina",
            "club": "Manchester United",
        },
        "profile": {"position": "CD", "level": 85},
    },

    # ─── 80. Antonio Rüdiger ─────────────────────────────────────────────
    {
        "person": {
            "name": "Antonio Rüdiger",
            "dob": "1993-03-03",
            "height_cm": 190,
            "preferred_foot": "Right",
            "nation": "Germany",
            "club": "Real Madrid",
        },
        "profile": {"position": "CD", "level": 87},
    },

    # ─── 81. Gabriel Magalhães ────────────────────────────────────────────
    {
        "person": {
            "name": "Gabriel Magalhães",
            "dob": "1997-12-19",
            "height_cm": 190,
            "preferred_foot": "Left",
            "nation": "Brazil",
            "club": "Arsenal",
        },
        "profile": {"position": "CD", "level": 89},
    },

    # ─── 82. Éderson ─────────────────────────────────────────────────────
    {
        "person": {
            "name": "Éderson",
            "dob": "1993-08-17",
            "height_cm": 188,
            "preferred_foot": "Left",
            "nation": "Brazil",
            "club": "Manchester City",
        },
        "profile": {"position": "GK", "level": 84},
    },

    # ─── 83. André Onana ─────────────────────────────────────────────────
    {
        "person": {
            "name": "André Onana",
            "dob": "1996-04-02",
            "height_cm": 190,
            "preferred_foot": "Right",
            "nation": "Cameroon",
            "club": "Manchester United",
        },
        "profile": {"position": "GK", "level": 83},
    },

    # ─── 84. Mike Maignan ────────────────────────────────────────────────
    {
        "person": {
            "name": "Mike Maignan",
            "dob": "1995-07-03",
            "height_cm": 191,
            "preferred_foot": "Right",
            "nation": "France",
            "club": "AC Milan",
        },
        "profile": {"position": "GK", "level": 86},
    },

    # ─── 85. Ryan Gravenberch ────────────────────────────────────────────
    {
        "person": {
            "name": "Ryan Gravenberch",
            "dob": "2002-05-16",
            "height_cm": 190,
            "preferred_foot": "Right",
            "nation": "Netherlands",
            "club": "Liverpool",
        },
        "profile": {"position": "CM", "level": 88},
    },

    # ─── 86. Warren Zaïre-Emery ──────────────────────────────────────────
    {
        "person": {
            "name": "Warren Zaïre-Emery",
            "dob": "2006-03-08",
            "height_cm": 178,
            "preferred_foot": "Right",
            "nation": "France",
            "club": "Paris Saint-Germain",
        },
        "profile": {"position": "CM", "level": 84},
    },

    # ─── 87. Ibrahima Konaté ─────────────────────────────────────────────
    {
        "person": {
            "name": "Ibrahima Konaté",
            "dob": "1999-05-25",
            "height_cm": 194,
            "preferred_foot": "Right",
            "nation": "France",
            "club": "Liverpool",
        },
        "profile": {"position": "CD", "level": 86},
    },

    # ─── 88. Sandro Tonali ───────────────────────────────────────────────
    {
        "person": {
            "name": "Sandro Tonali",
            "dob": "2000-05-08",
            "height_cm": 181,
            "preferred_foot": "Right",
            "nation": "Italy",
            "club": "Newcastle United",
        },
        "profile": {"position": "CM", "level": 88},
    },

    # ─── 89. Ángel Di María ──────────────────────────────────────────────
    {
        "person": {
            "name": "Ángel Di María",
            "dob": "1988-02-14",
            "height_cm": 180,
            "preferred_foot": "Left",
            "nation": "Argentina",
            "club": "Benfica",
        },
        "profile": {"position": "WF", "level": 81},
    },

    # ─── 90. Dani Carvajal ───────────────────────────────────────────────
    {
        "person": {
            "name": "Dani Carvajal",
            "dob": "1992-01-11",
            "height_cm": 173,
            "preferred_foot": "Right",
            "nation": "Spain",
            "club": "Real Madrid",
            "active": False,
        },
        "profile": {"position": "WD", "level": 87},
    },

    # ─── 91. Joshua Kimmich ──────────────────────────────────────────────
    {
        "person": {
            "name": "Joshua Kimmich",
            "dob": "1995-02-08",
            "height_cm": 177,
            "preferred_foot": "Right",
            "nation": "Germany",
            "club": "Bayern Munich",
        },
        "profile": {"position": "DM", "level": 88},
    },

    # ─── 92. Amadou Onana ────────────────────────────────────────────────
    {
        "person": {
            "name": "Amadou Onana",
            "dob": "2001-08-16",
            "height_cm": 195,
            "preferred_foot": "Right",
            "nation": "Belgium",
            "club": "Aston Villa",
        },
        "profile": {"position": "DM", "level": 87},
    },

    # ─── 93. Yves Bissouma ───────────────────────────────────────────────
    {
        "person": {
            "name": "Yves Bissouma",
            "dob": "1996-08-30",
            "height_cm": 182,
            "preferred_foot": "Right",
            "nation": "Mali",
            "club": "Tottenham Hotspur",
        },
        "profile": {"position": "DM", "level": 85},
    },

    # ─── 94. Manuel Ugarte ───────────────────────────────────────────────
    {
        "person": {
            "name": "Manuel Ugarte",
            "dob": "2001-04-11",
            "height_cm": 182,
            "preferred_foot": "Right",
            "nation": "Uruguay",
            "club": "Manchester United",
        },
        "profile": {"position": "DM", "level": 84},
    },

    # ─── 95. Edson Álvarez ───────────────────────────────────────────────
    {
        "person": {
            "name": "Edson Álvarez",
            "dob": "1997-10-24",
            "height_cm": 187,
            "preferred_foot": "Right",
            "nation": "Mexico",
            "club": "West Ham United",
        },
        "profile": {"position": "DM", "level": 84},
    },

    # ─── 96. Cheick Doucouré ─────────────────────────────────────────────
    {
        "person": {
            "name": "Cheick Doucouré",
            "dob": "2000-01-08",
            "height_cm": 183,
            "preferred_foot": "Right",
            "nation": "Mali",
            "club": "Crystal Palace",
        },
        "profile": {"position": "DM", "level": 85},
    },

    # ─── 97. Palhinha ────────────────────────────────────────────────────
    {
        "person": {
            "name": "João Palhinha",
            "dob": "1995-07-09",
            "height_cm": 190,
            "preferred_foot": "Right",
            "nation": "Portugal",
            "club": "Bayern Munich",
        },
        "profile": {"position": "DM", "level": 87},
    },

    # ─── 98. Enzo Fernández ──────────────────────────────────────────────
    {
        "person": {
            "name": "Enzo Fernández",
            "dob": "2001-01-17",
            "height_cm": 178,
            "preferred_foot": "Right",
            "nation": "Argentina",
            "club": "Chelsea",
        },
        "profile": {"position": "DM", "level": 88},
    },
]


# ── SQL templates ────────────────────────────────────────────────────────────

SQL_FIND_PERSON = "SELECT id FROM people WHERE name = %(name)s LIMIT 1;"

SQL_INSERT_PERSON = """
INSERT INTO people (id, name, date_of_birth, height_cm, preferred_foot, nation_id, club_id, active)
VALUES (
  (SELECT COALESCE(MAX(id), 0) + 1 FROM people),
  %(name)s, %(dob)s, %(height_cm)s, %(preferred_foot)s,
  (SELECT id FROM nations WHERE name = %(nation)s LIMIT 1),
  (SELECT id FROM clubs WHERE name = %(club)s OR name ILIKE %(club)s || '%%' ORDER BY (name = %(club)s)::int DESC LIMIT 1),
  %(active)s
)
RETURNING id;
"""

SQL_UPDATE_PERSON = """
UPDATE people SET
  date_of_birth  = %(dob)s,
  height_cm      = %(height_cm)s,
  preferred_foot = %(preferred_foot)s,
  nation_id      = (SELECT id FROM nations WHERE name = %(nation)s LIMIT 1),
  club_id        = (SELECT id FROM clubs WHERE name = %(club)s OR name ILIKE %(club)s || '%%' ORDER BY (name = %(club)s)::int DESC LIMIT 1),
  active         = %(active)s,
  updated_at     = now()
WHERE id = %(id)s;
"""

SQL_UPSERT_PROFILE = """
INSERT INTO player_profiles (person_id, position, level, overall, archetype, blueprint, profile_tier)
VALUES (%(person_id)s, %(position)s, %(level)s, %(overall)s, %(archetype)s, %(blueprint)s, %(profile_tier)s)
ON CONFLICT (person_id) DO UPDATE SET
  position = EXCLUDED.position, level = EXCLUDED.level,
  overall = EXCLUDED.overall, archetype = EXCLUDED.archetype,
  blueprint = EXCLUDED.blueprint, profile_tier = EXCLUDED.profile_tier,
  updated_at = now();
"""

SQL_UPSERT_PERSONALITY = """
INSERT INTO player_personality (person_id, ei, sn, tf, jp, competitiveness, coachability)
VALUES (%(person_id)s, %(ei)s, %(sn)s, %(tf)s, %(jp)s, %(competitiveness)s, %(coachability)s)
ON CONFLICT (person_id) DO UPDATE SET
  ei = EXCLUDED.ei, sn = EXCLUDED.sn, tf = EXCLUDED.tf, jp = EXCLUDED.jp,
  competitiveness = EXCLUDED.competitiveness, coachability = EXCLUDED.coachability,
  updated_at = now();
"""

SQL_UPSERT_MARKET = """
INSERT INTO player_market (person_id, market_value_tier, true_mvt, market_premium, scarcity_score, transfer_fee_eur, hg)
VALUES (%(person_id)s, %(market_value_tier)s, %(true_mvt)s, %(market_premium)s, %(scarcity_score)s, %(transfer_fee_eur)s, %(hg)s)
ON CONFLICT (person_id) DO UPDATE SET
  market_value_tier = EXCLUDED.market_value_tier, true_mvt = EXCLUDED.true_mvt,
  market_premium = EXCLUDED.market_premium, scarcity_score = EXCLUDED.scarcity_score,
  transfer_fee_eur = EXCLUDED.transfer_fee_eur, hg = EXCLUDED.hg,
  updated_at = now();
"""

SQL_UPSERT_STATUS = """
INSERT INTO player_status (person_id, pursuit_status, scouting_notes, squad_role{extra_cols})
VALUES (%(person_id)s, %(pursuit_status)s, %(scouting_notes)s, %(squad_role)s{extra_vals})
ON CONFLICT (person_id) DO UPDATE SET
  pursuit_status = EXCLUDED.pursuit_status, scouting_notes = EXCLUDED.scouting_notes,
  squad_role = EXCLUDED.squad_role{extra_update},
  updated_at = now();
"""

SQL_UPSERT_ATTR = """
INSERT INTO attribute_grades (player_id, attribute, scout_grade, stat_score, source, is_inferred, confidence)
VALUES (%(player_id)s, %(attribute)s, %(scout_grade)s, NULL, 'scout_assessment', false, %(confidence)s)
ON CONFLICT (player_id, attribute, source) DO UPDATE SET
  scout_grade = EXCLUDED.scout_grade, confidence = EXCLUDED.confidence,
  updated_at = now();
"""


def _build_status_sql(status: dict) -> tuple[str, dict]:
    """Build status SQL with optional fitness_tag / contract_tag columns."""
    extra_cols = ""
    extra_vals = ""
    extra_update = ""
    params = dict(status)

    if "fitness_tag" in status:
        extra_cols += ", fitness_tag"
        extra_vals += ", %(fitness_tag)s"
        extra_update += ", fitness_tag = EXCLUDED.fitness_tag"
    if "contract_tag" in status:
        extra_cols += ", contract_tag"
        extra_vals += ", %(contract_tag)s"
        extra_update += ", contract_tag = EXCLUDED.contract_tag"

    sql = SQL_UPSERT_STATUS.format(
        extra_cols=extra_cols, extra_vals=extra_vals, extra_update=extra_update
    )
    return sql, params


def seed_player(cur, player: dict) -> None:
    """Insert or update a single player across all tables."""
    name = player["person"]["name"]

    # 1. people — find existing or insert new
    person_data = {**player["person"]}
    person_data.setdefault("active", True)
    cur.execute(SQL_FIND_PERSON, {"name": name})
    row = cur.fetchone()
    if row:
        person_id = row[0]
        cur.execute(SQL_UPDATE_PERSON, {**person_data, "id": person_id})
        print(f"  people: {name} → id={person_id} (updated)")
    else:
        cur.execute(SQL_INSERT_PERSON, person_data)
        person_id = cur.fetchone()[0]
        print(f"  people: {name} → id={person_id} (inserted)")

    # 2. player_profiles
    if "profile" in player:
        profile = {**player["profile"], "person_id": person_id}
        # Default optional fields
        profile.setdefault("overall", None)
        profile.setdefault("archetype", None)
        profile.setdefault("blueprint", None)
        profile.setdefault("profile_tier", None)
        cur.execute(SQL_UPSERT_PROFILE, profile)
        print(f"  profile: {player['profile'].get('archetype', '(level only)')}")

    # 3. player_personality
    if "personality" in player:
        personality = {**player["personality"], "person_id": person_id}
        cur.execute(SQL_UPSERT_PERSONALITY, personality)

    # 4. player_market
    if "market" in player:
        market = {**player["market"], "person_id": person_id}
        cur.execute(SQL_UPSERT_MARKET, market)

    # 5. player_status
    if "status" in player:
        status = {**player["status"], "person_id": person_id}
        sql, params = _build_status_sql(status)
        cur.execute(sql, params)

    # 6. attribute_grades (32 attributes)
    if "attributes" in player:
        for attr_name, (grade, confidence) in player["attributes"].items():
            cur.execute(SQL_UPSERT_ATTR, {
                "player_id": person_id,
                "attribute": attr_name,
                "scout_grade": grade,
                "confidence": confidence,
            })
        print(f"  attributes: {len(player['attributes'])} grades")


def main():
    if not POSTGRES_DSN:
        print("ERROR: POSTGRES_DSN not set. Check .env.local")
        sys.exit(1)

    print(f"Seeding {len(PLAYERS)} player profiles...")
    if DRY_RUN:
        print("DRY RUN — no changes will be committed.\n")

    conn = psycopg2.connect(POSTGRES_DSN)
    try:
        with conn.cursor() as cur:
            for i, player in enumerate(PLAYERS, 1):
                name = player["person"]["name"]
                print(f"\n[{i}/{len(PLAYERS)}] {name}")
                seed_player(cur, player)

        if DRY_RUN:
            conn.rollback()
            print("\nDRY RUN complete — rolled back.")
        else:
            conn.commit()
            print(f"\nCommitted {len(PLAYERS)} profiles successfully.")
    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
