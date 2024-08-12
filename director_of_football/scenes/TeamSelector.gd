# TeamSelector.gd
extends Node

class_name TeamSelector

# Function to select the team for the next match
func select_team(team, league_rules):
    adjust_player_forms(team.players)
    var eligible_players = get_eligible_players(team.players, league_rules)
    var filtered_players = filter_players(eligible_players)
    var selected_team = select_preferred_players(filtered_players, team.formation)
    return selected_team

# Function to adjust player forms based on fatigue and injuries
func adjust_player_forms(players):
    for player in players:
        player.adjust_form()

# Eligibility phase: Determine who is eligible to play
func get_eligible_players(players, league_rules):
    var eligible_players = []
    for player in players:
        if not player.is_injured and is_league_eligible(player, league_rules) and is_team_eligible(player):
            eligible_players.append(player)
    return eligible_players

func is_league_eligible(player, league_rules):
    # Implement league-specific rules here
    return true

func is_team_eligible(player):
    # Implement team-specific rules here
    return true

# Filtration phase: Filter players based on suitability
func filter_players(players):
    var filtered_players = {}
    for player in players:
        if player.position not in filtered_players:
            filtered_players[player.position] = []
        filtered_players[player.position].append(player)
    
    for position in filtered_players.keys():
        filtered_players[position].sort_custom(Player, "compare_level_and_form")
    return filtered_players

func sort_custom(players, comparator):
    return players.sort_custom(Player, comparator)

# Selection phase: Choose the most preferable players
func select_preferred_players(filtered_players, formation):
    var selected_team = []
    for position in formation.keys():
        var num_players_needed = formation[position]
        var players_in_position = filtered_players.get(position, [])
        
        # Sort by promises, form, fitness, and motivation
        players_in_position.sort_custom(Player, "compare_preference")
        
        # Select the required number of players for each position
        for i in range(min(num_players_needed, len(players_in_position))):
            selected_team.append(players_in_position[i])
    return selected_team

# Comparison functions for sorting
func compare_level_and_form(player1, player2):
    # Consider both level and form for filtration
    var score1 = player1.level * 0.7 + player1.form * 0.3
    var score2 = player2.level * 0.7 + player2.form * 0.3
    return score2 - score1

func compare_preference(player1, player2):
    if player1.is_promised_playing_time and not player2.is_promised_playing_time:
        return -1
    elif not player1.is_promised_playing_time and player2.is_promised_playing_time:
        return 1
    elif player1.form != player2.form:
        return player2.form - player1.form
    elif player1.fitness != player2.fitness:
        return player2.fitness - player1.fitness
    else:
        return player2.motivation - player1.motivation
