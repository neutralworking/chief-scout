# ChiefScout.gd
extends Node

class_name ChiefScout

# Chief Scout Attributes
var name: String
var experience: int  # Years of experience in scouting
var reputation: float  # Reputation level from 0.0 (unknown) to 1.0 (world-renowned)
var trust_level_with_director: float = 0.5  # Trust level with the Director of Football, scale from 0.0 to 1.0
var alignment_on_strategy: float = 0.5  # How well the Chief Scout's recommendations align with the Director's strategy, scale from 0.0 to 1.0
var communication_frequency: String = "Medium"  # Communication frequency: High, Medium, Low

# Scouting Data
var scouting_network: Array  # Array of scouts working under the Chief Scout
var recent_recommendations: Array  # Array to store recent player recommendations
var assigned_regions: Array  # Regions assigned to the Chief Scout for scouting

# Initialize the Chief Scout
func _init(name: String, experience: int, reputation: float):
    self.name = name
    self.experience = experience
    self.reputation = clamp(reputation, 0.0, 1.0)
    self.scouting_network = []
    self.recent_recommendations = []
    self.assigned_regions = []

# Add a scout to the scouting network
func add_scout(scout):
    scouting_network.append(scout)

# Remove a scout from the scouting network
func remove_scout(scout):
    scouting_network.erase(scout)

# Assign a region to the Chief Scout for scouting operations
func assign_region(region_name: String):
    if not region_name in assigned_regions:
        assigned_regions.append(region_name)

# Remove a region from the Chief Scout's scouting operations
func remove_region(region_name: String):
    assigned_regions.erase(region_name)

# Make a player recommendation
func recommend_player(player, recommendation_strength: String, rationale: String):
    var recommendation = {
        "player": player,
        "recommendation_strength": recommendation_strength,
        "rationale": rationale,
        "status": "Under Review"
    }
    recent_recommendations.append(recommendation)

# Adjust trust level with the Director of Football based on the success or failure of a recommendation
func adjust_trust_level(success: bool):
    if success:
        trust_level_with_director = clamp(trust_level_with_director + 0.1, 0.0, 1.0)
    else:
        trust_level_with_director = clamp(trust_level_with_director - 0.1, 0.0, 1.0)

# Provide logistical recommendations for scouting missions
func provide_logistical_recommendation():
    # Example logic: Recommend a scouting trip based on experience and regions
    if assigned_regions.size() > 0:
        var region_to_scout = assigned_regions[randi() % assigned_regions.size()]
        return "Recommend sending scouts to %s based on recent reports and market activity.".format(region_to_scout)
    else:
        return "No specific region assigned for scouting. Recommend expanding scouting operations."

# Evaluate player reports and provide summary recommendations
func evaluate_player_reports(player_reports: Array):
    var summary = {
        "best_fit_player": null,
        "overall_evaluation": "Neutral"
    }
    var highest_rating = 0

    for report in player_reports:
        if report["rating"] > highest_rating:
            highest_rating = report["rating"]
            summary["best_fit_player"] = report["player"]

    if highest_rating > 80:
        summary["overall_evaluation"] = "Strong"
    elif highest_rating > 60:
        summary["overall_evaluation"] = "Moderate"
    else:
        summary["overall_evaluation"] = "Weak"

    return summary

# Generate a monthly scouting report summary for the Director of Football
func generate_monthly_report():
    var report = "Monthly Scouting Report:\n"
    report += "Trust Level with Director: %.2f\n".format(trust_level_with_director)
    report += "Communication Frequency: %s\n".format(communication_frequency)
    report += "Recent Recommendations:\n"

    for rec in recent_recommendations:
        report += "- Player: %s | Strength: %s | Status: %s | Rationale: %s\n".format(
            rec["player"].name, rec["recommendation_strength"], rec["status"], rec["rationale"]
        )

    return report
