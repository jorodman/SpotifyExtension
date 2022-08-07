Note: Spotify does not approve hobby apps so I didn't apply to make this app official, which is why I never ended up hosting it online. This is really just to show employers that I can code and to I used it to make some great playlists for me and a few friends. At this point my Spotify Developer License has expired and so it can't actually access the spotify API anymore. I've also taken down the EC2 that I used to host the database.

What this app does:
- This app allows Spotify premium users to select anywhere from 1 to 3 time periods (4 week, 6 month, and all time) and have playlists of their top songs from those periods generated
- It allows them to delete the playlists through the webpage
- It updates the playlists daily as new information is fetched from the Spotify API

How to run this program (see note about on why this won't actually work anymore):
- cd into MyApp and run "node server.js". This will start the web server, which serves the /public directory to the browser on port 8888
- cd into MyApp and run "node backgroundWorker.js". This will start the program that updates all playlists daily

How it's designed:
- The html page is a bootstrap Template
- The front end was written by Joseph Rodman in Javascript and is responsible for keeping track of the user that the webpage represents and which playlists the user has subscribed to. It makes http requests to the web server and does not make any calls to the Spotify API
- The web server is written in express.js and communicates with the MySQL database. It makes calls to the Spotify API
- The web server started as the code from an example program provided by Spotify but evolved into much more than that
- The backgroundWorker.js program is written in vanilla node.js and communicates with the MySQL database and makes calls to the Spotify API

Design Considerations:
- For security purposes, all of the calls to the Spotify API are made in the backend, and the front end only ever knows the user ID (aka username) of whoever is logged in
- Server.js and backgroundWorker.js make a lot of similar calls to the Spotify API so I created common.js so that I didn't have to copy and past functions between the two programs
- I created databaseClient.js because I wanted to promisify the MySQL query function rather than using callbacks to help make the code more readable
- I intentionally do not catch most errors because I want the program to shut down if something goes wrong



