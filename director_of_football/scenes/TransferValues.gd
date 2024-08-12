baseValues = {
    "GK": {
        "Value": "75",
        "Level": {
            70: 0,
            75: 100000,
            80: 500000,
            85: 10000000,
            90: 50000000,
            95: 100000000,
            100: 200000000
        }
    },
    "WD": {
        "Value": "80",
        "Level": {
            70: 0,
            75: 150000,
            80: 7500000,
            85: 15000000,
            90: 90000000,
            95: 12000000,
            100: 250000000
        }
    },
    "CD": {
        "Value": "90",
        "Level": {
            70: 0,
            75: 250000,
            80: 1000000,
            85: 25000000,
            90: 100000000,
            95: 200000000,
            100: 300000000
        }
    },
    "WM": {
        "Value": "85",
        "Level": {
            70: 0,
            75: 2000000,
            80: 7500000,
            85: 20000000,
            90: 90000000,
            95: 175000000,
            100: 250000000
        }
    },
    "CM": {
        "Value": "95",
        "Level": {
            70: 0,
            75: 500000,
            80: 1500000,
            85: 25000000,
            90: 110000000,
            95: 200000000,
            100: 500000000
        }
    },
    "WF": {
        "Value": "100",
        "Level": {
            70: 0,
            75: 750000,
            80: 2500000,
            85: 30000000,
            90: 120000000,
            95: 250000000,
            100: 1000000000
        }
    },
    "CF": {
        "Value": "100",
        "Level": {
            70: 0,
            75: 750000,
            80: 2500000,
            85: 30000000,
            90: 120000000,
            95: 250000000,
            100: 1000000000
        }
    }

    # Function to calculate the player's base value
    func calculate_base_value():
        var base_value = player_data["level"] * 100000
        base_value += player_data["reputation"] * 50000
        base_value += (player_data["hype"] * player_data["reputation"]) / player_data["age"] * 1000
    
        if player_data["homegrown_status"]:
            base_value *= 1.2
    
        if player_data["club_status"] == "Key Player":
            base_value *= 1.3
    
        var contract_factor = player_data["contract_length"] / 2
        base_value *= contract_factor
    
        player_value["base_value"] = base_value
    
    # Function to calculate the player's wage level
    func calculate_wage_level():
        var wage_level = player_data["wage"] * 1.2
        player_value["wage_level"] = wage_level
    
    # Function to calculate the player's on-pitch value based on abilities
    func calculate_on_pitch_value():
        var ability_sum = 0
        for ability in player_ability.values():
            ability_sum += ability
        
        var on_pitch_value = ability_sum * 1000
        player_value["on_pitch_value"] = on_pitch_value
    
    # Function to calculate the player's personal value based on personality
    func calculate_personal_value():
        var personality_sum = 0
        for trait in player_personality.values():
            personality_sum += trait
        
        var personal_value = personality_sum * 500
        player_value["personal_value"] = personal_value
    
    # Function to update the player's total value
    func update_total_value():
        player_value["total_value"] = player_value["base_value"] + player_value["on_pitch_value"] + player_value["personal_value"]
    
    # Function to update the player's value dictionary
    func update_player_value():
        calculate_base_value()
        calculate_wage_level()
        calculate_on_pitch_value()
        calculate_personal_value()
        update_total_value()
    
    # Initialize the player value dictionary
    func _ready():
        update_player_value()
        print("Player Base Value: ", player_value["base_value"])
        print("Player Wage Level: ", player_value["wage_level"])
        print("Player On-Pitch Value: ", player_value["on_pitch_value"])
        print("Player Personal Value: ", player_value["personal_value"])
        print("Player Total Value: ", player_value["total_value"])
    