# ScoutingContainer.gd
extends Control

var scouting_reports = []

func _ready():
    load_scouting_reports()
    populate_scouting_reports()

func load_scouting_reports():
    var file = File.new()
    if file.file_exists("res://scouting_reports.json"):
        file.open("res://scouting_reports.json", File.READ)
        scouting_reports = parse_json(file.get_as_text())["scouting_reports"]
        file.close()

func populate_scouting_reports():
    for report in scouting_reports:
        var scouting_info = VBoxContainer.new()
        
        var player_name = Label.new()
        player_name.text = "Name: %s".format([report["player_name"]])
        scouting_info.add_child(player_name)
        
        var player_age = Label.new()
        player_age.text = "Age: %d".format([report["age"]])
        scouting_info.add_child(player_age)
        
        var player_position = Label.new()
        player_position.text = "Position: %s".format([report["position"]])
        scouting_info.add_child(player_position)
        
        var player_club = Label.new()
        player_club.text = "Current Club: %s".format([report["current_club"]])
        scouting_info.add_child(player_club)
        
        var player_value = Label.new()
        player_value.text = "Current Value: %d".format([report["current_value"]])
        scouting_info.add_child(player_value)
        
        var potential_value = Label.new()
        potential_value.text = "Potential Value: %d".format([report["potential_value"]])
        scouting_info.add_child(potential_value)
        
        var attributes = Label.new()
        attributes.text = "Attributes:\n  Pace: %d\n  Shooting: %d\n  Passing: %d\n  Dribbling: %d\n  Defense: %d\n  Physical: %d".format([
            report["attributes"]["pace"], 
            report["attributes"]["shooting"], 
            report["attributes"]["passing"], 
            report["attributes"]["dribbling"], 
            report["attributes"]["defense"], 
            report["attributes"]["physical"]
        ])
        scouting_info.add_child(attributes)
        
        var scout_comments = Label.new()
        scout_comments.text = "Scout Comments: %s".format([report["scout_comments"]])
        scouting_info.add_child(scout_comments)
        
        var market_demand = Label.new()
        market_demand.text = "Market Demand: %d".format([report["market_demand"]])
        scouting_info.add_child(market_demand)
        
        var suitability = Label.new()
        suitability.text = "Suitability:\n  Tactical Fit: %d\n  Potential Growth: %d\n  Injury Risk: %s".format([
            report["suitability"]["tactical_fit"], 
            report["suitability"]["potential_growth"], 
            report["suitability"]["injury_risk"]
        ])
        scouting_info.add_child(suitability)
        
        add_child(scouting_info)
