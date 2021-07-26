
var DatabaseClient = require('./databaseClient.js');

var express = require('express');
var request = require('request');
var cors = require('cors');
const fetch = require('node-fetch');
const url = require('url');

var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var client_id = '68829692b36742b68cf3163a55138448';
var client_secret = '761fc3a6e9054badb680d682b5dcd354'
// TODO update this to the URL that the site is hosted on
var redirect_uri = 'http://localhost:8888/callback';
var stateKey = 'spotify_auth_state';
var access_token;

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
        console.log(error);
    }
}

app.get('/login', function(req, res)
{
    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // TODO: What authorization is needed as of now?
    var scope = 'user-library-read user-read-private user-read-email playlist-read-private user-follow-modify user-follow-read playlist-modify-public playlist-modify-private user-top-read';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state,
            show_dialog: true
        }));
});


app.get('/user_info', function(req, res)
{
    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // TODO: What authorization is needed as of now?
    var scope = 'user-library-read user-read-private user-read-email playlist-read-private user-follow-modify user-follow-read playlist-modify-public playlist-modify-private user-top-read';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: redirect_uri,
            state: state,
            show_dialog: true
        }));
});

app.get('/callback', async function(req, res)
{
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    // if (state === null || state !== storedState)
    if(state === null)
    {
        res.redirect('/#' +
            querystring.stringify({
            error: 'state_mismatch'
        }));
    }
    else
    {
        res.clearCookie(stateKey);

        // Requests the access_token and refresh_token from spotify
        let tokenRequest = await new Promise(function (resolve, reject) {

            let options = {
                url: 'https://accounts.spotify.com/api/token',
                form: {
                    code: code,
                    redirect_uri: redirect_uri,
                    grant_type: 'authorization_code'
                },
                headers: {
                    'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
                },
                json: true
            };

            request.post(options, function(error, response, body)
            {
                if (!error && response.statusCode === 200)
                {
                    access_token = body.access_token;
                    refresh_token = body.refresh_token;

                    resolve();
                }
                else
                {
                    res.redirect('/#' +
                    querystring.stringify({
                        error: 'invalid_token'
                    }));

                    reject();
                }
            });
        });

        // Requests the users info from spotify and adds to the database
        let userRequest = await new Promise(function (resolve, reject) {

            let options = {
              url: 'https://api.spotify.com/v1/me',
              headers: { 'Authorization': 'Bearer ' + access_token },
              json: true
            };

            request.get(options, async function(error, response, body) {
                if(response.statusCode === 200)
                {
                    let userAdded = await connection.addUser(body.id, access_token, refresh_token);
                    resolve(body.id);
                }
                else
                {
                    reject(response.statusCode);
                }
            });
        });

        // TODO error handling if a rejection occurs
        let userPlaylistsQueryResults = await connection.query("Select type from users natural join playlists where name = \'" + userRequest + "\'");
        let playlistTypes = userPlaylistsQueryResults[0];

        let fourWeekPlaylist = 0;
        let sixMonthPlaylist = 0;
        let allTimePlaylist = 0;

        if(playlistTypes)
        {
            for(let type of playlistTypes)
            {
                console.log("Playlist type: " + type);

                if(type === "fourWeekPlaylist")
                {
                    fourWeekPlaylist = 1;
                }
                else if(type === "sixMonthPlaylist")
                {
                    sixMonthPlaylist = 1;
                }
                else if(type === "allTimePlaylist")
                {
                    allTimePlaylist = 1;
                }
            }
        }

        // Send the user prefrences and the access_token to the browser
        res.redirect('/index.html?id=' + userRequest + "&fourWeekPlaylist=" + fourWeekPlaylist + "&sixMonthPlaylist=" + sixMonthPlaylist + "&allTimePlaylist=" + allTimePlaylist);
    }
});

app.get('/access_token', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send({ access_token: access_token });
});

// TODO: Verify that a playlist does not exist already
app.get('/generatePlaylist', async function(req, res) {
    let timePeriod = req.query.timePeriod;
    let user = req.query.user;

    let description = "";
    let results = await connection.query("Select access_token from users where name = '" + user + "\'");
    let access_token_from_db = results[0].access_token;

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

    try
    {
        let playlist = await generatePlaylist(playlistName, description, user, access_token_from_db);
        let success = await connection.query("insert into playlists (id, type, userName) values (\'" + playlist.id + "\',\'" + timePeriod + "\', \'" + user + "\')");

        res.sendStatus(200);
    }
    catch(error)
    {
        res.sendStatus(400);
    }
});

app.get('/deletePlaylist', async function(req, res) {

    let timePeriod = req.query.timePeriod;
    let user = req.query.user;

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
        let userPreference = await connection.query("update users set " + timePeriod + "=0");

        res.sendStatus(200);
    }
    catch(error)
    {
        console.log(error);
        res.sendStatus(400);
    }
});


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
        let data = await res.json();

        return data;
    }
    catch(error)
    {
        throw new Error(error);
    }
}
