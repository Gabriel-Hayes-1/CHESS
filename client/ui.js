const sidebar = document.getElementById('sidebar');
const container = document.getElementById('page-content-container');
const select = document.getElementById('theme-select');
const sidebarToggle = document.getElementById('sidebar-toggle'); 

const COLORS = {
    classic:   ['#f0d9b5', '#b58863'],
    dark:      ['#2f2f2f', '#141414'],
    felt:      ['#e2dcc7', '#6f8f5a'],
    steel:     ['#ededed', '#8a8a8a'],
    parchment: ['#f6f1e3', '#b8a887'],
    marble:    ['#f2f2ee', '#2a2a2a'],
    slate:     ['#d9d9d9', '#7b7f85'],
    ash:       ['#cfcfcf', '#5f5f5f'],   
    olive:     ['#d6dbc8', '#7b8461'],   
    dusk:      ['#3a3f4a', '#1f232b'],
    sand:      ['#e7dcc6', '#b3a17a'],  
    clay:      ['#d1a08a', '#7a4a3a'],  
};

let color = COLORS["classic"]


function hexToRGB(hexString) {
    const r = hexString.slice(1,3);
    const g = hexString.slice(3,5);
    const b = hexString.slice(5,7);
    return [parseInt(r,16), parseInt(g,16), parseInt(b,16)];
}
function findAverageofTwoHex(hex1, hex2) {
    const rgb1 = hexToRGB(hex1);
    const rgb2 = hexToRGB(hex2);
    return [
        (rgb1[0]+rgb2[0])/2,
        (rgb1[1]+rgb2[1])/2,
        (rgb1[2]+rgb2[2])/2,
    ]
}

sidebarToggle.addEventListener("mousedown",(e)=>{

})

function switchPage(page) {
    // Show the requested page and hide all others. Pages are regular DOM elements with class "page".
    const pages = container.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));

    const target = document.getElementById(page);
    if (target && target.classList.contains('page')) {
        target.classList.add('active');
        // call page-specific initializer if present
        if (onOpen[page]) {
            try { onOpen[page](target); } catch (err) { console.error('onOpen.'+page+' failed', err); }
        }
    }
}

const onOpen = {
    settings: (settingsObj)=>{
        const colors = select.querySelectorAll(".color");
        colors[0].style.backgroundColor = color[0];
        colors[1].style.backgroundColor = color[1];
    },
    play: (playObj) => {
        // when returning to the play page redraw the board if the game exists
        /* trying to comment out to see if this is the issue
        if (window.__CHESS_GAME && typeof window.__CHESS_GAME.draw === 'function') {
            try { window.__CHESS_GAME.draw(); } catch (err) { console.error('redraw failed', err); }
        }
        */
    },

}

sidebar.querySelectorAll("button").forEach(e=>{
    e.addEventListener('click', ()=>{
        const page = e.getAttribute('data-page');
        switchPage(page);
    })
})

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, function(char) {
    return char.toUpperCase();
  });
}

const colorDropdown = document.getElementById("theme-dropdown");
select.addEventListener("click",()=>{
    colorDropdown.classList.toggle("hidden");
    colorDropdown.innerHTML = '';
    colorDropdown.style.top = (select.getBoundingClientRect().bottom + "px");

    //populate with colors 
    for (let [colorname,colorpair] of Object.entries(COLORS)) {
        let option = document.createElement("div");
        option.classList.add("colorpair");
        option.title = toTitleCase(colorname.replace(/_/g,' '));

        let col1 = document.createElement("div")
        col1.classList.add("color");
        col1.style.backgroundColor = colorpair[0];

        let col2 = document.createElement("div")
        col2.classList.add("color");
        col2.style.backgroundColor = colorpair[1];

        option.appendChild(col1);
        option.appendChild(col2);

        option.addEventListener("click",()=>{
            color = colorpair;
            colorDropdown.classList.add("hidden");
            onOpen.settings();
        })


        colorDropdown.appendChild(option);
    }
})


const signupBtn = document.getElementById("signup");
const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");
const userNameInput = document.getElementById("usernameInput");
const passwordInput = document.getElementById("passwordInput");
const passwordConfirmInput = document.getElementById("passwordInputConfirm");
const loginFeedback = document.getElementById("login-feedback");
const logoutFeedback = document.getElementById("logout-feedback");
const logInSetting = document.getElementById("login-setting");
const logOutSetting = document.getElementById("logout-setting");
const loginStatus = document.getElementById("loginStatus");

