
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
    let deleted = await Common.checkForDeletedPlaylists(connection);
    let playlistsUpdated = await Common.updateAllPlaylists(connection);
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
