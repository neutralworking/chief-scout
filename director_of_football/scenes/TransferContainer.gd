# TransferContainer.gd
extends Control

var players = []

func populate_transfers():
    for player in players:
        var transfer_info = Label.new()
        transfer_info.text = "Name: %s, Transfers: %d, Total Fees: %d".format([player.name, player.total_transfers, player.total_fees])
        add_child(transfer_info)
