# ClubObjectives.gd
extends Node

class_name ClubObjectives

var short_term_objectives = []
var long_term_objectives = []

func _init():
    # Example objectives for a club
    short_term_objectives = [
        {"objective": "Finish in the top 4 positions in the league", "status": "Incomplete"},
        {"objective": "Reach the semi-finals of the domestic cup", "status": "Incomplete"},
        {"objective": "Sign at least two key players", "status": "Incomplete"},
        {"objective": "Maintain a positive goal difference", "status": "Incomplete"},
        {"objective": "Increase average match attendance by 10%", "status": "Incomplete"}
    ]
    
    long_term_objectives = [
        {"objective": "Win the domestic league title within three seasons", "status": "Incomplete"},
        {"objective": "Qualify for the Champions League and reach the knockout stages", "status": "Incomplete"},
        {"objective": "Promote at least two youth players to the first team each season", "status": "Incomplete"},
        {"objective": "Improve training facilities to world-class standards", "status": "Incomplete"},
        {"objective": "Maintain a possession-based playing style", "status": "Incomplete"}
    ]

# Function to update the status of an objective
func update_objective(objective, status):
    for obj in short_term_objectives:
        if obj["objective"] == objective:
            obj["status"] = status
            return

    for obj in long_term_objectives:
        if obj["objective"] == objective:
            obj["status"] = status
            return
