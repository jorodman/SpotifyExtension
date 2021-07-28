
var Config = require('./config.js');

var fetch = require('node-fetch');
var request = require('request');

async function getUserPreferences(userName, connection)
{
    let playlists = await connection.query("Select type from users natural join playlists where name = \'" + userName + "\'");

    let fourWeekPlaylist = 0;
    let sixMonthPlaylist = 0;
    let allTimePlaylist = 0;

    if(playlists)
    {
        for(let playlist of playlists)
        {
            if(playlist.type === "fourWeekPlaylist")
            {
                fourWeekPlaylist = 1;
            }
            else if(playlist.type === "sixMonthPlaylist")
            {
                sixMonthPlaylist = 1;
            }
            else if(playlist.type === "allTimePlaylist")
            {
                allTimePlaylist = 1;
            }
        }
    }

    return {
        fourWeekPlaylist: fourWeekPlaylist,
        sixMonthPlaylist: sixMonthPlaylist,
        allTimePlaylist: allTimePlaylist
    };
}

async function postRequest(options)
{
    return new Promise(function (resolve, reject) {

        request.post(options, function(error, response, body) {
            if(!error)
            {
                resolve({
                    response: response,
                    body: body
                });
            }
            else
            {
                reject({
                    error: error
                });
            }
        });
    });
}

async function getRequest(options)
{
    return new Promise(function (resolve, reject) {

        request.get(options, function(error, response, body) {
            if(!error)
            {
                resolve({
                    response: response,
                    body: body
                });
            }
            else
            {
                reject({
                    error: error
                });
            }
        });
    });
}

async function getAccessToken(refresh_token_param)
{
    // let string = (Config.client_id + ':' + Config.client_secret).toString('base64');
    // let buffer = Buffer.from(string);

    let buffer = (new Buffer(Config.client_id + ':' + Config.client_secret).toString('base64'));

    var authOptions =
    {
        url: 'https://accounts.spotify.com/api/token',
        headers: {
            'Authorization': 'Basic ' + buffer
        },
        form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token_param
        },
        json: true
    };

    return postRequest(authOptions);
}

async function checkForDeletedPlaylists(connection)
{
    let playlists = await connection.query("Select id, userName from playlists");

    for(let playlist of playlists)
    {
        let users = await connection.query("Select refresh_token, name from users where name = \'" + playlist.userName + "\'");
        let user = users[0];

        let tokenRequest = await getAccessToken(user.refresh_token, Config.client_id, Config.client_secret);
        let access_token = tokenRequest.body.access_token;

        let options = {
            method: "GET",
            headers: {
              'Authorization': 'Bearer ' + access_token
            }
        };

        let response = await fetch('https://api.spotify.com/v1/playlists/' + playlist.id + '/followers/contains?ids=' + user.name, options);
        let following = await response.json();

        if(!following[0] || response.status === 404)
        {
            console.log("Deleting playlist: " + playlist.id);

            let deleted = await connection.query("delete from playlists where id = '" + playlist.id + "\'");
        }
    }
}


async function updateAllPlaylists(connection)
{
    let users = await connection.query("Select * from users");

    for(let user of users)
    {
        let preferences = await getUserPreferences(user.name, connection);
        let tokenRequest = await getAccessToken(user.refresh_token);
        let access_token = tokenRequest.body.access_token;

        if(preferences.fourWeekPlaylist)
        {
            let queryResults = await connection.query("Select id from playlists where userName = \'" + user.name + "\' and type = 'fourWeekPlaylist'");
            let playlistObj = queryResults[0];

            if(playlistObj)
            {
                let updated = await updatePlaylist("short_term", playlistObj.id, connection, access_token);
            }
        }

        if(preferences.sixMonthPlaylist)
        {
            let queryResults = await connection.query("Select id from playlists where userName = \'" + user.name + "\' and type = \'sixMonthPlaylist\'");
            let playlistObj = queryResults[0];

            if(playlistObj)
            {
                let updated = await updatePlaylist("medium_term", playlistObj.id, connection, access_token);
            }
        }

        if(preferences.allTimePlaylist)
        {
            let queryResults = await connection.query("Select id from playlists where userName = \'" + user.name + "\' and type = \'allTimePlaylist\'");
            let playlistObj = queryResults[0];

            if(playlistObj)
            {
                let updated = await updatePlaylist("long_term", playlistObj.id, connection, access_token);
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
}

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

            let res = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=' + timePeriod + '&limit=' + limit + '&offset=' + tracksRecieved, options);
            let data = await res.json();

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

async function updatePlaylist(timePeriod, playlistID, connection, access_token)
{
    try
    {
        let tracks = await getTopTracks(timePeriod, access_token, 100);
        let clearPlaylistResult = await replaceAllSongsInPlaylist(playlistID, access_token, []);
        let addSongsResult = await addTracksToPlaylist(playlistID, access_token, tracks);
    }
    catch(error)
    {
        console.log(error);
    }
}

function timePeriodToSpotifyTerm(timePeriod)
{
    let spotifyTerm;

    if(timePeriod === "fourWeekPlaylist")
    {
        spotifyTerm = "short_term";
    }
    else if(timePeriod === "sixMonthPlaylist")
    {
        spotifyTerm = "medium_term";
    }
    else
    {
        spotifyTerm = "long_term";
    }

    return spotifyTerm;
}

module.exports = {
    checkForDeletedPlaylists,
    getAccessToken,
    getRequest,
    postRequest,
    getUserPreferences,
    updateAllPlaylists,
    updatePlaylist,
    timePeriodToSpotifyTerm
};
