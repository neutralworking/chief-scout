extends Node

# Reference to the transfer window script
var transfer_window_script = preload("res://TransferWindow.gd")

# Function to advance the current date by one day
func advance_day():
    transfer_window_script.current_date = transfer_window_script.current_date.add_days(1)
    print("Current Date: ", transfer_window_script.current_date.to_string())
    print("Is Transfer Window: ", transfer_window_script.is_transfer_window())