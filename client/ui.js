function qs(selector) {
    return document.querySelector(selector);
}
const sidebar = qs('#sidebar');
const container = qs('#page-content-container');
const boardColorSelect = qs('#theme-select');
const sidebarToggle = qs('#sidebar-toggle'); 

import { updateSetting, settings, options } from "./settings.js";





sidebarToggle.addEventListener("mousedown",(e)=>{

})

let authResolved = false;
let queuedPage = null;
function switchPage(page) {
    sessionStorage.setItem("lastPage", page);

    if (!authResolved && page === "account") {
        queuedPage = "account"
        return;
    }
    
    const pages = container.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));

    const target = document.getElementById(page);
    if (target && target.classList.contains('page')) {
        target.classList.add('active');
    }
}
switchPage(sessionStorage.getItem("lastPage") || "play");

function onAuthResolved() {
    authResolved = true;
    let targetPage = queuedPage || sessionStorage.getItem("lastPage") || "play";
    queuedPage = null;
    switchPage(targetPage)
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

const colorDropdown = qs("#theme-dropdown");
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

const signupBtn = qs("#signup");
const loginBtn = qs("#login");
const logoutBtn = qs("#logout");
const userNameInput = qs("#usernameInput");
const passwordInput = qs("#passwordInput");
const passwordConfirmInput = qs("#passwordInputConfirm");
const loginFeedback = qs("#login-feedback");
const logoutFeedback = qs("#logout-feedback");
const logInSetting = qs("#login-setting");
const logOutSetting = qs("#logout-setting");
const loginStatus = qs("#loginStatus");

export function uiLoggedIn(username) {
    logInSetting.classList.add("hidden");
    logOutSetting.classList.remove("hidden");
    loginStatus.textContent = "Logged in as "+username;
    feedback(loginFeedback,"","");
    userNameInput.value = '';
    passwordInput.value = '';
    passwordConfirmInput.value = '';
    onAuthResolved();
}
export function uiLoggedOut() {
    logInSetting.classList.remove("hidden");
    logOutSetting.classList.add("hidden");
    loginStatus.textContent = "You are not logged in.";
    onAuthResolved();
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

export function initAccountBtns(signup, login, logout) {
    signupBtn.addEventListener("click", async () => {
        const username = userNameInput.value.trim();
        const password = passwordInput.value;
        const passwordConfirm = passwordConfirmInput.value;

        if (!username || !password) {
            feedback(loginFeedback, "warning", "Username and password are required");
        } else if (password !== passwordConfirm) {
            feedback(loginFeedback, "warning", "Passwords do not match");
        } else {
            const result = await signup(username, password);
            if (result.success) {
                uiLoggedIn(username);

            } else {
                feedback(loginFeedback, "warning", result.message || "Signup failed");
            }
        }
    });
    loginBtn.addEventListener("click", async () => {
        const username = userNameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            feedback(loginFeedback, "warning", "Username and password are required");
            return
        }
        const result = await login(username, password);
        if (result.success) {
            uiLoggedIn(username);
        } else {
            feedback(loginFeedback, "warning", result.message)
        }
    })
    logoutBtn.addEventListener("click", async () => {
        const result = await logout();
        if (result.success) {
            uiLoggedOut();
        } else {
            feedback(logoutFeedback, "warning", result.message || "Logout failed");
        }
    })
}



const requestGameBtn = document.getElementById("find-game");
const cancelGameBtn = document.getElementById("cancel-find-game");
const matchmakeFeedback = document.getElementById("matchmaking-feedback");
const newSameGame = qs("#new-same-game");
const backLobby = qs("#back-lobby");
const cancelSameGame = qs("#cancel-same-game");
export function initMatchmakingUI(networker) {
    if (!networker) {
        throw new Error("Networker instance is required to initialize matchmaking UI");
    }
    requestGameBtn.addEventListener("click", async () => {
        const result = await networker.joinQueue();

        if (result.success) {
            setMatchmakingUI(true)
            feedback(matchmakeFeedback, "", "Waiting for game<span class='dots'></span>");
        } else {
            feedback(matchmakeFeedback, "warning", result.message || "Failed to start matchmaking");
        }
    });
    cancelGameBtn.addEventListener("click", async () => {
        const result = await networker.leaveQueue();

        if (result.success) {
            setMatchmakingUI(false);
            feedback(matchmakeFeedback, "", "")
        } else {
            console.log(result.message);
        }
    })
    newSameGame.addEventListener("click", async ()=>{
        
        const result = await networker.joinQueue();

        if (result.success) {
            hide(newSameGame);
            show(cancelSameGame);
        } else {
            console.log(result.message);
            //maybe do something?   
        }
    })
    cancelSameGame.addEventListener("click", async ()=>{
        

        const result = await networker.leaveQueue();
        
        if (result.success) {
            hide(cancelSameGame);
            show(newSameGame);
        } else {
            console.log(result.message);
        }
    })
}

export function initNewTrialGame(newTrialGameFn) {
    backLobby.addEventListener("click", (e) => {
        newTrialGameFn();
        changeCardPage("not-in-game");

    })
}



export function setMatchmakingUI(setState) {
    if (setState) {
        cancelGameBtn.classList.remove("hidden");
        requestGameBtn.classList.add("hidden");
    } else {
        cancelGameBtn.classList.add("hidden");
        requestGameBtn.classList.remove("hidden");
        feedback(matchmakeFeedback, "", "")
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

function hide(elem) {elem.classList.add("hidden")}
function show(elem) {elem.classList.remove("hidden")}

const resign = qs('#resign');
const draw = qs('#offer-draw');
const actionConfirmLabel = qs('#action-confirm-label')
const actionConfirm = qs('#action-confirm')
const actionCancel = qs('#action-cancel')
function setConfirm(confirmState) {
    if (confirmState) {
        hide(resign)
        hide(draw)
        show(actionConfirm)
        show(actionCancel)
    } else {
        show(resign)
        show(draw)
        hide(actionConfirm)
        hide(actionCancel)
    }
}
export function initDrawResign(drawFn, resignFn) {
    let confirmAction = null
    resign.addEventListener('click', (e) => {
        setConfirm(true)
        confirmAction = resignFn
        actionConfirm.textContent = "Resign"
        actionConfirm.classList.add("danger")
        actionConfirmLabel.textContent = "Resign from this game?"
        show(actionConfirmLabel)
    })
    draw.addEventListener('click', (e) => {
        setConfirm(true);
        confirmAction = drawFn
        actionConfirm.textContent = "Offer Draw"
        actionConfirm.classList.remove("danger")
        actionConfirmLabel.textContent = "Offer draw?"
        show(actionConfirmLabel)
    })
    actionCancel.addEventListener('click', () => {
        setConfirm(false)
        hide(actionConfirmLabel)
    })
    actionConfirm.addEventListener('click', () => {
        setConfirm(false)
        hide(actionConfirmLabel)
        confirmAction();
    })
}

const gameOver = qs('#gameover')
const winnerDisplay = qs('#game-winner')
const reasonDisplay = qs('#game-win-reason')
const gameEndActions = qs('#game-end-actions');
export function win(result, reason) {
    [resign,draw,actionCancel,actionConfirm].forEach((e)=>hide(e))
    show(gameOver)

    reasonDisplay.innerText = reason;

    stopClock();
    gameEndActions.classList.remove('hidden');
    
    if (result==='b') {
        winnerDisplay.innerText = "Black wins" 
    } else if (result==='w') {
        winnerDisplay.innerText = "White wins"
    } else if (result==="draw") {
        winnerDisplay.innerText = "Draw"
    } else {
        console.error("Unknown game outcome: "+result)
    }
}

const opUser = qs('#opponent-username');
const selfUser = qs('#self-username')
export function gameStartUI(data) {
    opUser.textContent = data.opponent.username;
    selfUser.textContent = data.me.username;

    //hide the win stuff
    [gameOver,gameEndActions].forEach(e=>hide(e));

    //show drawResign
    [resign,draw].forEach(e=>show(e))
}

const promotions = {
    q: qs('#promotion-queen'),
    r: qs('#promotion-rook'),
    b: qs('#promotion-bishop'),
    n: qs('#promotion-knight')
}
const promotionOverlay = qs('#promotion-select')
export async function loadPromotionImages(color) {
    const loadPromises = Object.entries(promotions).map(([piece, button]) => {
        return new Promise(resolve => {
            button.onload = resolve;
            button.src = "/assets/pieces/" + color + piece + ".svg";
        });
    });
    await Promise.all(loadPromises);
}
export function promptPromotion(color, coords, tileSize) {
    return new Promise(async resolve => {
        if (Object.values(promotions).some(e => e.src === window.location.href)) {
            console.log("images not loaded, loading")
            await loadPromotionImages(color)
        }

        const board = document.querySelector("#board");
        const boardW = board.offsetWidth;
        const boardH = board.offsetHeight;
        const overlayW = promotionOverlay.offsetWidth;
        const overlayH = promotionOverlay.offsetHeight;

        let left = coords[0] - overlayW / 2;
        let top = coords[1] + tileSize[1]/2; //coords is centered so align to top again

        left = Math.max(0, Math.min(left, boardW - overlayW));
        top = Math.max(0, Math.min(top, boardH - overlayH));

        promotionOverlay.style.left = `${left}px`;
        promotionOverlay.style.top = `${top}px`;

        promotionOverlay.classList.remove('transparent');

        const ac = new AbortController();
        for (const [piece, button] of Object.entries(promotions)) {
            button.addEventListener("mousedown", (e) => {
                ac.abort();
                promotionOverlay.classList.add('transparent');
                resolve(piece);
            }, { signal: ac.signal });
        }
    });
}

function formatTime(seconds) {
    if (seconds < 60) {
        return seconds.toFixed(1);
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

let clockTicker = null;
let lastTickTime = null;
const selfClock = document.querySelector('#self-clock');
const opponentClock = document.querySelector('#opponent-clock');
export function setTimer(myColor, team, times) {
    let bClock,wClock
    if (myColor==="w") {
        wClock = selfClock
        bClock = opponentClock
    } else {
        bClock = selfClock
        wClock = opponentClock
    }
    wClock.textContent = formatTime(times["w"]);
    bClock.textContent = formatTime(times["b"]);
    if (team==="b") {
        bClock.classList.add("active");
        wClock.classList.remove("active");
    } else {
        wClock.classList.add("active");
        bClock.classList.remove("active");
    }
    let remaining = {w: times["w"], b: times["b"]}
    lastTickTime = performance.now();
    clearInterval(clockTicker);
    clockTicker = setInterval(()=>{
        const now = performance.now();
        const elapsed = (now - lastTickTime)/1000;
        lastTickTime = now;
        remaining[team] -= elapsed;
        
        if (team === "w") {
            wClock.textContent = formatTime(Math.max(0,remaining["w"]));
        } else {
            bClock.textContent = formatTime(Math.max(0, remaining["b"]));
        }
    },100) 
}
function stopClock() {
    clearInterval(clockTicker);
    clockTicker=null;
    selfClock.classList.remove("active");
    opponentClock.classList.remove("active");
}






