
var DatabaseClient = require('./databaseClient.js');

const fetch = require('node-fetch');
var request = require('request');

var client_id = '68829692b36742b68cf3163a55138448'; // Your client id
var client_secret = '761fc3a6e9054badb680d682b5dcd354'; // Your secret

var connection = new DatabaseClient();

setupDatabaseConnection();

async function setupDatabaseConnection()
{
    try
    {
        let connected = await connection.connect();
        let playlistsUpdated = await updateAllPlaylists();
    }
    catch(error)
    {
        console.log(error);
    }
    finally
    {
        //setTimeout(() => { updateAllPlaylists() }, 1000);
    }
}

async function updateAllPlaylists()
{
    let users = await connection.query("Select * from users");

    for(let user of users)
    {
        let access_token = await getAccessToken(user.refresh_token);

        // TODO: update to use the new database schema
        if(user)
        {
            let queryResults = await connection.query("Select id from playlists where userName = \'" + user.name + "\' and type = 'fourWeekPlaylist'");
            let playlistObj = queryResults[0];

            if(playlistObj)
            {
                let tracks = await getTopTracks("short_term", access_token, 100);

                // TODO maybe change this to a clear playlist function?
                let clearPlaylistResult = await replaceAllSongsInPlaylist(playlistObj.id, access_token, []);
                let addSongsResult = await addTracksToPlaylist(playlistObj.id, access_token, tracks);
            }
        }

        if(user)
        {
            let queryResults = await connection.query("Select id from playlists where userName = \'" + user.name + "\' and type = \'sixMonthPlaylist\'");
            let playlistObj = queryResults[0];

            if(playlistObj)
            {
                let tracks = await getTopTracks("medium_term", access_token, 200);
                let clearPlaylistResult = await replaceAllSongsInPlaylist(playlistObj.id, access_token, []);
                let addSongsResult = await addTracksToPlaylist(playlistObj.id, access_token, tracks);
            }
        }

        if(user)
        {
            let queryResults = await connection.query("Select id from playlists where userName = \'" + user.name + "\' and type = \'allTimePlaylist\'");
            let playlistObj = queryResults[0];

            if(playlistObj)
            {
                let tracks = await getTopTracks("long_term", access_token, 200);
                let clearPlaylistResult = await replaceAllSongsInPlaylist(playlistObj.id, access_token, []);
                let addSongsResult = await addTracksToPlaylist(playlistObj.id, access_token, tracks);
            }
        }
    }
}

async function replaceAllSongsInPlaylist(playlistID, access_token_param, tracks)
{
    console.log("Clearing playlist " + playlistID);

    let uris = [];

    for(let track of tracks)
    {
        uris.push(track.uri);
    }

    // TODO remove the number of songs from the playlist not just 500
    let options = {
        method: "PUT",
        headers: {
          'Authorization': 'Bearer ' + access_token_param,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'uris': uris
        }),
        range_start: 0,
        range_length: 500
    };

    let res = await fetch('https://api.spotify.com/v1/playlists/' + playlistID + '/tracks', options);

    if(res.status === 201)
    {
        console.log("Playlist cleared");
    }
    else
    {
        console.log("Error clearing playlist");
    }
}

// ALLOWS DUPLICATES
async function addTracksToPlaylist(playlistID, access_token_param, tracks)
{
    let uris = [];

    for(let track of tracks)
    {
        uris.push(track.uri);
    }

    let tracksAdded = 0;
    let tracksLeft = uris.length;

    while(tracksLeft > 0)
    {
        // At index 0, remove 100 elements and put them in tempTracks
        let tempTracks = uris.splice(0, 100);

        let options = {
            method: "POST",
            headers: {
                'Authorization': 'Bearer ' + access_token_param,
                'Content-Type': 'application/json'
                },
            body: JSON.stringify({
            uris: tempTracks
            })
        };

        let res = await fetch('https://api.spotify.com/v1/playlists/' + playlistID + '/tracks', options);

        if(res.status === 201)
        {
            tracksAdded += 100;
            tracksLeft = uris.length;

            let json = await res.json();
            let snapshot = json.snapshot_id;
        }
        else
        {
            console.log("Error adding tracks to playlist: " + res.status);
        }
    }
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


async function getTopTracks(timePeriod, access_token_param, numTracks)
{
    // HACK cause spotify won't let you get more than 99 top songs
    if(numTracks > 99)
    {
        numTracks = 99;
    }

    console.log("Getting top " + numTracks + " tracks");

    let options = {
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + access_token_param
        }
    };

    let topUserTracks = [];
    let tracksRecieved = 0;

    if(numTracks <= 50)
    {
        let res = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=' + timePeriod + '&limit=' + numTracks + '&offset=' + 0, options);
        let data = await res.json();

        // Just in case it gets stuck in an infinite loop
        if(res.status === 200 && data.items.length > 0)
        {
            topUserTracks = topUserTracks.concat(data.items);
        }
    }
    else
    {
        while(tracksRecieved < numTracks)
        {
            let tracksLeft = numTracks - tracksRecieved;
            let limit = (tracksLeft > 50) ? 49 : tracksLeft;

            console.log("Tracks left: " + tracksLeft);
            console.log("Limit:       " + limit);
            console.log("offset:      " + tracksRecieved);

            let res = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=' + timePeriod + '&limit=' + limit + '&offset=' + tracksRecieved, options);
            let data = await res.json();

            tracksRecieved += data.items.length;

            // Just in case it gets stuck in an infinite loop
            if(res.status !== 200 || data.items.length === 0)
            {
                break;
            }

            topUserTracks = topUserTracks.concat(data.items);
        }
    }

    const uniqueTracks = [...new Map(topUserTracks.map(item => [item['id'], item])).values()]

    return uniqueTracks;
}


/* Unused functions */

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


// This is what it would be if spotify would let developers get as many tracks as possible
async function getTopTracksInTheory(timePeriod, access_token_param, numTracks)
{
    console.log("Getting top " + numTracks + " tracks");

    let options = {
        method: "GET",
        headers: {
          'Authorization': 'Bearer ' + access_token_param
        }
    };

    let topUserTracks = [];

    let tracksRecieved = 0;

    while(tracksRecieved < numTracks)
    {
        let tracksLeft = numTracks - tracksRecieved;
        let limit = (tracksLeft > 50) ? 50 : tracksLeft;

        let res = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=' + timePeriod + '&limit=' + limit + '&offset=' + tracksRecieved, options);
        let data = await res.json();

        tracksRecieved += data.items.length;

        // Just in case it gets stuck in an infinite loop
        if(res.status !== 200 || data.items.length === 0)
        {
            break;
        }

        topUserTracks = topUserTracks.concat(data.items);
    }

    const unique = [...new Map(topUserTracks.map(item => [item['id'], item])).values()]

    return unique;
}
