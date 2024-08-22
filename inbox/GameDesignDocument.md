### Game Design Document (GDD) Overview

---

**Game Title:**  
(Placeholder Title)

**Genre:**  
Sports Management RPG

**Platform:**  
PC (with potential for future console and mobile adaptations)

**Target Audience:**  
Football enthusiasts, RPG fans, and simulation game players.

---

### **Flow Overview**

1. **App Loads:**
   - The game initializes, loading the necessary assets, and preparing the environment for user interaction.
   - A visually engaging splash screen with the game logo and loading animation is displayed.

2. **User Validation:**
   - The player is prompted to sign in or create a new profile.
   - Options for local save profiles or cloud-based profiles.
   - Integration with platforms for achievements, cloud saves, and leaderboards (e.g., Steam, Epic Games).

3. **Opening Credits:**
   - A cinematic sequence showcasing the game's theme, key features, and credits.
   - Optional skip function for returning players.

4. **Main Menu:**
   - **Options Available:**
     - Start New Game
     - Continue Last Game
     - Load Game
     - Settings (Audio, Video, Controls, Language, etc.)
     - Credits
     - Exit
   - Background visuals and music reflecting the football theme.

5. **New Game Generation:**
   - **Squad Populated:**
     - The game randomly or procedurally generates a squad of players for the chosen team.
     - Player attributes, potentials, and personalities are defined.
   - **Staff Added:**
     - Initial staff members (Assistant Manager, Scouts, Physios, etc.) are generated with basic attributes.
   - **Statuses Calculated:**
     - Team morale, player fitness, finances, and other key statuses are set based on the club's history and current status.
   - **Club Requirements Created:**
     - Board expectations, season goals, and financial targets are set.
     - Long-term objectives such as promotion, cup runs, and player development are outlined.
   - **Shortlists Populated:**
     - A shortlist of potential transfer targets is generated based on club needs and available scouting reports.

6. **Back Story and DOF Job Offer:**
   - A narrative sequence introduces the player's past as a professional footballer and the events leading to their transition to a Director of Football role.
   - The player is offered a job at one of four starting clubs in the English 4th tier (e.g., League Two).

7. **Assistant’s Questions:**
   - The player is interviewed by their assistant, forming their profile and RPG-style attributes.
   - **Attributes Impacting:**
     - **Productivity:** Affects how quickly tasks are completed.
     - **Charisma:** Influences staff morale, player happiness, and media interactions.
     - **Player Knowledge:** Determines the accuracy and depth of scouting reports.
     - **Network Size:** Affects the ease of finding transfer targets and staff.
     - **Negotiation Ability:** Improves success in transfer and contract negotiations.
     - **Tech Ability:** Impacts the effectiveness of using data and analytics in decisions.

8. **Choosing a Starting Team:**
   - **Teams Options:**
     - A brief introduction to each of the four available clubs.
     - Clubs are designed with distinct challenges, such as financial difficulties, lack of talent, or outdated facilities.
   - The player selects their preferred team.

9. **Introduction to Work Phone and Meeting Colleagues:**
   - A tutorial introduces the in-game phone OS, the primary interface for interacting with the game world.
   - The player meets key staff members (Manager, Chief Scout, Head of Youth Development, etc.) through calls, messages, or face-to-face meetings.

10. **Initial Decisions:**
    - **Philosophy:** The player chooses a football philosophy (e.g., attacking football, youth development, defensive solidity).
    - **Style:** The player selects a playing style for the team (e.g., possession-based, counter-attacking).
    - **Long-Term Objectives:** The player defines their vision (e.g., building a youth academy, financial stability, promotion to higher leagues).

11. **Early Days - Tutorial:**
    - **Initial Challenges:**
      - The club lacks key components (players, staff, facilities, scouting network).
      - The player must address these issues, receiving guidance through a tutorial.
    - **Tasks Include:**
      - Hiring key staff.
      - Improving training facilities.
      - Setting up scouting networks.
      - Making initial transfer decisions.
      - Establishing communication lines with the board, manager, and other key personnel.

12. **Long-Term Game Flow:**
    - The game transitions into a more open-ended experience, where the player continues to manage the club, make transfers, negotiate contracts, improve facilities, and strive to meet both short-term and long-term objectives.

---

### **Key Mechanics and Features**

- **Information Unlocking:** Players gradually unlock detailed information about players, staff, and other clubs through scouting, interactions, and events.
  - **Celebratory UI:** Highlighting newly unlocked information, with visual cues and notifications.

- **Attributes and Development:**
  - **Director Attributes:** Affect various in-game tasks and interactions, improving over time through experience and decisions.
  - **Player Development:** Players improve through training, matches, and special events. Directors can influence this indirectly through staff choices and facilities.

- **Decision Tree:**
  - **Complex Interactions:** Decisions have long-term consequences, influencing relationships, finances, and team success.
  - **Negotiations:** Sophisticated transfer and contract negotiations that reflect real-world complexities.

- **Mini-Events:**
  - **Dynamic Daily Events:** Daily occurrences ranging from player personal issues to unexpected scouting reports.
  - **Impact on Gameplay:** Events can affect player morale, team performance, and the director’s decision-making.

- **Transfer Market:**
  - **AI Directors:** Other clubs actively engage in the transfer market, creating a dynamic environment.
  - **Negotiation Mechanics:** Interest levels, negotiation tactics, and club/player demands create engaging and realistic transfer dealings.

- **Training Reports:**
  - **Daily Updates:** Regular reports on player progress, highlighting attribute changes, standout performances, and significant events.
  - **Player Morale Impact:** Morale directly affects training output, influencing player development and team performance.

- **Matchday Involvement:**
  - **Director Role:** Influence matchday decisions through indirect suggestions, such as promoting youth players or advising on tactics.

---

### **Next Steps**

- **Further Detailing:**
  - Develop detailed mechanics for scouting, transfers, and training.
  - Create a more fleshed-out decision tree framework.
  - Design the user interface and experience, especially focusing on the in-game phone OS.
  - Expand on the narrative elements and potential story arcs.

- **Technical Development:**
  - Begin prototyping core mechanics in GDScript.
  - Establish basic AI behaviors for staff and other clubs.
  - Implement the player profile creation system and attribute generation.

This document is a foundational overview and will evolve as the project develops, with more detailed sections to be added for gameplay mechanics, UI design, narrative structure, and technical implementation.