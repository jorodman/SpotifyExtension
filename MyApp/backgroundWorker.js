
var DatabaseClient = require('./databaseClient.js');
var Common = require('./common.js');
var Config = require('./config.js');

var fetch = require('node-fetch');
var connection = new DatabaseClient();

run();

async function run()
{
    try
    {
        let db = await setupDatabaseConnection();
    }
    catch (e)
    {
        console.log(e);
    }
    finally
    {
        // Update playlists once per day
        let updated = await update();

        setTimeout(() => { update() }, 3600000 );
    }
}

async function update()
{
    //let deleted = await Common.checkForDeletedPlaylists(connection);
    let playlistsUpdated = await updateAllPlaylists();
}


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

async function updateAllPlaylists()
{
    let users = await connection.query("Select * from users");

    for(let user of users)
    {
        let tokenRequest = await Common.getAccessToken(user.refresh_token);

        let access_token = tokenRequest.body.access_token;

        let preferences = await Common.getUserPreferences(user.name, connection);

        // TODO: update to use the new database schema
        if(preferences.fourWeekPlaylist)
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

        if(preferences.sixMonthPlaylist)
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

        if(preferences.allTimePlaylist)
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
        console.log("Error clearing playlist: " + res.status);
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
        }
        else
        {
            console.log("Error adding tracks to playlist: " + res.status);
        }
    }
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

            // Just in case it gets stuck in an infinite loop
            if(res.status !== 200 || data.items.length === 0)
            {
                break;
            }

            tracksRecieved += data.items.length;

            topUserTracks = topUserTracks.concat(data.items);
        }
    }

    const uniqueTracks = [...new Map(topUserTracks.map(item => [item['id'], item])).values()]

    return uniqueTracks;
}


/******************************* Unused functions that may be used if more features are implemented *******************************/

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
