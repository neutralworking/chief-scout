extends Node

# Reference to the agent class
var agent_script = preload("res://Agent.gd")
var player_score = (club_needs_weight * club_needs_score) +
                   (attributes_weight * attributes_score) +
                   (potential_weight * potential_score) +
                   (availability_weight * availability_score) +
                   (cost_weight * cost_score) +
                   (scouting_report_quality_weight * scouting_report_quality_score) +
                   (market_conditions_weight * market_conditions_score)

# Function to attempt a player transfer
func attempt_transfer(player, club):
    if transfer_enabled:
        var agent = player.agent
        var base_transfer_fee = calculate_base_transfer_fee(player)
        var agent_fee = base_transfer_fee * (agent.fee_percentage / 100)
        
        # Adjust transfer fee based on agent reputation
        var adjusted_transfer_fee = base_transfer_fee * (1 + (agent.reputation / 100))
        
        # Check if the agent prefers the club
        if agent.prefers_club(club.name):
            adjusted_transfer_fee *= 0.9  # Give a discount if the agent prefers the club
        
        # Simulate negotiation
        print("Negotiating transfer for player: ", player.name)
        print("Base Transfer Fee: ", base_transfer_fee)
        print("Agent Fee: ", agent_fee)
        print("Adjusted Transfer Fee: ", adjusted_transfer_fee)
        
        # Assume negotiation success for simplicity
        finalize_transfer(player, club, adjusted_transfer_fee, agent_fee)
    else:
        print("Transfer window is closed. Cannot transfer player: ", player.name)

# Function to finalize the transfer
func finalize_transfer(player, club, transfer_fee, agent_fee):
    print("Transfer successful!")
    print("Player: ", player.name, " moved to Club: ", club.name)
    print("Transfer Fee: ", transfer_fee, " Agent Fee: ", agent_fee)
    # Additional logic to update player and club data