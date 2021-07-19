
var DatabaseClient = require('./databaseClient.js');

const fetch = require('node-fetch');
var request = require('request');

var client_id = '68829692b36742b68cf3163a55138448'; // Your client id
var client_secret = '761fc3a6e9054badb680d682b5dcd354'; // Your secret

var connection = new DatabaseClient();

setupDatabaseConnection();

async function setupDatabaseConnection()
{
    await connection.connect();

    try
    {
        let success = await updateAllPlaylists();
    }
    catch(error)
    {
        console.log(error);
    }
    finally
    {

    }
}

async function updateAllPlaylists()
{
    let users = await connection.query("Select * from users");

    for(let user of users)
    {
        let access_token = await getAccessToken(user.refresh_token);

        if(user.fourWeekPlaylist)
        {
            let playlistIDs = await connection.query("Select id from playlists where userName = \'" + user.name + "\' and type = 'fourWeekPlaylist'");

            if(playlistIDs[0])
            {
                let tracks = await getTopTracks("short_term", access_token, 200);
                let success = await replaceAllSongsInPlaylist(playlistIDs[0].id, access_token, tracks);
            }
        }

        if(user.sixMonthPlaylist)
        {
            let playlistIDs = await connection.query("Select id from playlists where userName = \'" + user.name + "\' and type = \'sixMonthPlaylist\'");

            if(playlistIDs[0])
            {
                let tracks = await getTopTracks("medium_term", access_token, 200);
                let success = await replaceAllSongsInPlaylist(playlistIDs[0].id, access_token, tracks);
            }
        }

        if(user.allTimePlaylist)
        {
            let playlistIDs = await connection.query("Select id from playlists where userName = \'" + user.name + "\' and type = \'allTimePlaylist\'");

            if(playlistIDs[0])
            {
                let tracks = await getTopTracks("long_term", access_token, 200);
                let success = await replaceAllSongsInPlaylist(playlistIDs[0].id, access_token, tracks);
            }
        }
    }

    //setTimeout(() => { updateAllPlaylists() }, 1000);
}

async function replaceAllSongsInPlaylist(playlistID, access_token_param, tracks)
{
    let uris = [];

    for(let track of tracks)
    {
        uris.push(track.uri);
    }

    let options = {
        method: "PUT",
        headers: {
          'Authorization': 'Bearer ' + access_token_param,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'uris': uris
        })
    };

    let res = await fetch('https://api.spotify.com/v1/playlists/' + playlistID + '/tracks', options);

    console.log(res.status);

    return res.status;
}


async function getCurrentSongsInPlaylist(playlistID, access_token_param)
{
    let options = {
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + access_token_param
        }
    };

    let res = await fetch('https://api.spotify.com/v1/playlists/' + playlistID + "?fields=tracks", options);
    let data = await res.json();

    return data.tracks;
}

async function getAccessToken(refresh_token_param)
{
    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token_param
        },
        json: true
    };

    return new Promise(function(resolve, reject)
    {
        request.post(authOptions, function(error, response, body)
        {
            if (!error && response.statusCode === 200)
            {
                resolve(body.access_token);
            }
            else
            {
                reject("error");
            }
        })
    });
}


// What would happen if you request 80 songs not 100?
async function getTopTracks(timePeriod, access_token_param, numTracks)
{
    console.log("num tracks: " + numTracks);
    let options = {
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + access_token_param
        }
    };

    let topUserTracks = [];
    let tracksRecieved = 0;
    let increment = 50;
    let limit = 50;

    while(tracksRecieved < numTracks)
    {
        let res = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=' + timePeriod + '&limit=' + limit + '&offset=' + 0, options);
        let data = await res.json();

        tracksRecieved += increment;
        limit += increment;

        topUserTracks = topUserTracks.concat(data.items);
    }

    console.log("Total songs: " + topUserTracks.length);

    return topUserTracks;
}
