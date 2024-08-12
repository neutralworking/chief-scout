extends Control

# Define the parameters for the transfer negotiation
var player_data = {
    "level": 85,
    "age": 27,
    "nationality": "Brazilian",
    "homegrown_status": false,
    "position": "Striker",
    "playing_style": "Poacher",
    "reputation": 90,
    "hype": 75,
    "wage": 100000,
    "contract_length": 3,
    "club_status": "First Team",
    "club_position_rank": 1,
    "club_relationship": "Good"
}

var club_data_selling = {
    "primary_objective": "Win League",
    "secondary_objective": "Develop Youth",
    "recruitment_objective": "Strengthen Defense",
    "club_relationship": "Neutral"
}

var club_data_buying = {
    "primary_objective": "Top 4 Finish",
    "secondary_objective": "Increase Marketability",
    "recruitment_objective": "Boost Attack",
    "club_relationship": "Good"
}

# Function to calculate transfer value
func calculate_transfer_value(player_data, club_data_selling, club_data_buying):
    var base_value = player_data["level"] * 100000
    base_value += player_data["reputation"] * 50000
    base_value += (player_data["hype"] * player_data["reputation"]) / player_data["age"] * 1000

    if player_data["homegrown_status"]:
        base_value *= 1.2

    if player_data["club_status"] == "Key Player":
        base_value *= 1.3

    var contract_factor = player_data["contract_length"] / 2
    base_value *= contract_factor

    if club_data_selling["primary_objective"] == "Win League":
        base_value *= 1.1

    if club_data_buying["recruitment_objective"] == "Boost Attack" and player_data["position"] == "Striker":
        base_value *= 1.2

    return base_value

# Function to initiate negotiation
func initiate_negotiation():
    var transfer_value = calculate_transfer_value(player_data, club_data_selling, club_data_buying)
    var proposed_wage = player_data["wage"] * 1.2
    var proposed_contract_length = player_data["contract_length"] + 1

    print("Initial Transfer Value: ", transfer_value)
    print("Proposed Wage: ", proposed_wage)
    print("Proposed Contract Length: ", proposed_contract_length)

    # Here you can add further negotiation logic
    # For example, allowing the user to accept, reject or counter the offer

func _ready():
    initiate_negotiation()

# Function to handle user decision (accept, reject, counter)
func handle_user_decision(decision):
    if decision == "accept":
        print("Transfer Accepted")
        # Add logic to finalize the transfer
    elif decision == "reject":
        print("Transfer Rejected")
        # Add logic to end the negotiation
    elif decision == "counter":
        print("Counter Offer")
        # Add logic for counter offer negotiation
