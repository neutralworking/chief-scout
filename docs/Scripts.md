### Chief Scout - Scouting Radar - Statistical Target Acquisition 
I want alerts any time a player hits certain stats.
Start by pulling in a dataset of all the recent matches in the top 5 leagues from fbref.
Then iterate through each match and highlight players that hit certain statistical markers.

### Chief Scout - Scouting Radar - Free Agent Grading
I want to build a scrapper with beautiful soup that will scrape data from Transfermarkt.
This task is done daily, so there should be some good code out there to do this.
I would like to work solely with player data, and not club data.
I would like to scrap all the data related to one club, and then all the data related to one player.
I'd like all of this to be stored in JSON format, with the folder structure being:

Goalkeepers
Defenders
Midfielders
Forwards
Including the youth players, there should be around 70-80 players.


### Multiple Sources - Transfer Ticker
[https://www.transfermarkt.com/statistik/neuestetransfers](https://www.transfermarkt.com/statistik/neuestetransfers)

1. **Identify RSS Feed Sources**: Find websites that provide RSS feeds for football transfer news. Websites like FootballTransfers.com, Eurosport, and SoccerNews.com could be potential sources.

2. **Get RSS Feed URLs**: On these websites, look for the RSS feed symbol or link, often found at the bottom of the page, and copy the URLs of these feeds.

3. **Choose an RSS Feed Reader**: Select an RSS feed reader that allows you to aggregate and organize these feeds. Popular choices include Feedly, Inoreader, and NewsBlur.

4. **Add RSS Feeds to the Reader**: In your chosen RSS feed reader, add the RSS feed URLs you've collected.

5. **Configure Notifications**: Set up notification preferences in the feed reader to alert you of new posts.

6. **Export to Obsidian**: Explore if your RSS feed reader has export options. Some readers allow exporting feeds or summaries as text files.

7. **Integrate with Obsidian**: Import the exported files from your feed reader into Obsidian. You can manually copy the content or use plugins if available to automate this process.

8. **Organize in Obsidian**: Create a dedicated page or section in Obsidian to store and view these updates. Use Obsidian's linking and tagging features for better organization.

9. **Regular Updates**: Regularly update your RSS feed reader and Obsidian notes to keep your transfer ticker current.


Every player will have recent news stories in meta data object. 


### Chief Scout - Calendar - Fixture List

### Player Data
Their unique ID
Their transfer history
Their current club
Their current market value
Their playing positions
The player that they have played the most games with in their career (is this possible?)


Reference Table: Squad Leaders
Wage (Average)
Transfer Value
CA (CA16)
PA (PA16? EPA?)
Minutes (Season/Overall)
Apps (Season/Overall)
Goals (Season/Overall) 
Assists (Season/Overall)
Impact (Season/Overall)


### Problems to Solve/Algorithms to Build
How does a player’s in-game attributes effect his in game stats?

Is a player playing to be best of his abilities given his in-game attributes?

How well is a player improving given his current training scheme?

Which comparably skilled players can be obtained across what pay spectrum?

Which player attributes are the best indicators off on field success?

Rate scouts based on number of hits or misses that they recommend.

Rate coaches based on statistical improvements in team performance, individual performance and youth team development.



---

Historical Data
http://www.rsssf.com/histdom.html
League Positions etc

