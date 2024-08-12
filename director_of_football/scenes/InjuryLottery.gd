# InjurySimulation.gd
extends Node

class_name InjurySimulation

# List of possible injuries
var possible_injuries = [
    Injury.new("Sprained Ankle", 3, 14),
    Injury.new("Hamstring Strain", 5, 21),
    Injury.new("Knee Ligament Tear", 8, 90),
    Injury.new("Concussion", 4, 10),
    Injury.new("Fractured Arm", 6, 30)
]

# Function to simulate injuries during a match
func simulate_match_injuries(players):
    for player in players:
        if randf() < 0.05:  # 5% chance of getting injured during a match
            var injury = possible_injuries[randi() % possible_injuries.size()]
            player.apply_injury(injury)

# Function to simulate injuries during training
func simulate_training_injuries(players):
    for player in players:
        if randf() < 0.02:  # 2% chance of getting injured during training
            var injury = possible_injuries[randi() % possible_injuries.size()]
            player.apply_injury(injury)