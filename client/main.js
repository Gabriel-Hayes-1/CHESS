import {
    uiLoggedIn, uiLoggedOut, initMatchmakingUI, changeCardPage,
    initAccountBtns, initDrawResign, win, gameStartUI, initNewTrialGame, setMatchmakingUI
} from "./ui.js";
import { Networker, Game, loadImages } from "./chessclient.js";
import { signup, login, logout, checkLoginStatus } from "./auth.js";
import { GameState } from "../shared/chess.js";

const gameCanvas = document.getElementById('board');

class App {
    constructor(canvas) {
        this.canvas = canvas;
        this.game = null;
        this.networker = new Networker();
        this._unsubListeners = []

        this.networker.on("game-start",async (data)=>this.handleGameStart(data))
        initMatchmakingUI(this.networker); //so ui knows what to call
        initNewTrialGame(()=>this.createTrialGame)
        this._imagesLoaded = loadImages()

        checkLoginStatus({
            onSuccess: (u)=>uiLoggedIn(u), //you have a cookie, logged in
            onFailure: ()=>uiLoggedOut() //no cookie not logged in
        })
        initAccountBtns(signup,login,logout)

        initDrawResign(()=>this.networker.requestDraw(),()=>this.networker.resign())

        this._imagesLoaded.then(()=>this.createTrialGame())
    }

    createTrialGame() {
        if (this.game) this.game.cleanup();
        this.game = new Game(this.canvas, null, null, true);
        this.game.GameState = GameState.defaultBoard();
        this.game.draw();

        window.__CHESS_GAME = this.game //remove in prod
    }


    async handleGameStart(data) {
        await this._imagesLoaded
        if (this.game) this.game.cleanup();

        this._unsubListeners.forEach(l=>l())
        this._unsubListeners = [];

        gameStartUI(data)

        this.game = new Game(this.canvas, (moveData)=>this.networker.move(moveData))
        window.__CHESS_GAME = this.game; //remove in prod
        this.game.loadFromData(data);

        this._unsubListeners.push(this.networker.on('game-state',(data)=>this.game.handleStateUpdate(data)))
        this._unsubListeners.push(this.networker.on('player-move',(data=>this.game.handlePlayerMove(data))))
        this._unsubListeners.push(this.networker.on('game-over',(data)=>{
            console.log(data)
            win(data.winner,data.result)
        }))

        setMatchmakingUI(false)
        changeCardPage("in-game");
        this.game.draw()


    }
}
const app = new App(gameCanvas)
window.app = app // remove in prod, for debugging