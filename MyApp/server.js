
var DatabaseClient = require('./databaseClient.js');
var Common = require('./common.js');
var Config = require('./config.js');

var express = require('express');
var request = require('request');
var cors = require('cors');
var fetch = require('node-fetch');
var url = require('url');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser()).listen(8888);

// TODO update this with the IP of the actual database
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
    // Whenever anyone tries to login, check to make sure that they havn't deleted any playlists that are still in the database
    //let deleted = await checkForDeletedPlaylists();

    var state = generateRandomString(16);
    res.cookie(Config.stateKey, state);

    var scope = 'user-library-read user-read-private user-read-email playlist-read-private playlist-modify-public playlist-modify-private';
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
        res.clearCookie(Config.stateKey);

        try
        {
            let string = (Config.client_id + ':' + Config.client_secret).toString('base64');
            let buffer = Buffer.from(string);

            let tokenOptions = {
                url: 'https://accounts.spotify.com/api/token',
                form: {
                    code: code,
                    redirect_uri: Config.redirect_uri,
                    grant_type: 'authorization_code'
                },
                headers: {
                    'Authorization': 'Basic ' + (new Buffer(Config.client_id + ':' + Config.client_secret).toString('base64'))
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

async function checkForDeletedPlaylists()
{
    let playlists = await connection.query("Select id, userName from playlists");

    for(let playlist of playlists)
    {
        let users = await connection.query("Select refresh_token, name from users where name = \'" + playlist.userName + "\'");
        let user = users[0];

        let tokenRequest = await Common.getAccessToken(user.refresh_token);
        let access_token = tokenRequest.body.access_token;

        let options = {
            method: "GET",
            headers: {
              'Authorization': 'Bearer ' + access_token
            }
        };

        let res = await fetch('https://api.spotify.com/v1/playlists/' + playlist.id, options);

        if(res.status === 404)
        {
            let deleted = await connection.query("delete from playlists where id = '" + playlist.id + "\'");
        }
        else
        {
            let response = await fetch('https://api.spotify.com/v1/playlists/' + playlist.id + '/followers/contains?ids=' + user.name, options);
            let following = await response.json();

            if(!following[0])
            {
                let deleted = await connection.query("delete from playlists where id = '" + playlist.id + "\'");
            }
        }
    }
}

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
        let data = await res.json();

        return data;
    }
    catch(error)
    {
        throw new Error(error);
    }
}

/******************************* Unused functions that may be used if more features are implemented *******************************/

app.get('/clearData', async function(req, res)
{
    let userName = req.query.user;

    try
    {
        let deleted = await connection.query("delete from users where name = '" + userName + "\'");

        res.sendStatus(200);
    }
    catch(error)
    {
        res.sendStatus(400);
    }
});

app.get('/clearDataLoginFirst', function(req, res)
{
    var state = generateRandomString(16);
    res.cookie(Config.stateKey, state);

    // TODO: What authorization is needed as of now?
    var scope = 'user-library-read user-read-private user-read-email playlist-read-private user-follow-modify user-follow-read playlist-modify-public playlist-modify-private user-top-read';
    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: 'http://localhost:8888/clearDataAfterLogin',
            state: state,
            show_dialog: true
        }));
});

app.get('/clearDataAfterLogin', async function(req, res)
{
    let access_token;

    // Requests the access_token and refresh_token from spotify
    let tokenRequest = await new Promise(function (resolve, reject) {

        let string = (client_id + ':' + client_secret).toString('base64');
        let buffer = Buffer.from(string);

        let options = {
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
    let userDeleted = await new Promise(function (resolve, reject) {

        let options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        request.get(options, async function(error, response, body) {
            if(response.statusCode === 200)
            {
                let deleted = await connection.query("delete from users where name = '" + body.id + "\'");
                resolve(deleted);
            }
            else
            {
                reject(response.statusCode);
            }
        });
    });

    // Send the user prefrences and the access_token to the browser
    res.redirect('/index.html?dataCleared=' + true);
});
