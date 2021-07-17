
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
    let users = await connection.query('Select * from users');
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

app.get('/friends', async function(req, res) {

    let friends = [];

    let users = await connection.query('Select * from users');

    for(let user of users)
    {
        let options = {
            url: 'https://api.spotify.com/v1/me/following/contains?type=user&ids=' + user.name,
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
        };

        let response = await fetch('https://api.spotify.com/v1/me/following/contains?type=user&ids=' + user.name, options);
        let following = await response.json();

        if(following[0])
        {
            friends.push(user);
        }
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(friends));
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

        request.post(authOptions, function(error, response, body)
        {
            if (!error && response.statusCode === 200)
            {
                access_token = body.access_token;
                refresh_token = body.refresh_token;

                var options = {
                  url: 'https://api.spotify.com/v1/me',
                  headers: { 'Authorization': 'Bearer ' + access_token },
                  json: true
                };

                // use the access token to access the Spotify Web API
                request.get(options, function(error, response, body) {
                    if(response.statusCode === 200)
                    {
                        connection.addUser(body.id, access_token, refresh_token);
                    }
                    else
                    {
                        console.log(response.statusCode);
                    }
                });

                // we can also pass the token to the browser to make requests from there
                res.redirect('/friends.html?access_token=' + access_token);
            }
            else
            {
                res.redirect('/#' +
                querystring.stringify({
                    error: 'invalid_token'
                }));
            }
        });
    }
});

app.get('/access_token', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.send({ access_token: access_token });
});

app.get("/mutualPlaylist", function(req, res)
{
    let parsedURL = url.parse(req.url, true);
    let friendUsername = parsedURL.query.username;

    let success = await generateMutualPlaylist(friendUsername);

    res.writeHead(200, {"Access-Control-Allow-Origin": "*"});
    res.end('ok');
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});


var generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

async function generateMutualPlaylist(friendUsername)
{
    let playlist = await generatePlaylist("Mutual Playlist", "", friendUsername, access_token);

    let friendAccessToken = await connection.query('Select access_token, refresh_token from users where name = ' + friendUsername);

    let u1Short = await getTopTracks("short_term", access_token);
    let u1Medium = await getTopTracks("medium_term", access_token);
    let u1Long = await getTopTracks("long_term", access_token);

    let u1Songs = u1Short.concat(u1Medium).concat(u1Long);

    let u1SongIDs = [];

    for(let song of u1Songs)
    {
        u1SongIDs.push(song.id);
    }

    let u2Short = await getTopTracks("short_term", friendAccessToken);
    let u2Medium = await getTopTracks("medium_term", friendAccessToken);
    let u2Long = await getTopTracks("long_term", friendAccessToken);

    let u2Songs = u2Short.concat(u2Medium).concat(u2Long);

    let u2SongIDs = [];

    for(let song of u2Songs)
    {
        u2SongIDs.push(song.id);
    }

    let mutualSongIDs = [];

    for(let song of u1SongIDs)
    {
        if(u2SongIDs.includes(song.id))
        {
            mutualSongIDs.push(song.id);
        }
    }

    if(mutualSongIDs.length >= 20)
    {
        // return mutualSongIDs;
    }

    console.log("Length after top songs: " + mutualSongIDs.length);

    let u1SavedTracks = await getAllSavedTracks(access_token);

    let u1SavedTrackIDs = [];

    for(let song of u1SavedTracks)
    {
        u1SavedTrackIDs.push(song.id);
    }

    let u2SavedTracks = await getAllSavedTracks(friendAccessToken);

    let u2SavedTrackIDs = [];

    for(let song of u2SavedTracks)
    {
        u2SavedTrackIDs.push(song.id);
    }

    for(let song of u2SavedTrackIDs)
    {
        if(u1SavedTrackIDs.includes(song.id))
        {
            mutualSongIDs.push(song.id);
        }
    }

    console.log("Length after liked songs: " + mutualSongIDs.length);
    // Make sure multiple genres accounted for?

    if(mutualSongIDs.length >= 20)
    {
        // return mutualSongIDs;
    }


    // get top genres from both of them, and then filter their top songs by genres
    // Then filter their liked songs by genre

}

// TODO add a number of songs param
async function getTopTracks(timePeriod, access_token_param)
{
    let options = {
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + access_token_param
        }
    };

    let res = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=' + timePeriod + '&limit=50', options);
    let data = await res.json();

    return data.items;
}

async function getAllSavedTracks(access_token_param)
{
    let maxTracks = 50;
    let tracks = [];
    let offset = 0;
    let previousNumTracks;

    let options = {
      method: "GET",
      headers: {
        'Authorization': 'Bearer ' + access_token_param
      }
    };

    // Takes roughly 4 seconds for 1300 songs
    do
    {
        let res = await fetch('https://api.spotify.com/v1/me/tracks?limit=50&offset=' + offset, options);
        let data = await res.json();

        previousNumTracks = data.items.length;
        offset += previousNumTracks;

        for(let song of data.items)
        {
            tracks.push(song.track);
        }
    }
    while (previousNumTracks == maxTracks)

    return tracks;
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

  let res = await fetch('https://api.spotify.com/v1/users/' + userID + '/playlists', options);
  let data = await res.json();

  return data;
}
