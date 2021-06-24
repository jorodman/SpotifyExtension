
import
{
  User
} from "./user.js";

window.onload = async function()
{
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    const access_token = urlParams.get('access_token');
    const error = urlParams.get('error');

    if (error)
    {
        alert('There was an error during the authentication');
    }
    else
    {
        if (access_token)
        {
            let options =
            {
                url: 'https://api.spotify.com/v1/me',
                headers: { 'Authorization': 'Bearer ' + access_token },
                json: true
            };

            let myResp = await fetch('https://api.spotify.com/v1/me', options);
            let userdata = await myResp.json();

            sessionStorage['access_token'] = access_token;
            sessionStorage['display_name'] = userdata.display_name;
            sessionStorage['id'] = userdata.id;

            showLoggedInMenuIcons();
            updateWithUserData();
        }
        else if(sessionStorage['access_token'])
        {
            showLoggedInMenuIcons();
            updateWithUserData();
        }
        else
        {
            console.log('no access token');
        }
    }
}

function updateWithUserData()
{
    if(window.location.pathname == '/' || window.location.pathname.includes("index.html"))
    {
        document.getElementById("login").classList.add("d-none");
        document.getElementById("loggedIn").classList.remove("d-none");
        document.getElementById("loggedIn").classList.add("d-block");

        let playlistButton = document.getElementById("generatePlaylist");
        playlistButton.addEventListener("click", generatePlaylistHack);

        let msg = document.getElementById("welcomeMessage");
        msg.innerText = "Welcome to spotify connect, " + sessionStorage['display_name'] + "!";
    }
}

function showLoggedInMenuIcons()
{
    let links = document.getElementById("navbar").getElementsByTagName("li");

    for(let link of links)
    {
        link.classList.remove('d-none');
    }
}

async function getAllSavedTracks()
{
    let maxTracks = 50;
    let tracks = [];
    let offset = 0;
    let previousNumTracks;

    let options = {
      method: "GET",
      headers: {
        'Authorization': 'Bearer ' + user.access_token
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

function getMutualTracks(list1, list2)
{
    let mutual = [];

    for(let track of list1)
    {
        // TODO use ID for contains function
        if(list2.contains(track))
        {
            mutual.push(track);
        }
    }

    return mutual;
}

function getCleanTracks(tracks)
{
    let clean = [];

    for(let track of tracks)
    {
        // TODO use ID for contains function
        if(!track.explicit)
        {
            clean.push(track);
        }
    }

    return clean;
}

async function generatePlaylistHack()
{
    let tracks = await getAllSavedTracks();

    let clean = await getCleanTracks(tracks);

    let cleanPlaylist = await generatePlaylist("My Clean Liked Songs", " ");

    let result = await addTracksToPlaylist(cleanPlaylist.id, clean);
}

async function addTracksToPlaylist(playlistID, tracks)
{
    let uris = [];

    for(let track of tracks)
    {
        uris.push(track.uri);
    }

    // TODO clean up this design
    let startIndex = 0;
    let tracksLeft = uris.length;

    while(tracksLeft < 0)
    {
        let tempTracks = [];

        if(uris.length < 100)
        {
            tempTracks = uris;
            tracksLeft = 0;
        }
        else
        {
            tempTracks = uris.splice(startIndex, 100);
        }

        let options = {
          method: "POST",
          headers: {
            'Authorization': 'Bearer ' + user.access_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            uris: tempTracks
          })
        };

        let res = await fetch('https://api.spotify.com/v1/playlists/' + playlistID + '/tracks', options);
        let data = await res.json();

        startIndex += 100;
        tracksLeft = uris.length;
    }
}

async function getTopTracks()
{
  let options = {
    method: "GET",
    headers: {
      'Authorization': 'Bearer ' + user.access_token
    }
  };

  let res = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=50', options);
  let data = await res.json();

  return data.items;
}

async function generatePlaylist(name, description)
{

  let options = {
    method: "POST",
    headers: {
      'Authorization': 'Bearer ' + user.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name,
      description: description,
      public: false
    })
  };

  let res = await fetch('https://api.spotify.com/v1/users/' + user.id + '/playlists', options);
  let data = await res.json();

  return data;
}
