# Staff.gd
extends Node

class_name Staff

# Staff attributes
var name = ""
var role = ""
var expertise = 0  # Level of expertise (1-100)

# Function to provide tactical input
func provide_tactical_input(team, opponents):
    return {}

