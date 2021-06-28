

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

        addEventListeners();
        initialRequest();
    }
}

function addEventListeners()
{
    let fourWeeks = document.getElementById("ArtistsFourWeeks");
    let sixMonths = document.getElementById("ArtistsSixMonths");
    let allTime = document.getElementById("ArtistsAllTime");

    fourWeeks.addEventListener("click", queryHack.bind("short_term"));
    sixMonths.addEventListener("click", queryHack.bind("medium_term"));
    allTime.addEventListener("click", queryHack.bind("long_term"));

    let fourWeeksSongs = document.getElementById("SongsFourWeeks");
    let sixMonthsSongs = document.getElementById("SongsSixMonths");
    let allTimeSongs = document.getElementById("SongsAllTime");

    fourWeeksSongs.addEventListener("click", queryHackSongs.bind("short_term"));
    sixMonthsSongs.addEventListener("click", queryHackSongs.bind("medium_term"));
    allTimeSongs.addEventListener("click", queryHackSongs.bind("long_term"));
}

function showLoggedInMenuIcons()
{
    let links = document.getElementById("navbar").getElementsByTagName("li");

    for(let link of links)
    {
        link.classList.remove('d-none');
    }
}

function queryHack()
{
    changeTopArtists(this);
}

function queryHackSongs()
{
    changeTopSongs(this);
}

async function changeTopArtists(timePeriod)
{
    let artists = await getTopArtists(timePeriod);
    populateWithArtists(artists);
}

async function changeTopSongs(timePeriod)
{
    let tracks = await getTopTracks(timePeriod);
    populateWithTracks(tracks);
}

async function initialRequest()
{
    let tracks = await getTopTracks("short_term");
    populateWithTracks(tracks);

    let artists = await getTopArtists("short_term");
    populateWithArtists(artists);

    let library = await getAllSavedTracks();

    let sorted = sortSongsByPopularity(library);

    let threshhold = 40;

    let noPopularArtists = await removeSongsByPopularArtists(sorted.slice(0,100), threshhold);

    // TODO handle libraries of less than five songs
    pupolateWithUniqueSongs(noPopularArtists.slice(0,5));
}

function pupolateWithUniqueSongs(tracks)
{
    let list = document.getElementById("uniqueSongs");
    list.innerHTML = '';

    for(let track of tracks)
    {
        let element = document.createElement("li");
        element.classList.add('list-group-item');
        element.innerText = track.name;
        list.appendChild(element);
    }
}

function populateWithTracks(tracks)
{
    let list = document.getElementById("tracklist");
    list.innerHTML = '';

    for(let track of tracks)
    {
        let element = document.createElement("li");
        element.classList.add('list-group-item');
        element.innerText = track.name;
        list.appendChild(element);
    }
}

function populateWithArtists(artists)
{
    let list = document.getElementById("artistList");
    list.innerHTML = '';

    for(let artist of artists)
    {
        let element = document.createElement("li");
        element.classList.add('list-group-item');
        element.innerText = artist.name;
        list.appendChild(element);
    }
}

async function removeSongsByPopularArtists(tracks, threshhold)
{
    let uniqueTracks = [];

    let options = {
      method: "GET",
      headers: {
        'Authorization': 'Bearer ' + sessionStorage['access_token']
      }
    };

    for(let track of tracks)
    {
        let url = 'https://api.spotify.com/v1/artists?ids=';

        for(let artist of track.artists)
        {
            url += artist.id + ',';
        }

        url = url.substring(0, url.length - 1);

        let response = await fetch(url, options);
        let data = await response.json();

        for(let artist of data.artists)
        {
            if(artist.popularity < threshhold)
            {
                uniqueTracks.push(track);
                break;
            }
        }
    }

    return uniqueTracks;
}

function sortSongsByPopularity(tracks)
{
    return tracks.sort(sortByPopularity);
}

function sortByPopularity(trackA, trackB)
{
    if (trackA.popularity < trackB.popularity)
    {
        return -1;
    }
    else if (trackA.popularity > trackB.popularity)
    {
       return 1;
    }

    return 0;
}

async function getUniqueTracks(tracks)
{
    let uniqueTracks = [];

    let options = {
      method: "GET",
      headers: {
        'Authorization': 'Bearer ' + sessionStorage['access_token']
      }
    };

    for(let track of tracks)
    {
        if(track.popularity < 40)
        {
            let url = 'https://api.spotify.com/v1/artists?ids=';

            for(let artist of track.artists)
            {
                url += artist.id + ',';
            }

            url = url.substring(0, url.length - 1);

            let response = await fetch(url, options);
            let data = await response.json();

            for(let artist of data.artists)
            {
                if(artist.popularity < 40)
                {
                    uniqueTracks.push(track);
                    break;
                }
            }
        }
    }

    return uniqueTracks;
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
        'Authorization': 'Bearer ' + sessionStorage['access_token']
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

    populateWithTracks(tracks);

    // let clean = await getCleanTracks(tracks);
    //
    // let cleanPlaylist = await generatePlaylist("My Clean Liked Songs", " ");
    //
    // let result = await addTracksToPlaylist(cleanPlaylist.id, clean);
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
            'Authorization': 'Bearer ' + sessionStorage['access_token'],
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

async function getTopArtists(timePeriod)
{
  let options = {
    method: "GET",
    headers: {
      'Authorization': 'Bearer ' + sessionStorage['access_token']
    }
  };

  let res = await fetch('https://api.spotify.com/v1/me/top/artists?time_range=' + timePeriod + '&limit=10', options);
  let data = await res.json();

  return data.items;
}


async function getTopTracks(timePeriod)
{
  let options = {
    method: "GET",
    headers: {
      'Authorization': 'Bearer ' + sessionStorage['access_token']
    }
  };

  let res = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=' + timePeriod + '&limit=50', options);
  let data = await res.json();

  return data.items;
}

async function generatePlaylist(name, description)
{

  let options = {
    method: "POST",
    headers: {
      'Authorization': 'Bearer ' + sessionStorage['access_token'],
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: name,
      description: description,
      public: false
    })
  };

  let res = await fetch('https://api.spotify.com/v1/users/' + sessionStorage['id'] + '/playlists', options);
  let data = await res.json();

  return data;
}
