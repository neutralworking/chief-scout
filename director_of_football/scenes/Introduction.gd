# InitialScene.gd
extends Control

# Placeholder for club offers
var club_offers = [
    {
        "name": "Club A: Ambitious Contenders",
        "current_state": "Mid-table finish last season, looking to break into the top four.",
        "ambitions": "Aggressive investment in new talent, high expectations for immediate success.",
        "board_expectations": "Qualify for European competitions, win domestic cups.",
        "challenges": "High-pressure environment, existing squad has potential but needs strengthening.",
        "budget": "Large transfer budget with flexibility for key signings."
    },
    {
        "name": "Club B: Rebuilding Giants",
        "current_state": "Former champions, recently fallen on hard times with a string of mid-table finishes.",
        "ambitions": "Rebuild and restore the club to its former glory over the next few seasons.",
        "board_expectations": "Steady improvement, focus on developing youth talent.",
        "challenges": "Limited immediate budget, need to balance between experienced signings and youth development.",
        "budget": "Moderate transfer budget with a focus on long-term investments."
    },
    {
        "name": "Club C: Underestimated Challengers",
        "current_state": "Overachieved with a surprise top-six finish last season.",
        "ambitions": "Establish as a regular top-six club and challenge for trophies.",
        "board_expectations": "Maintain top-six position, cup runs, smart investment in underrated talents.",
        "challenges": "Maintaining momentum, balancing squad depth with limited resources.",
        "budget": "Small transfer budget, focus on shrewd signings and tactical management."
    }
]

# Function to display the initial blurb and club offers
func show_initial_blurb():
    print("Congratulations! After a stellar season in the lower league, you have caught the attention of several top-tier clubs. Your strategic acumen and leadership have not gone unnoticed, and now you have three lucrative offers on the table.")
    print("As the new Director of Football, your responsibilities will be vast and varied. You'll be in charge of managing the club's playing roster and staff, identifying weaknesses, and finding potential solutions and upgrades. You'll need to maintain relationships with the board, fans, and players while achieving the objectives set by the club. Your goal is to win trophies, please the fans, and elevate the club to new heights. You'll also be involved in selling players, negotiating contracts, and setting the club's playing style.")
    print("It's time to evaluate the offers and choose the club where you'll make your mark. Consider the club's current state, their ambitions, and how well they align with your vision. The future of your career and the club's success depends on this crucial decision.")
    show_club_offers()

# Function to display the club offers
func show_club_offers():
    for i in range(club_offers.size()):
        var club = club_offers[i]
        print("%d. %s" % [i + 1, club["name"]])
        print("   Current State: %s" % club["current_state"])
        print("   Ambitions: %s" % club["ambitions"])
        print("   Board Expectations: %s" % club["board_expectations"])
        print("   Challenges: %s" % club["challenges"])
        print("   Budget: %s" % club["budget"])
        print("")

# Function to handle user choice
func choose_club(club_index):
    var chosen_club = club_offers[club_index]
    print("You have chosen to join %s. Best of luck in your new role as Director of Football!" % chosen_club["name"])
    # Proceed to the next part of the game with the chosen club
