
/* This is the front end scrip that makes http requests to the server and updates the browser accordingly */


/*
    When the window loads it can be in one of two states:

    1) The user has reloaded the page, in which case session storage holds the user's id and preferences if they had logged in
    2) The user has been redirected from spotify after login in which case the url contains the user id and preferences
 */
window.onload = async function()
{
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    const userID = urlParams.get('id');
    const fourWeekPlaylist = urlParams.get("fourWeekPlaylist");
    const sixMonthPlaylist = urlParams.get("sixMonthPlaylist");
    const allTimePlaylist = urlParams.get("allTimePlaylist");

    if(userID)
    {
        sessionStorage['userID'] = userID;
        sessionStorage['fourWeekPlaylist'] = fourWeekPlaylist;
        sessionStorage['sixMonthPlaylist'] = sixMonthPlaylist;
        sessionStorage['allTimePlaylist'] = allTimePlaylist;

        updatePageAfterLogin();
    }
    else if(sessionStorage['userID'])
    {
        updatePageAfterLogin();
    }

    // Unused for now - needed if a quota extension is requested from spotify
    // let clearDataButton = document.getElementById("clearDataButton");
    // clearDataButton.addEventListener("click", onClickClearData.bind(this, clearDataButton));
}

/* Hides items that should only be shown when logged out, and shows items that should only be shown when logged in */
function updatePageAfterLogin()
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

    //************* ADDS EVENT LISTENERS TO PLAYLIST GENERATE/DELETE BUTTONS *************//

    let fourWeekButton = document.getElementById("generateFourWeek");
    fourWeekButton.addEventListener("click", onClickPlaylistButton.bind(this, "fourWeekPlaylist", fourWeekButton));

    if(sessionStorage['fourWeekPlaylist'] === "1")
    {
        fourWeekButton.innerText = "Delete";
    }

    let sixMonthButton = document.getElementById("generateSixMonth");
    sixMonthButton.addEventListener("click", onClickPlaylistButton.bind(this, "sixMonthPlaylist", sixMonthButton));

    if(sessionStorage['sixMonthPlaylist'] === "1")
    {
        sixMonthButton.innerText = "Delete";
    }

    let allTimeButton = document.getElementById("generateAllTime");
    allTimeButton.addEventListener("click", onClickPlaylistButton.bind(this, "allTimePlaylist", allTimeButton));

    if(sessionStorage['allTimePlaylist'] === "1")
    {
        allTimeButton.innerText = "Delete";
    }
}


function onClickPlaylistButton(timePeriod, button)
{
    // TODO don't use button innerText cause the user can change this
    if(button.innerText === "Generate")
    {
        generatePlaylist(timePeriod);
    }
    else
    {
        deletePlaylist(timePeriod);
    }
}

/* Makes a call to the web server to create a playlist */
async function generatePlaylist(timePeriod)
{
    try
    {
        let options = {
            method: "GET"
        };

        let res = await fetch('/generatePlaylist?timePeriod=' + timePeriod + "&user=" + sessionStorage['userID'], options);

        updatePlaylistButtonText(timePeriod, "Delete");
    }
    catch(error)
    {
        alert(error);
    }
}

/* Makes a call to the web server to delete the playlist */
async function deletePlaylist(timePeriod)
{
    try
    {
        let options = {
            method: "GET"
        };

        let res = await fetch('/deletePlaylist?timePeriod=' + timePeriod + "&user=" + sessionStorage['userID'], options);

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

/* Changes the text of the button associated with the time period */
function updatePlaylistButtonText(type, text)
{
    let button;

    if(type === "fourWeekPlaylist")
    {
        button = document.getElementById("generateFourWeek");
    }
    else if(type === "sixMonthPlaylist")
    {
        button = document.getElementById("generateSixMonth");
    }
    else if(type === "allTimePlaylist")
    {
        button = document.getElementById("generateAllTime");
    }

    button.innerText = text;
}

/** Unused functions **/

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


async function onClickClearData()
{
    // The user is logged in
    if(sessionStorage['userID'])
    {
        let options = {
            method: "GET"
        };

        let res = await fetch('/clearData?user=' + sessionStorage['userID'], options);

        if(res.status === 200)
        {
            alert("You have been logged out and your data has been cleared")
        }
        else
        {
            alert("ERROR clearing data");
        }
    }
    else
    {
        let options = {
            method: "GET"
        };

        let res = await fetch('/clearDataLoginFirst', options);

        if(res.status === 200)
        {
            alert("Your data has been cleared")
        }
        else
        {
            alert("ERROR clearing data");
        }
    }
}
