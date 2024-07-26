Transfer equation selling side
playerLevel (playerLevel)
personAge (personBio)
personNationality (personNation)
playerHomegrownStatus (calcuated field long-term but for now manual)
playerPosition (playerPositions table)
playerPlayingStyle (playingStyle table)
playerReputation (personReputation/playerReputation table, should probably have it separate for people like Tony Adams)
playerHype (Expectation Level) (Level x Reputation x Age perhaps, or maybe it's a manual field)
playerWage (playerContract)
playerContractLength (calculated field from playerContract)
playerClubStatus (own table)
playerClubPositionRank (this will probably have to be a calucluated field, not sure how to do those)
personClubRelationship (personClubRelationship)
clubPrimaryObjective (these can both come from clubObjective but they need a subclassification)
clubSecondaryObjective (these can both come from clubObjective but they need a subclassification)
clubRecruitmentObjective (this can have its own table, it's Director of Football after all)
clubClubRelationship

Transfer equation buying side
playerLevel
playerAge
playerNationality
playerHomegrownStatus
playerPosition
playerPlayingStyle
playerReputation
playerHype
playerWage
playerContractLength
playerProposedWage
playerProposedContractLength
playerProposedClubStatus
playerProposedPositionRank
personClubRelationship
clubObjective