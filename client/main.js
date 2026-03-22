import { Networker, Game, init } from "./chessclient.js";
import { signup, login, logout, checkLoginStatus } from "./auth.js";
import { uiLoggedIn, uiLoggedOut, initMatchmakingUI, changeCardPage} from "./ui.js";

const gameCanvas = document.getElementById('board');

class App {
    constructor(canvas) {
        this.canvas = canvas;
        this.game = null;
        this.networker = new Networker();
        this._ubsubListeners = null

        this.networker.on("game-start",(data)=>this.handleGameStart(data))
        initMatchmakingUI(this.networker); //so ui knows what to call
        init();

        checkLoginStatus({
            onSuccess: (u)=>uiLoggedIn(u), //you have a cookie, logged in
            onFailure: ()=>uiLoggedOut() //no cookie not logged in
        })
    }


    handleGameStart(data) {
        if (this.game) {
            this.game.cleanup()
        }
        this._ubsubListeners?.()

        this.game = new Game(this.canvas)
        this.game.loadFromData(data);

        this._ubsubListeners = this.networker.on('game-state',(data)=>this.game.handleStateUpdate(data))

        changeCardPage("in-game");
        this.game.draw()


    }
}
const app = new App(gameCanvas)