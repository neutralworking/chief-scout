extends Node

class_name Player

# Player attributes
var name = ""
var level = ""
var overall_score = ""
var club = ""
var agent = null  # Reference to the player's agent
var motivation = 0
var is_injured = false
var current_injury = null
var injury_recovery_days = 0
var is_promised_playing_time = false
var fitness = 100
var fatigue = 0
var form = 0  # New attribute for current form (1-100)

# Initialize the player with an agent
func _init(agent_instance):
    agent = agent_instance

# Function to adjust form based on fatigue
func adjust_form():
    var fatigue_impact = fatigue / 100.0
    form = max(0, form - int(form * fatigue_impact))

# Function to simulate player training
func train():
    # Simulate training effects on fitness and fatigue
    fitness = min(100, fitness + 5)
    fatigue = min(100, fatigue + 10)

# Function to simulate player recovery
func recover():
    # Simulate recovery effects on fitness and fatigue
    fitness = min(100, fitness + 10)
    fatigue = max(0, fatigue - 10)

# Function to apply an injury to the player
func apply_injury(injury):
    is_injured = true
    current_injury = injury
    injury_recovery_days = injury.recovery_time

# Function to recover from injury
func recover_from_injury():
    if injury_recovery_days > 0:
        injury_recovery_days -= 1
    if injury_recovery_days == 0:
        is_injured = false
        current_injury = null

# Function to adjust form based on fatigue and injuries
func adjust_form():
    var fatigue_impact = fatigue / 100.0
    form = max(0, form - int(form * fatigue_impact))
    if is_injured:
        form = max(0, form - int(form * 0.5))  # Injured players perform worse

# Function to simulate player transfer
func transfer_to(new_club):
    club = new_club
    agent.receive_transfer_fee(1000000)  # Simulate agent receiving transfer fee

# Function to simulate player contract renewal
func renew_contract():
    agent.receive_contract_fee(50000)  # Simulate agent receiving contract fee

# Function to simulate player request for playing time
func request_playing_time():
    is_promised_playing_time = true

# Function to simulate player playing time fulfillment
func fulfill_playing_time_promise():
    is_promised_playing_time = false

# Function to simulate player motivation
func motivate():
    motivation = 100

# Function to simulate player demotivation
func demotivate():
    motivation = 0

# Function to simulate player form boost
func boost_form():
    form = min(100, form + 10)

# Function to simulate player form drop
func drop_form():
    form = max(0, form - 10)

# Function to simulate player performance
func perform():
    # Simulate player performance affecting form
    form = max(0, form - 5)

# Function to simulate player rest
func rest():
    # Simulate rest affecting fatigue
    fatigue = max(0, fatigue - 10)    

# Function to simulate player suspension
func suspend():
    # Simulate suspension affecting form and fitness
    form = max(0, form - 20)
    fitness = max(0, fitness - 20)

# Function to simulate player transfer request
func request_transfer():
    agent.request_transfer()

# Function to simulate player contract termination
func terminate_contract():
    agent.terminate_contract()

# Function to simulate player contract extension
func extend_contract():
    agent.extend_contract()

# Function to simulate player contract release clause activation
func activate_release_clause():
    agent.activate_release_clause()

# Function to simulate player contract negotiation
func negotiate_contract():
    agent.negotiate_contract()

# Function to simulate player contract buyout
func buyout_contract():
    agent.buyout_contract()

# Adjust value based on performance and form
func adjust_value_based_on_performance():
    var performance_factor = form / 100.0
    current_value *= (1 + performance_factor)

# Adjust value based on age and potential
func adjust_value_based_on_age_and_potential():
    if age < 25:
        current_value *= (1 + potential / 100.0)
    else:
        current_value *= (1 - age / 100.0)

# Adjust value based on injuries
func adjust_value_based_on_injuries():
    if is_injured:
        current_value *= (1 - injury_impact / 100.0)

# Update player value
func update_value():
    current_value = base_value
    adjust_value_based_on_performance()
    adjust_value_based_on_age_and_potential()
    adjust_value_based_on_injuries()

    

# Define player properties
var player_data = {
    "name": "",
    "level": ,
    "age": ,
    "nationality": "",
    "homegrown_status": ,
    "position": "",
    "playing_style": "",
    "reputation": ,
    "hype": ,
    "wage": ,
    "contract_length": ,
    "club_status": "",
    "club_position_rank": ,
    "club_relationship": ""
}

# Define player abilities
var player_ability = {
    "Name": "",
    "Level": "",
    "OverallScore": "",
    "Club": "",
    "Mental": {
        "Decisions": "",
        "Composure": "",
        "Leadership": "",
        "Communication": "",
        "Drive": "",
        "Discipline": "",
        "Guile": "",
        "Vision": "",
        "Anticipation": "",
        "Awareness": "",
        "Concentration": ""
    },
    "Physical": {
        "Balance": "",
        "Carries": "",
        "Flair": "",
        "Pace": "",
        "Acceleration": "",
        "Agility": "",
        "Recovery": "",
        "Stamina": "",
        "Bravery": "",
        "Aerial Duels": "",
        "Reactions": "",
        "Throwing": "",
        "Hold Up": "",
        "Duels": "",
        "Aggression": "",
        "Coordination": "",
        "Jumping": ""
    },
    "Tactical": {
        "Tempo": "",
        "Movement": "",
        "Positioning": "",
        "Pressing": "",
        "Blocking": "",
        "Marking": "",
        "Tackling": ""
    },
    "Technical": {
        "First Touch": "",
        "Skills": "",
        "Takeons": "",
        "Close": "",
        "Long Shots": "",
        "Penalty": "",
        "Set Piece": "",
        "Pass Accuracy": "",
        "Cross": "",
        "Pass Range": "",
        "Through": ""
    }
}

# Define the value dictionary
var player_value = {
    "base_value": 0,
    "wage_level": 0,
    "on_pitch_value": 0,
    "personal_value": 0,
    "total_value": 0
}
