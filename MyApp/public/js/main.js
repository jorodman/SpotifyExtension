
window.onload = async function()
{
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    const access_token = urlParams.get('access_token');
    const fourWeeks = urlParams.get("fourWeekPlaylist");
    const sixMonths = urlParams.get("sixMonthPlaylist");
    const allTime = urlParams.get("allTimePlaylist");
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
            // sessionStorage['display_name'] = userdata.display_name;
            sessionStorage['id'] = userdata.id;
            sessionStorage['fourWeekPlaylist'] = fourWeeks;
            sessionStorage['sixMonthPlaylist'] = sixMonths;
            sessionStorage['allTimePlaylist'] = allTime;

            login();
        }
        else if(sessionStorage['access_token'])
        {
            login();
        }
        else
        {
            console.log('no access token');
        }
    }
}

function login()
{
    let itemsToShow = document.querySelectorAll(".logged-in");

    for(let item of itemsToShow)
    {
        item.classList.remove("d-none");
    }

    let itemsToHide = document.querySelectorAll(".logged-out");

    for(let item of itemsToHide)
    {
        item.classList.add("d-none");
    }

    //************* ADD EVENT LISTENERS TO PLAYLIST GENERATE BUTTONS *************//

    let fourWeekButton = document.getElementById("generateFourWeek");
    fourWeekButton.addEventListener("click", generatePlaylistHack.bind(this, "fourWeekPlaylist", fourWeekButton));

    if(sessionStorage['fourWeekPlaylist'] === "1")
    {
        fourWeekButton.innerText = "Delete";
    }

    let sixMonthButton = document.getElementById("generateSixMonth");
    sixMonthButton.addEventListener("click", generatePlaylistHack.bind(this, "sixMonthPlaylist", sixMonthButton));

    if(sessionStorage['sixMonthPlaylist'] === "1")
    {
        sixMonthButton.innerText = "Delete";
    }

    let allTimeButton = document.getElementById("generateAllTime");
    allTimeButton.addEventListener("click", generatePlaylistHack.bind(this, "allTimePlaylist", allTimeButton));

    if(sessionStorage['allTimePlaylist'] === "1")
    {
        allTimeButton.innerText = "Delete";
    }

}

function generatePlaylistHack(timePeriod, button)
{
    if(button.innerText === "Generate")
    {
        generatePlaylist(timePeriod);
    }
    else
    {
        deletePlaylist(timePeriod);
    }
}

async function generatePlaylist(timePeriod)
{
    let options = {
        method: "GET"
    };

    try
    {
        let res = await fetch('/generatePlaylist?timePeriod=' + timePeriod + "&user=" + sessionStorage['id'], options);

        updatePlaylistButtonText(timePeriod, "Delete");
    }
    catch(error)
    {
        alert(error);
    }
}

async function deletePlaylist(timePeriod)
{
    let options = {
        method: "GET"
    };

    try
    {
        let res = await fetch('/deletePlaylist?timePeriod=' + timePeriod + "&user=" + sessionStorage['id'], options);

        if(res.status === 200)
        {
            updatePlaylistButtonText(timePeriod, "Generate");
        }
    }
    catch(error)
    {
        alert(error);
    }
}

function updatePlaylistButtonText(type, text)
{
    if(type === "fourWeekPlaylist")
    {
        let fourWeekButton = document.getElementById("generateFourWeek");
        fourWeekButton.innerText = text;
    }
    else if(type === "sixMonthPlaylist")
    {
        let sixMonthButton = document.getElementById("generateSixMonth");
        sixMonthButton.innerText = text;
    }
    else if(type === "allTimePlaylist")
    {
        let allTimeButton = document.getElementById("generateAllTime");
        allTimeButton.innerText = text;
    }
}

function logout()
{
    let itemsToShow = document.querySelectorAll(".logged-out");

    for(let item of itemsToShow)
    {
        item.classList.remove("d-none");
    }

    let itemsToHide = document.querySelectorAll(".logged-in");

    for(let item of itemsToHide)
    {
        item.classList.add("d-none");
    }
}

// async function generatePlaylist(name, description)
// {
//
//   let options = {
//     method: "POST",
//     headers: {
//       'Authorization': 'Bearer ' + sessionStorage['access_token'],
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       name: name,
//       description: description,
//       public: false
//     })
//   };
//
//   let res = await fetch('https://api.spotify.com/v1/users/' + sessionStorage['id'] + '/playlists', options);
//   let data = await res.json();
//
//   return data;
// }
