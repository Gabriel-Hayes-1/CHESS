import { GameState,MoveValidator } from "../shared/chess.js";


export default class GameManager {
    constructor(io) {
        this.io = io;
        this.games = new Map(); //gid -> Game
        this.playerGame = new Map(); //pid -> gid
        this.validator = new MoveValidator();
    }

    createGame(p1,p2) {
        const gid = crypto.randomUUID();
        if (Math.random() < 0.5) [p1,p2] = [p2,p1]; //randomly swap players

        const game = new Game(p1,p2,gid,this.io,this.validator);
        this.games.set(gid, game);
        this.playerGame.set(p1.id, gid);
        this.playerGame.set(p2.id, gid);
        return game;
    }

    removeGame(gid) {
        const game = this.games.get(gid);
        if (!game) return;
        this.games.delete(gid);
        this.playerGame.delete(game.players[0].id);
        this.playerGame.delete(game.players[1].id);
    }

    getGame(gid) {
        return this.games.get(gid) ?? null;
    }

    getGameByPlayer(pid) {
        return this.getGame(this.playerGame.get(pid))??null;
    }

    playerIndex(gid, pid) {
        const game = this.games.get(gid);
        if (game) {
            return game.player.getIndex(p => p.id === pid);
        }
        return -1;
    }
   
}


class Game {   
    constructor(p1,p2,id,io,validator) {
        this.gid = id;
        this.io = io;
        this.gs = GameState.defaultBoard();
        this.validator = validator;
        this.over = false;
        
        // {socket, username, game, accountId}
        this.players = [p1, p2];
        

        this.clocks = {w:600,b:600}; // can change to game values (20 min, 5 min etc)
        this.increment = 0 //for things like 2+1: adds this many seconds when a turn is complete
        this.activeClock = null;
        this.lastTickTime = null

        this.sockets = new socketManager(this, io);
        this.sockets.addSocketsToRoom();
        this.sockets.emitGameStart();
        this.sockets.emitGameState();
        this.sockets.initListeners();

        this.startClock("w")
    }

    colorOf(pid) {
        return this.players[0].socket.id === pid ? "w" : "b";
    }

    startClock(color) {
        this.lastTickTime = performance.now();
        this.activeClock = setInterval(()=>{
            const now = performance.now();
            const elapsed = (now - this.lastTickTime)/1000;
            this.lastTickTime = now

            this.clocks[color] -= elapsed;
            if (this.clocks[color] <= 0) {
                this.clocks[color] = 0;
                this.end("timeout", color === "w" ? "b" : "w")
            }
        },100)
    }

    stopClock() {
        clearInterval(this.activeClock);
        this.activeClock = null;
    }

    applyMove(pid,move) {
        const movingColor = this.gs.turn;
        if (this.over) return {ok:false, error:"game over"};
        if (this.colorOf(pid) !== movingColor) return {ok:false, error:"not your turn"};

        const piece = this.gs.getTile(move.from);
        if (!piece || piece.color !== movingColor) return {ok:false, error:"invalid piece"};

        const legal = this.validator.getValidMoves(this.gs, move.from);
        const isLegal = legal.final.some(
            m => m.move === move.to && !!m.castle === !!move.castle && 
            !!m.enPassant === !!move.enPassant && !!move.promotion === !!m.promotion
        )
        if (!isLegal) return { ok: false, error: "illegal_move" };

        
        const {state:nextGs, move:outgoingMove} = this.gs.applyMove(move);
        this.gs = nextGs;

        this.stopClock();
        this.clocks[movingColor] += this.increment;

        this.sockets.emitMove(outgoingMove);
        this.sockets.emitGameState();

        const opponent = this.gs.turn;
        const hasLegalMoves = this.validator.hasAnyLegalMove(this.gs, opponent);
        if (!hasLegalMoves) {
            const inCheck = this.validator.isInCheck(this.gs, opponent);
            this.end(
                inCheck ? "checkmate" : "stalemate",
                inCheck ? this.colorOf(pid) : "draw"
            )
        }

        if (!this.over) {
            this.startClock(this.gs.turn);
        }

        return {ok:true};
    }
    end(result,winner) {
        this.over = true;
        this.stopClock();
        this.sockets.emitGameOver({result, winner});
    }
    getGameState() { //this ends up going to chessclient.js game.handleStateUpdate
        return {
            ...this.gs,
            clocks:this.clocks
        }
    }
}
class socketManager {
    constructor(game, io) {
        this.io = io;
        this.game = game;
        this.room = game.gid;

        this._listeners = [];
    }

    
    addListener(socket,event,handler) {
        socket.on(event, handler);
        this._listeners.push({socket,event,handler});
    }
    initListeners() {
        const p1 = this.game.players[0].socket;
        const p2 = this.game.players[1].socket;

        const onmove = (pid) => (move, callback) => {
            if (typeof callback !== "function") return; //ignore if no callback provided
            if (!move || typeof move != "object") {
                callback({ok:false, error:"invalid move format"});
                return;
            }
            try {
                const result = this.game.applyMove(pid, move);
                callback(result);
            } catch (e) {
                console.error("Error applying move:", e);
                callback({ok:false, error:"internal server error"});
            }
        }
        this.addListener(p1, "player-move", onmove(p1.id));
        this.addListener(p2, "player-move", onmove(p2.id));

        const onDisconnect = (pid) => () => {
            if (this.game.over) return;
            this.game.over = true;
            this.emitGameOver({
                result: "abandonment",
                winner: this.game.colorOf(pid) === "w" ? "b" : "w"
            });
        }
        this.addListener(p1, "disconnect", onDisconnect(p1.id));
        this.addListener(p2, "disconnect", onDisconnect(p2.id));

        const onResign = (pid) => () => {
            if (this.game.over) return;
            this.game.end("resignation", this.game.colorOf(pid) === "w" ? "b" : "w");
        }
        this.addListener(p1, "resign", onResign(p1.id));
        this.addListener(p2, "resign", onResign(p2.id));
    }
    removeListeners() {
        for (const {socket,event,handler} of this._listeners) {
            socket.off(event, handler);
        }
        this._listeners = [];
    }



    addSocketsToRoom() {
        this.game.players[0].socket.join(this.room);
        this.game.players[1].socket.join(this.room);
    }
    emitGameStart() {
        const [p1, p2] = this.game.players;
        const state = this.game.getGameState()

        p1.socket.emit("game-start", {
            team: "w",
            me: { username: p1.username },
            opponent: { username: p2.username },
            ...state

        });
        p2.socket.emit("game-start", {
            team: "b",
            me: { username: p2.username },
            opponent: { username: p1.username },
            ...state
        });
    }
    emitGameOver(result) {
        this.io.to(this.room).emit("game-over", result);
    }
    emitGameState() {
        this.io.to(this.room).emit("game-state", this.game.getGameState());
    }
    emitMove(move) {
        this.io.to(this.room).emit('player-move', move);
    }
}


