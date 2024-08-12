# PerformanceContainer.gd
extends Control

var players = []

func populate_performance():
    for player in players:
        var performance_info = Label.new()
        performance_info.text = "Name: %s, Form: %d, Injured: %s".format([player.name, player.form, str(player.is_injured)])
        add_child(performance_info)
