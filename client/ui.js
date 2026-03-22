const sidebar = document.getElementById('sidebar');
const container = document.getElementById('page-content-container');
const boardColorSelect = document.getElementById('theme-select');
const sidebarToggle = document.getElementById('sidebar-toggle'); 

import { updateSetting, settings, options } from "./settings.js";





sidebarToggle.addEventListener("mousedown",(e)=>{

})

function switchPage(page) {
    // Show the requested page and hide all others. Pages are regular DOM elements with class "page".
    const pages = container.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));

    const target = document.getElementById(page);
    if (target && target.classList.contains('page')) {
        target.classList.add('active');
        
    }
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
boardColorSelect.addEventListener("click",()=>{
    colorDropdown.classList.toggle("hidden");
    colorDropdown.innerHTML = '';
    colorDropdown.style.top = (boardColorSelect.getBoundingClientRect().bottom + "px");

    //populate with colors 
    for (let [colorname,colorpair] of Object.entries(options.boardColors)) {
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
            updateSetting("boardColors",colorpair)
            colorDropdown.classList.add("hidden");
            loadSettingsUi()
        })

        colorDropdown.appendChild(option);
    }
})

function loadSettingsUi() {
    Array.from(boardColorSelect.children).forEach((e,i)=>{
        e.style.backgroundColor = settings.boardColors[i]
    })
    //add more stuff for each setting...
}
loadSettingsUi()

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

export function uiLoggedIn(username) {
    logInSetting.classList.add("hidden");
    logOutSetting.classList.remove("hidden");
    loginStatus.textContent = "Logged in as "+username;
    feedback(loginFeedback,"","");
    userNameInput.value = '';
    passwordInput.value = '';
    passwordConfirmInput.value = '';
}
export function uiLoggedOut() {
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

export function initMatchmakingUI(networker) {
    requestGameBtn.addEventListener("click", async () => {
        if (!networker) return;
        const result = await networker.joinQueue();

        if (result.success) {
            setMatchmakingUI(true)
            feedback(matchmakeFeedback, "", "Waiting for game<span class='dots'></span>");
        } else {
            feedback(matchmakeFeedback, "warning", result.message || "Failed to start matchmaking");
        }
    });
    cancelGameBtn.addEventListener("click", async () => {
        if (!networker) return;
        const result = await networker.leaveQueue();

        if (result.success) {
            setMatchmakingUI(false);
            feedback(matchmakeFeedback, "", "")
        } else {
            console.log(result.message);
        }
    })
}


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

export function changeCardPage(pageId) {
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

