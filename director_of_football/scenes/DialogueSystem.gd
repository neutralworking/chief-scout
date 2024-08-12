# DialogueSystem.gd
extends Node

# Placeholder for dialogue data
var dialogues = {}

# Current dialogue state
var current_dialogue = null
var current_question_index = 0

# Load dialogue data from JSON file
func load_dialogues():
    var file = File.new()
    if file.file_exists("res://dialogues.json"):
        file.open("res://dialogues.json", File.READ)
        dialogues = parse_json(file.get_as_text())
        file.close()

# Start a new dialogue
func start_dialogue(dialogue_type):
    current_dialogue = dialogues.get(dialogue_type)
    current_question_index = 0
    show_next_question()

# Show the next question in the dialogue
func show_next_question():
    if current_dialogue:
        if current_question_index < current_dialogue.questions.size():
            var question_data = current_dialogue.questions[current_question_index]
            print(current_dialogue.intro)
            print(question_data.question)
            for option in question_data.options:
                print(option + ": " + question_data.options[option])
        else:
            print("Dialogue finished.")
            current_dialogue = null

# Handle user response
func handle_response(response):
    if current_dialogue:
        var question_data = current_dialogue.questions[current_question_index]
        var selected_option = question_data.options.get(response)
        if selected_option:
            print("You selected: " + selected_option)
            current_question_index += 1
            show_next_question()
        else:
            print("Invalid option, please choose again.")
