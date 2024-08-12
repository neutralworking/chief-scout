extends Node2D

var clubs = [
    {"name": "Club A", "ranking": 1, "budget": 1000000},
    {"name": "Club B", "ranking": 2, "budget": 900000},
    # Add remaining clubs here...
]

func _ready():
    randomize()
    var selected_clubs = []
    while selected_clubs.size() < 3:
        var club = clubs[randi() % clubs.size()]
        if club not in selected_clubs:
            selected_clubs.append(club)
    display_clubs(selected_clubs)

func display_clubs(selected_clubs):
    for club in selected_clubs:
        # Create UI elements to display club info
        pass

func _on_ClubButton_pressed(club_index):
    var club = selected_clubs[club_index]
    # Proceed to Interview with the selected club
    get_tree().change_scene("res://Interview.tscn")
