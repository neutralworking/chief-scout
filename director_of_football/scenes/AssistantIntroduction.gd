extends Node2D

func _ready():
    # Display dialogue and introduce the Assistant
    pass

func _on_ContinueButton_pressed():
    get_tree().change_scene("res://Phone.tscn")
