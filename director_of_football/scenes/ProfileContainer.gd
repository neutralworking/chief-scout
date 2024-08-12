# ProfileContainer.gd
extends Control

var players = []

func populate_profiles():
    for player in players:
        var player_info = Label.new()
        player_info.text = "Name: %s, Position: %s, Age: %d, Level: %d".format([player.name, player.position, player.age, player.level])
        add_child(player_info)
