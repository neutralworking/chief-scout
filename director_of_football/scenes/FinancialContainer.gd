# FinancialContainer.gd
extends Control

var players = []

func populate_financials():
    for player in players:
        var financial_info = Label.new()
        financial_info.text = "Name: %s, Value: %d, Contract: %d years".format([player.name, player.current_value, player.contract_length])
        add_child(financial_info)
