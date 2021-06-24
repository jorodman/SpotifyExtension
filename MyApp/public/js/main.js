
import
{
  User
} from "./user.js";

var user;

window.onload = async function()
{
    var params = getHashParams();

    var access_token = params.access_token;
    var error = params.error;

    if (error)
    {
        alert('There was an error during the authentication');
    }
    else
    {
        if (access_token)
        {
            user = new User(access_token);

            let options =
            {
                url: 'https://api.spotify.com/v1/me',
                headers: { 'Authorization': 'Bearer ' + user.access_token },
                json: true
            };

            let myResp = await fetch('https://api.spotify.com/v1/me', options);
            let userdata = await myResp.json();

            user.display_name = userdata.display_name;
            user.id = userdata.id;
            user.country = userdata.country;
            user.email = userdata.email;

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
    document.getElementById("login").classList.add("d-none");
    document.getElementById("loggedIn").classList.remove("d-none");
    document.getElementById("loggedIn").classList.add("d-block");

    let playlistButton = document.getElementById("generatePlaylist");
    playlistButton.addEventListener("click", generatePlaylistHack);

    let msg = document.getElementById("welcomeMessage");
    msg.innerText = "Welcome to spotify connect, " + user.display_name + "! Let's start my generating a playlist for you based off of songs that you have been listening to on repeat";
}

function generatePlaylistHack()
{
    generatePlaylist();
}

async function generatePlaylist()
{
  console.log('generate playlist called');

  let options = {
    method: "POST",
    headers: {
      'Authorization': 'Bearer ' + user.access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: "New Playlist",
      description: "New playlist description",
      public: false
    })
  };

  let res = await fetch('https://api.spotify.com/v1/users/' + user.id + '/playlists', options);
  let data = await res.json();
  
  console.log(data);
}


function getHashParams()
{
  var hashParams = {};
  var e, r = /([^&;=]+)=?([^&;]*)/g,
      q = window.location.hash.substring(1);
  while ( e = r.exec(q)) {
     hashParams[e[1]] = decodeURIComponent(e[2]);
  }
  return hashParams;
}
