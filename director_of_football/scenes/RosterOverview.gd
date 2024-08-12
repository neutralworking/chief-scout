# RosterOverview.gd
extends Control

# Tabs container
onready var tabs = $Tabs

# Tab content containers
onready var profile_container = $ProfileContainer
onready var financial_container = $FinancialContainer
onready var performance_container = $PerformanceContainer
onready var scouting_container = $ScoutingContainer
onready var transfer_container = $TransferContainer

# Function to switch tabs
func _on_Tabs_tab_selected(tab_index):
    profile_container.visible = tab_index == 0
    financial_container.visible = tab_index == 1
    performance_container.visible = tab_index == 2
    scouting_container.visible = tab_index == 3
    transfer_container.visible = tab_index == 4

# Example data
var players = [
    {"name": "Player 1", "position": "Forward", "age": 23, "level": 80, "current_value": 5000000, "contract_length": 3, "form": 75, "is_injured": false, "potential": 90, "market_demand": 70, "total_transfers": 2, "total_fees": 7000000},
    {"name": "Player 2", "position": "Midfielder", "age": 28, "level": 75, "current_value": 3000000, "contract_length": 2, "form": 65, "is_injured": true, "potential": 85, "market_demand": 50, "total_transfers": 1, "total_fees": 3000000}
]

func _ready():
    populate_profiles()
    populate_financials()
    populate_performance()
    populate_scouting()
    populate_transfers()

func populate_profiles():
    for player in players:
        var player_info = Label.new()
        player_info.text = "Name: %s, Position: %s, Age: %d, Level: %d".format([player["name"], player["position"], player["age"], player["level"]])
        profile_container.add_child(player_info)

func populate_financials():
    for player in players:
        var financial_info = Label.new()
        financial_info.text = "Name: %s, Value: %d, Contract: %d years".format([player["name"], player["current_value"], player["contract_length"]])
        financial_container.add_child(financial_info)

func populate_performance():
    for player in players:
        var performance_info = Label.new()
        performance_info.text = "Name: %s, Form: %d, Injured: %s".format([player["name"], player["form"], str(player["is_injured"])])
        performance_container.add_child(performance_info)

func populate_scouting():
    for player in players:
        var scouting_info = Label.new()
        scouting_info.text = "Name: %s, Potential: %d, Market Demand: %d".format([player["name"], player["potential"], player["market_demand"]])
        scouting_container.add_child(scouting_info)

func populate_transfers():
    for player in players:
        var transfer_info = Label.new()
        transfer_info.text = "Name: %s, Transfers: %d, Total Fees: %d".format([player["name"], player["total_transfers"], player["total_fees"]])
        transfer_container.add_child(transfer_info)
