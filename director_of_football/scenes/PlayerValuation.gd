# PlayerValuation.gd
extends Node

# Core attributes influencing the player's valuation
var base_value = 1000000  # Initial base value in currency
var current_form = 0.0  # Performance metric, ranges from 0.0 (poor) to 1.0 (excellent)
var consistency = 0.5  # How consistent the player is, from 0.0 to 1.0
var age = 25  # Player's age
var potential = 0.8  # Player potential, ranges from 0.0 to 1.0
var position = "Striker"  # Player's position
var contract_length = 3  # Years remaining on contract
var wage_demand = 50000  # Weekly wage in currency
var market_conditions = 1.0  # Market inflation or deflation factor

# Additional club and league factors
var club_reputation = 0.7  # Club's reputation, from 0.0 to 1.0
var league_competitiveness = 0.8  # League's competitiveness, from 0.0 to 1.0
var external_event_influence = 1.0  # Factor influenced by rumors, etc.

# Calculate dynamic player valuation
func calculate_valuation():
    var value = base_value
    
    # Adjust value based on player performance
    value *= 1.0 + (current_form * 0.5)  # Boost for good form
    value *= 1.0 + (consistency * 0.3)  # Boost for consistency
    
    # Adjust value based on age and potential
    if age < 26:
        value *= 1.0 + (potential * 0.4)  # Young players with high potential are more valuable
    else:
        value *= 1.0 - ((age - 26) * 0.05)  # Older players may decrease in value
    
    # Adjust value based on contract status
    value *= 1.0 + (contract_length * 0.1)  # Longer contracts increase value
    value *= 1.0 - (wage_demand / 100000)  # High wage demands may lower value
    
    # Adjust value based on market conditions
    value *= market_conditions  # Market inflation or deflation
    value *= club_reputation * league_competitiveness  # Influence of club and league status
    value *= external_event_influence  # Influence from rumors and media
    
    return value

# Example of how you might use the calculate_valuation function
func _ready():
    var player_value = calculate_valuation()
    print("Player Valuation: %d" % player_value)
