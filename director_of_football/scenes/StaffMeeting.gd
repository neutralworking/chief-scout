# StaffMeeting.gd
extends Node

var staff_members = []

# Add staff members
func add_staff_member(staff):
    staff_members.append(staff)

# Conduct staff meeting
func conduct_meeting(team, opponents):
    var recommendations = {}
    for staff in staff_members:
        var input = staff.provide_tactical_input(team, opponents)
        recommendations[staff.role] = input
    return recommendations
