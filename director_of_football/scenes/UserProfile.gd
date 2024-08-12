extends Node2D

var user_profile = {}

func _ready():
    calculate_user_profile()
    display_user_profile()

func calculate_user_profile():
    # Calculate profile based on answers
    pass

func display_user_profile():
    # Display the profile
    pass

func _on_ContinueButton_pressed():
    get_tree().change_scene("res://AssistantIntroduction.tscn")
