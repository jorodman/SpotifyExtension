
var DatabaseClient = require('./databaseClient.js');

var express = require('express');
var request = require('request');
var cors = require('cors');
const fetch = require('node-fetch');
const url = require('url');


var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var client_id = '68829692b36742b68cf3163a55138448'; // Your client id
var client_secret = '761fc3a6e9054badb680d682b5dcd354'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

var access_token;

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser()).listen(8888);

var connection = new DatabaseClient();

setupDatabaseConnection();

async function setupDatabaseConnection()
{
    await connection.connect();
}

app.get('/login', function(req, res) {

    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
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

        var authOptions = {
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

        let post = await new Promise(function (resolve, reject) {
            request.post(authOptions, function(error, response, body)
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

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        let user = await new Promise(function (resolve, reject) {
            request.get(options, async function(error, response, body) {
                if(response.statusCode === 200)
                {
                    let userAdded = await connection.addUser(body.id, access_token, refresh_token);
                    resolve(body.id);
                }
                else
                {
                    console.log("/Me request status code: ", response.statusCode);
                    reject(response.statusCode);
                }
            });
        });

        let listOfUserPreferences = await connection.query("Select fourWeekPlaylist, sixMonthPlaylist, allTimePlaylist from users where name = \'" + user + "\'");
        let pref = listOfUserPreferences[0];

        // we can also pass the token to the browser to make requests from there
        res.redirect('/index.html?access_token=' + access_token + "&fourWeekPlaylist=" + pref.fourWeekPlaylist + "&sixMonthPlaylist=" + pref.sixMonthPlaylist + "&allTimePlaylist=" + pref.allTimePlaylist);
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
        let userPreference = await connection.query("update users set " + timePeriod + "=1");
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
        console.log(error)
        res.sendStatus(400);
    }
});


var generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};


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

  let res = await fetch('https://api.spotify.com/v1/users/' + userID + '/playlists', options);
  let data = await res.json();

  return data;
}
