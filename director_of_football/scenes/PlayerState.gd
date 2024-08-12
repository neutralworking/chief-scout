# PlayerState.gd
extends Node

class_name PlayerState

# Player states (simplified for illustration)
const STATE_ACTIVE = "active"
const STATE_INJURED = "injured"
const STATE_TRANSFERRED = "transferred"

# Define transition probabilities (simplified example)
var transition_probabilities = {
    STATE_ACTIVE: {
        STATE_ACTIVE: 0.8,
        STATE_INJURED: 0.1,
        STATE_TRANSFERRED: 0.1
    },
    STATE_INJURED: {
        STATE_ACTIVE: 0.5,
        STATE_INJURED: 0.4,
        STATE_TRANSFERRED: 0.1
    },
    STATE_TRANSFERRED: {
        STATE_ACTIVE: 1.0  # Always become active after transfer
    }
}

# Function to simulate state transition
func transition_state(current_state):
    var rand_val = randf()
    var cumulative_prob = 0.0
    for state in transition_probabilities[current_state].keys():
        cumulative_prob += transition_probabilities[current_state][state]
        if rand_val <= cumulative_prob:
            return state
    return current_state  # Default to current state if no transition