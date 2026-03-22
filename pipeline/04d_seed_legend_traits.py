"""
04d_seed_legend_traits.py — Seed editorial playing style traits for top legends.

Assigns 2-3 defining traits per legend (peak >= 92) to player_trait_scores.
These are editorial descriptors that can't be derived from stats.

Usage:
    python pipeline/04d_seed_legend_traits.py              # run
    python pipeline/04d_seed_legend_traits.py --dry-run    # preview
    python pipeline/04d_seed_legend_traits.py --player ID  # single player
"""

import argparse
import psycopg2

from config import POSTGRES_DSN

TRAIT_CATEGORY = {
    "set_piece_specialist": "tactical", "dribble_artist": "style",
    "playmaker_vision": "style", "through_ball_king": "style",
    "one_touch_play": "style", "tempo_controller": "style",
    "long_range_threat": "tactical", "fox_in_the_box": "tactical",
    "sweeper_reader": "tactical", "brick_wall": "tactical",
    "hard_man": "tactical", "captain_leader": "tactical",
    "target_man": "physical", "pace_merchant": "physical",
    "big_game_player": "behavioral", "clutch": "behavioral",
}

# person_id → list of trait names (2-3 per legend)
LEGEND_TRAITS = {
    # ═══ GOAT TIER (95-96) ═══
    10296: ["dribble_artist", "playmaker_vision"],                    # Maradona
    16251: ["fox_in_the_box", "big_game_player", "pace_merchant"],   # Pelé
    16832: ["pace_merchant", "dribble_artist"],                       # Ronaldo Nazário
    11267: ["dribble_artist", "pace_merchant"],                       # Garrincha
    8224:  ["captain_leader", "big_game_player"],                     # Di Stéfano
    11165: ["sweeper_reader", "captain_leader", "tempo_controller"],  # Beckenbauer
    12783: ["dribble_artist", "playmaker_vision", "tempo_controller"],# Cruyff
    16077: ["brick_wall", "captain_leader"],                          # Maldini
    18787: ["tempo_controller", "playmaker_vision", "big_game_player"],# Zidane
    10992: ["long_range_threat", "fox_in_the_box"],                   # Puskás
    13869: ["brick_wall", "captain_leader"],                          # Yashin

    # ═══ PEAK 94 ═══
    9086:  ["long_range_threat", "captain_leader"],                   # Bobby Charlton
    11401: ["brick_wall", "big_game_player", "captain_leader"],       # Buffon
    15114: ["set_piece_specialist", "playmaker_vision"],              # Platini
    17905: ["pace_merchant", "fox_in_the_box", "big_game_player"],   # Henry
    16831: ["dribble_artist", "one_touch_play"],                      # Ronaldinho
    15082: ["through_ball_king", "one_touch_play", "playmaker_vision"],# Laudrup
    16676: ["long_range_threat", "set_piece_specialist"],             # Rivellino
    13961: ["brick_wall", "pace_merchant"],                           # Thuram
    11140: ["sweeper_reader", "captain_leader"],                      # Baresi
    9279:  ["pace_merchant", "captain_leader"],                       # Cafú
    10507: ["brick_wall", "sweeper_reader"],                          # Van der Sar
    18779: ["set_piece_specialist", "playmaker_vision", "long_range_threat"],# Zico
    11306: ["dribble_artist", "big_game_player"],                     # George Best
    10830: ["pace_merchant", "fox_in_the_box", "long_range_threat"],  # Eusébio

    # ═══ PEAK 93 ═══
    11157: ["hard_man", "captain_leader"],                            # Rijkaard
    10474: ["dribble_artist", "playmaker_vision"],                    # Hazard
    14024: ["captain_leader", "long_range_threat", "hard_man"],       # Matthäus
    9090:  ["sweeper_reader", "captain_leader"],                      # Bobby Moore
    14145: ["dribble_artist", "set_piece_specialist"],                # Figo
    11944: ["brick_wall", "clutch"],                                  # Casillas
    9896:  ["pace_merchant", "dribble_artist"],                       # Dani Alves
    14482: ["fox_in_the_box", "one_touch_play"],                      # Van Basten
    8449:  ["tempo_controller", "set_piece_specialist", "through_ball_king"],# Pirlo
    17666: ["long_range_threat", "captain_leader", "big_game_player"],# Gerrard
    18570: ["tempo_controller", "one_touch_play", "through_ball_king"],# Xavi
    16179: ["long_range_threat", "tempo_controller", "through_ball_king"],# Scholes
    8482:  ["dribble_artist", "one_touch_play", "tempo_controller"],  # Iniesta
    11263: ["pace_merchant", "long_range_threat"],                    # Bale
    16921: ["dribble_artist", "target_man"],                          # Gullit
    14435: ["hard_man", "brick_wall"],                                # Desailly
    8691:  ["dribble_artist", "long_range_threat"],                   # Robben
    16279: ["brick_wall", "captain_leader"],                          # Schmeichel
    13292: ["pace_merchant", "dribble_artist", "big_game_player"],    # Kaká

    # ═══ PEAK 92 ═══
    11218: ["long_range_threat", "big_game_player"],                  # Batistuta
    12459: ["captain_leader", "hard_man"],                            # Zanetti
    18796: ["target_man", "long_range_threat", "dribble_artist"],     # Ibrahimović
    18637: ["long_range_threat", "pace_merchant"],                    # Yaya Touré
    16133: ["hard_man", "captain_leader"],                            # Vieira
    16721: ["dribble_artist", "playmaker_vision"],                    # Baggio
    16871: ["hard_man", "captain_leader", "big_game_player"],         # Roy Keane
    10230: ["one_touch_play", "playmaker_vision"],                    # Bergkamp
    18566: ["tempo_controller", "through_ball_king"],                 # Xabi Alonso
    17338: ["fox_in_the_box", "clutch"],                              # Agüero
    10876: ["brick_wall", "captain_leader"],                          # Cannavaro
    11368: ["fox_in_the_box", "big_game_player"],                     # Gerd Müller
    11123: ["playmaker_vision", "set_piece_specialist", "long_range_threat"],# Totti
    16722: ["long_range_threat", "pace_merchant", "set_piece_specialist"],# Roberto Carlos
    16745: ["fox_in_the_box", "one_touch_play"],                      # Van Persie
    16320: ["sweeper_reader", "captain_leader"],                      # Lahm
    10064: ["set_piece_specialist", "through_ball_king"],             # Beckham
    16810: ["pace_merchant", "fox_in_the_box"],                       # Romário
    16675: ["long_range_threat", "dribble_artist", "big_game_player"],# Rivaldo
    15611: ["hard_man", "brick_wall", "captain_leader"],              # Vidić
    16947: ["pace_merchant", "dribble_artist"],                       # Giggs
}


