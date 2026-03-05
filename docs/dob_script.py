import csv
import wikipediaapi
import re
from datetime import datetime


def get_dob(name):
    wiki_wiki = wikipediaapi.Wikipedia("en")
    search_results = wiki_wiki.search(name)
    if search_results:
        page_py = wiki_wiki.page(search_results[0])
        if page_py.exists():
            dob = extract_dob(page_py.text)
            if dob:
                return dob
    return None


def extract_dob(text):
    match = re.search(r"born ([A-Za-z]+ \d{1,2}, \d{4})", text)
    if match:
        return match.group(1)
    return None


with open("players.csv", "r") as csv_file:
    reader = csv.DictReader(csv_file)
    players = list(reader)

for player in players:
    name = player.get("Name")
    if name:
        dob_str = get_dob(name)
        if dob_str:
            dob = datetime.strptime(dob_str, "%B %d, %Y")
            player["DOB"] = dob_str
            player["Age"] = (datetime.now() - dob).days // 365
            player["YOB"] = dob.year

with open("players_updated.csv", "w", newline="") as csv_file:
    fieldnames = [key for key in players[0].keys()]
    writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(players)
