
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
    let string = (Config.client_id + ':' + Config.client_secret).toString('base64');
    let buffer = Buffer.from(string);

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

async function checkForDeletedPlaylists(connnection)
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

module.exports = {
    checkForDeletedPlaylists,
    getAccessToken,
    getRequest,
    postRequest,
    getUserPreferences
};