function uiLoggedIn(username) {
    logInSetting.classList.add("hidden");
    logOutSetting.classList.remove("hidden");
    loginStatus.textContent = "Logged in as "+username;
    feedback(loginFeedback,"","");
    userNameInput.value = '';
    passwordInput.value = '';
    passwordConfirmInput.value = '';
}
function uiLoggedOut() {
    logInSetting.classList.remove("hidden");
    logOutSetting.classList.add("hidden");
    loginStatus.textContent = "You are not logged in.";
}

function feedback(feedbackElem,warnLevel,str) {
    const textSpan = document.createElement("span");
    feedbackElem.innerHTML = '';
    feedbackElem.classList.remove("hidden");
    if (warnLevel==="warning") {
        textSpan.classList.add("error");
    } else if (warnLevel==="success") {
        textSpan.classList.add("success");
    }

    textSpan.innerHTML = str;
    feedbackElem.appendChild(textSpan);
}

signupBtn.addEventListener("click",async ()=>{
    const username = userNameInput.value.trim();
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;
    
    if (!username || !password) {
        feedback(loginFeedback,"warning","Username and password are required");
    } else if (password !== passwordConfirm) {
        feedback(loginFeedback,"warning","Passwords do not match");
    } else {
        const result = await signup(username, password);
        if (result.success) {
            uiLoggedIn(username);
            
        } else {
            feedback(loginFeedback,"warning",result.message || "Signup failed");
        }
    }
});

loginBtn.addEventListener("click", async ()=>{
    const username = userNameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
        feedback(loginFeedback,"warning","Username and password are required");
        return
    }
    const result = await login(username,password); 
    if (result.success) {
        uiLoggedIn(username);
    } else {
        feedback(loginFeedback,"warning",result.message)
    }
})

logoutBtn.addEventListener("click", async ()=>{
    const result = await logout();
    if (result.success) {
        uiLoggedOut();
    } else {
        feedback(logoutFeedback,"warning",result.message || "Logout failed");
    }
})

const requestGameBtn = document.getElementById("find-game");
const cancelGameBtn = document.getElementById("cancel-find-game");
const matchmakeFeedback = document.getElementById("matchmaking-feedback");
requestGameBtn.addEventListener("click",async ()=>{
    const result = await startMatchmaking();

    if (result.success) {
        setMatchmakingUI(true)
        feedback(matchmakeFeedback,"", "Waiting for game<span class='dots'></span>");
    } else {
        feedback(matchmakeFeedback,"warning", result.message || "Failed to start matchmaking");
    }
});
cancelGameBtn.addEventListener("click",async ()=>{
    const result = await cancelMatchmaking();

    if (result.success) {
        setMatchmakingUI(false);
        feedback(matchmakeFeedback,"","")
    } else {
        console.log(result.message);
    }
})

function setMatchmakingUI(setState) {
    if (setState) {
        cancelGameBtn.classList.remove("hidden");
        requestGameBtn.classList.add("hidden");
    } else {
        cancelGameBtn.classList.add("hidden");
        requestGameBtn.classList.remove("hidden");
    }
}

setInterval(()=>{
    const dots = document.querySelectorAll(".dots");
    dots.forEach(elem=>{
        const currentText = elem.textContent;
        if (/^\.*$/.test(currentText)) {
            let currentNum = currentText.length
            if (currentNum >= 3) {
                elem.textContent = '';
            } else {
                elem.textContent += '.';
            }
        }
    })
},500)

function changeCardPage(pageId) {
    const cardPages = document.querySelectorAll(".card-page");
    cardPages.forEach(page=>{
        if (page.id === pageId) {
            page.classList.add("active");
        } else {
            page.classList.remove("active");
        }
    })
}


// Default page
switchPage("play");

/*
let listenerActive = false;
document.addEventListener("keydown",(e)=>{
    if (e.key === "F3") {
        e.preventDefault();
        const debugKey = "D";
        const onDebugKey = (event)=>{
            if (event.key.toUpperCase() === debugKey) {
                __CHESS_GAME.debug = !__CHESS_GAME.debug;
                console.log("Debug mode: ", __CHESS_GAME.debug);
            }
            document.removeEventListener("keydown", onDebugKey);
            listenerActive = false;
        }
        if (!listenerActive) {
            document.addEventListener("keydown", onDebugKey);
            listenerActive = true;
        }
    }
})
*/

