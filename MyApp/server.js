
/* This is the web server that serves the public directory to the browser and handles http requests */

var DatabaseClient = require('./databaseClient.js');
var Common = require('./common.js');
var Config = require('./config.js');

var express = require('express');
var cors = require('cors');
var fetch = require('node-fetch');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser()).listen(8888);

var connection = new DatabaseClient();

setupDatabaseConnection();

async function setupDatabaseConnection()
{
    try
    {
        let connected = await connection.connect();
    }
    catch(error)
    {
        // TODO restart the server
        console.log(error);
    }
}

/******************************* Handling Webpage Requests *******************************/

app.get('/login', async function(req, res)
{
    try
    {
        let deleted = await Common.checkForDeletedPlaylists();
    }
    catch(err)
    {
        console.log(err);
    }

    var state = generateRandomString(16);
    res.cookie(Config.stateKey, state);

    var scope = 'user-library-read user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private user-top-read';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: Config.client_id,
            scope: scope,
            redirect_uri: Config.redirect_uri,
            state: state,
            show_dialog: true
        }));
});

app.get('/callback', async function(req, res)
{
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[Config.stateKey] : null;

    if(state === null)
    {
        res.redirect('/#' +
            querystring.stringify({
            error: 'state_mismatch'
        }));
    }
    else
    {
        res.clearCookie(Config.stateKey);

        try
        {
            // let string = (Config.client_id + ':' + Config.client_secret).toString('base64');
            // let buffer = Buffer.from(string);

            let buffer = (new Buffer(Config.client_id + ':' + Config.client_secret).toString('base64'));

            let tokenOptions = {
                url: 'https://accounts.spotify.com/api/token',
                form: {
                    code: code,
                    redirect_uri: Config.redirect_uri,
                    grant_type: 'authorization_code'
                },
                headers: {
                    'Authorization': 'Basic ' + buffer
                },
                json: true
            };

            // Requests the access_token and refresh_token from spotify
            let tokenRequest = await Common.postRequest(tokenOptions);

            let access_token = tokenRequest.body.access_token;
            let refresh_token = tokenRequest.body.refresh_token;

            let getMeOptions = {
              url: 'https://api.spotify.com/v1/me',
              headers: { 'Authorization': 'Bearer ' + access_token },
              json: true
            };

            let userResponse = await Common.getRequest(getMeOptions);

            let userAdded = await connection.addUser(userResponse.body.id, access_token, refresh_token);
            let preferences = await Common.getUserPreferences(userResponse.body.id, connection);

            // Send the user prefrences and the user id to the browser
            res.redirect('/index.html?id=' + userResponse.body.id + "&fourWeekPlaylist=" + preferences.fourWeekPlaylist + "&sixMonthPlaylist=" + preferences.sixMonthPlaylist + "&allTimePlaylist=" + preferences.allTimePlaylist);
        }
        catch(error)
        {
            console.log("ERROR: ", error);

            res.redirect('/#' +
            querystring.stringify({
                error: error
            }));
        }
    }
});

app.get('/generatePlaylist', async function(req, res) {
    let timePeriod = req.query.timePeriod;
    let user = req.query.user;

    if(user && timePeriod)
    {
        try
        {
            let results = await connection.query("Select access_token from users where name = '" + user + "\'");
            let access_token_from_db = results[0].access_token;

            let playlistName = getPlaylistNameFromTimePeriod(timePeriod);
            let playlistDescription = "";

            let playlist = await generatePlaylist(playlistName, playlistDescription, user, access_token_from_db);
            let success = await connection.query("insert into playlists (id, type, userName) values (\'" + playlist.id + "\',\'" + timePeriod + "\', \'" + user + "\')");

            let term = Common.timePeriodToSpotifyTerm(timePeriod);
            let updated = Common.updatePlaylist(term, playlist.id, connection, access_token_from_db);

            res.sendStatus(200);
        }
        catch(error)
        {
            res.sendStatus(400);
        }
    }
    else
    {
        res.sendStatus(400);
    }
});


app.get('/deletePlaylist', async function(req, res) {

    let timePeriod = req.query.timePeriod;
    let user = req.query.user;

    if(user && timePeriod)
    {
        try
        {
            let results = await connection.query("Select access_token from users where name = '" + user + "\'");
            let access_token_from_db = results[0].access_token;

            let playlists = await connection.query("select id from playlists where userName = '" + user + "\' and type = \'" + timePeriod + "\'");

            let id = playlists[0].id;

            let options = {
                method: "DELETE",
                headers: {
                  'Authorization': 'Bearer ' + access_token_from_db
                }
            }

            let unfollowed = await fetch("https://api.spotify.com/v1/playlists/" + id + "/followers", options);
            let db_results = await connection.query("delete from playlists where userName = '" + user + "\' and type = \'" + timePeriod + "\'");

            res.sendStatus(200);
        }
        catch(error)
        {
            console.log(error);
            res.sendStatus(400);
        }
    }
    else
    {
        res.sendStatus(400);
    }
});


/******************************* Helper functions *******************************/

function generateRandomString(length)
{
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++)
    {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}

function getPlaylistNameFromTimePeriod(timePeriod)
{
    let playlistName = "";

    if(timePeriod === "fourWeekPlaylist")
    {
        playlistName = "Four Week Roundup";
    }
    else if(timePeriod === "sixMonthPlaylist")
    {
        playlistName = "Six Month Summary";
    }
    else
    {
        playlistName = "All Time Favorites";
    }

    return playlistName;
}

async function generatePlaylist(name, description, userID, access_token_param)
{
    let options = {
        method: "POST",
        headers: {
          'Authorization': 'Bearer ' + access_token_param,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          description: description,
          public: false
        })
    };

    try
    {
        let res = await fetch('https://api.spotify.com/v1/users/' + userID + '/playlists', options);

        return await res.json();
    }
    catch(error)
    {
        throw new Error(error);
    }
}
