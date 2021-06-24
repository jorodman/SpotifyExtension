// /* Load the HTTP library */
// var http = require("http");
//
// /* Create an HTTP server to handle responses */
//
// http.createServer(function(request, response) {
//   response.writeHead(200, {"Content-Type": "text/plain"});
//   response.write("Hello World");
//   response.end();
// }).listen(8888);


var express = require('express');
var request = require('request'); // "Request" library
var cors = require('cors');
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


app.get('/test', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.send({ data: 'user created in db' });
});

app.get('/login', function(req, res) {
  console.log("/login");

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
      state: state
    }));
});

app.get('/callback', function(req, res)
{
  console.log('/callback');
  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState)
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

            // res.setHeader('Content-Type', 'application/json');
            // res.send({
            //   access_token: access_token
            // });

    //         var options = {
    //           url: 'https://api.spotify.com/v1/me',
    //           headers: { 'Authorization': 'Bearer ' + access_token },
    //           json: true
    //         };
    //
    //         // use the access token to access the Spotify Web API
    //         request.get(options, function(error, response, body) {
    // //          console.log(body);
    //         });


            /***** PLAYING AROUND ***/

            // options = {
            //   url: 'https://api.spotify.com/v1/me/playlists?limit=1',
            //   headers: { 'Authorization': 'Bearer ' + access_token },
            //   json: true
            // };
            //
            // // use the access token to access the Spotify Web API
            // request.get(options, function(error, response, body)
            // {
            //
            //   for(let playlist of body.items)
            //   {
            //       //console.log(playlist.name);
            //   }
            //   //  console.log(body);
            // });


            // options = {
            //   url: 'https://api.spotify.com/v1/me/following/contains?type=user&ids=brendanrodman3',
            //   headers: { 'Authorization': 'Bearer ' + access_token },
            //   json: true
            // };
            //
            // // use the access token to access the Spotify Web API
            // request.get(options, function(error, response, body) {
            //   console.log(body);
            // });

            /************************/

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




var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};
