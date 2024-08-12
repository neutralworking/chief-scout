# Radar.gd
extends Node

# Weights for each criterion (can be adjusted based on club priorities)
var club_needs_weight = 2.0
var attributes_weight = 1.5
var potential_weight = 1.2
var availability_weight = 1.0
var cost_weight = 0.8
var scouting_report_quality_weight = 1.0
var market_conditions_weight = 0.5

# Calculate player score based on various criteria
func calculate_player_score(player):
    var club_needs_score = get_club_needs_score(player)
    var attributes_score = get_attributes_score(player)
    var potential_score = get_potential_score(player)
    var availability_score = get_availability_score(player)
    var cost_score = get_cost_score(player)
    var scouting_report_quality_score = get_scouting_report_quality_score(player)
    var market_conditions_score = get_market_conditions_score(player)
    
    var player_score = (club_needs_weight * club_needs_score) +
                       (attributes_weight * attributes_score) +
                       (potential_weight * potential_score) +
                       (availability_weight * availability_score) +
                       (cost_weight * cost_score) +
                       (scouting_report_quality_weight * scouting_report_quality_score) +
                       (market_conditions_weight * market_conditions_score)
    
    return player_score

# Example methods to calculate each criterion score
func get_club_needs_score(player):
    # Example logic: Score higher if the player fits a critical positional need
    if player.position == "Striker" and club_needs_striker():
        return 10
    elif player.position == "Midfielder" and club_needs_midfielder():
        return 8
    else:
        return 5  # Default score

func get_attributes_score(player):
    # Example logic: Average of key attributes
    return (player.pace + player.shooting + player.passing) / 3.0

func get_potential_score(player):
    # Example logic: Potential rating as given by scouts
    return player.potential

func get_availability_score(player):
    # Example logic: Higher if the player is actively looking for a move
    return player.availability

func get_cost_score(player):
    # Example logic: Score higher if the player is affordable
    var budget = get_transfer_budget()
    return (budget / player.cost) * 10.0

func get_scouting_report_quality_score(player):
    # Example logic: Higher if there are detailed reports
    return player.scouting_report_quality

func get_market_conditions_score(player):
    # Example logic: Adjust score based on market demand for this position
    return player.market_conditions

# Example radar list of players
var radar_players = []

func prioritize_radar_players():
    var prioritized_list = []
    
    for player in radar_players:
        var score = calculate_player_score(player)
        player.score = score
        prioritized_list.append(player)
    
    # Sort players by score (highest to lowest)
    prioritized_list.sort_custom(self, "sort_by_score")
    
    return prioritized_list

# Sort function for players
func sort_by_score(player1, player2):
    return player2.score - player1.score  # Higher scores first
