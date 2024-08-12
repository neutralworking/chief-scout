extends Node

class_name Agent

# Agent attributes
var name: String
var trustworthiness: float  # A rating from 0.0 (not trustworthy) to 1.0 (completely trustworthy)
var negotiation_skill: float  # A rating from 0.0 (poor negotiator) to 1.0 (excellent negotiator)
var reputation: int  # A rating from 0 (unknown) to 100 (highly respected)
var clients: Array  # List of players represented by the agent
var preferred_clubs = []  # List of preferred clubs
var disliked_clubs = []
var fee_percentage = 5.0  # Agent fee as a percentage of the transfer fee

# Relationship with the Director (Player)
var relationship_with_director: float  # A rating from 0.0 (poor) to 1.0 (excellent)

# Initialize the agent with some basic information
func _init(name: String, trustworthiness: float, negotiation_skill: float, reputation: int):
    self.name = name
    self.trustworthiness = clamp(trustworthiness, 0.0, 1.0)
    self.negotiation_skill = clamp(negotiation_skill, 0.0, 1.0)
    self.reputation = clamp(reputation, 0, 100)
    self.clients = []
    self.relationship_with_director = 0.5  # Start with a neutral relationship

# Add a client to the agent's list of players
func add_client(player):
    clients.append(player)

# Remove a client from the agent's list
func remove_client(player):
    clients.erase(player)

# Provide a player report with hyperbolic bias based on trustworthiness
func provide_player_report(player):
    var report = ""
    var bias_factor = 1.0 + (1.0 - trustworthiness)  # Increases exaggeration if trustworthiness is low

    report += "Player: %s\n" % player.name
    report += "Age: %d\n" % player.age
    report += "Position: %s\n" % player.position

    # Example hyperbolic evaluation
    report += "This player is absolutely world-class in %s.\n" % player.position
    report += "A real gem with a bright future ahead!\n"

    # Adjust attributes slightly based on bias
    report += "Attributes:\n"
    for attribute in player.attributes:
        var exaggerated_value = int(player.attributes[attribute] * bias_factor)
        report += "  %s: %d\n" % [attribute, clamp(exaggerated_value, 0, 100)]
    
    return report

# Negotiate a contract based on the agent's negotiation skill and relationship with the director
func negotiate_contract(player, initial_offer):
    var counter_offer = initial_offer
    var negotiation_factor = 1.0 + negotiation_skill  # Better negotiators increase the offer

    if relationship_with_director < 0.5:
        negotiation_factor *= 1.1  # Agents with a poor relationship might push harder

    # Example negotiation logic: increase wage offer by a percentage
    counter_offer.wage *= negotiation_factor

    return counter_offer

# Improve or worsen the relationship with the director based on interaction outcomes
func adjust_relationship(success: bool):
    if success:
        relationship_with_director = clamp(relationship_with_director + 0.1, 0.0, 1.0)
    else:
        relationship_with_director = clamp(relationship_with_director - 0.1, 0.0, 1.0)

# Function to check if the agent prefers a club
func prefers_club(club_name):
    return club_name in preferred_clubs