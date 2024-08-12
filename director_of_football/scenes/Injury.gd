extends Node

class_name Injury

# Injury attributes
var name = ""
var severity = 0  # Severity level (1-10)
var recovery_time = 0  # Recovery time in days

# Function to initialize an injury
func _init(name, severity, recovery_time):
    self.name = name
    self.severity = severity
    self.recovery_time = recovery_time