def main():
    parser = argparse.ArgumentParser(description="Seed editorial traits for legends.")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--player", type=int, help="Seed single player by person_id")
    args = parser.parse_args()

    conn = psycopg2.connect(POSTGRES_DSN)
    cur = conn.cursor()
    total = 0

    seeds = LEGEND_TRAITS
    if args.player:
        seeds = {args.player: LEGEND_TRAITS.get(args.player, [])}
        if not seeds[args.player]:
            print(f"No traits defined for player {args.player}")
            return

    for person_id, traits in seeds.items():
        for trait in traits:
            category = TRAIT_CATEGORY.get(trait, "style")
            if args.dry_run:
                print(f"  [DRY] {person_id}: {trait} ({category}, severity=7)")
            else:
                cur.execute("""
                    INSERT INTO player_trait_scores (player_id, trait, category, severity, source)
                    VALUES (%s, %s, %s, 7, 'scout')
                    ON CONFLICT (player_id, trait, source)
                    DO UPDATE SET severity = EXCLUDED.severity, category = EXCLUDED.category
                """, (person_id, trait, category))
            total += 1

    if not args.dry_run:
        conn.commit()
        print(f"Seeded {total} traits for {len(seeds)} legends.")
    else:
        print(f"[DRY RUN] Would seed {total} traits for {len(seeds)} legends.")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
