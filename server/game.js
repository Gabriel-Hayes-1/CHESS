import { GameState,MoveValidator } from "../shared/chess.js";


export class GameManager {
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

    handleMove(gid,pid,move) { //entry point for handling moves
        const game = this.games.get(gid);
        if (!game) return {ok:false, error:"game not found"};
        const playerIndex = this.playerIndex(gid, pid);
        if (playerIndex === -1) return {ok:false, error:"player not in game"};
        return game.applyMove(pid, move);
    }
   
}


class Game {   
    constructor(p1,p2,id,io,validator) {
        this.gid = id;
        this.io = io;
        this.gs = initBoard();
        this.validator = validator;
        this.players = [p1,p2];
        this.over = false;

        this.sockets = new socketManager(this, io);
        this.sockets.addSocketsToRoom();
        this.sockets.emitGameStart();
        this.sockets.emitGameState();
    }

    colorOf(pid) {
        return this.players[0].id === pid ? "w" : "b";
    }

    applyMove(pid,move) {
        if (this.over) return {ok:false, error:"game over"};
        if (this.colorOf(pid) !== this.gs.turn) return {ok:false, error:"not your turn"};

        const piece = this.gs.getTile(move.from);
        if (!piece || piece.color !== this.gs.turn) return {ok:false, error:"invalid piece"};

        const legal = this.validator.getValidMoves(this.gs, move.from);
        const isLegal = legal.final.some(
            m => m.move === move.to && !!m.castle === !!move.castle && !!m.enPassant === !!move.enPassant
        )
        if (!isLegal) return { ok: false, error: "illegal_move" };

        const {state:nextGs, move:outgoingMove} = this.gs.applyMove(move);
        this.gs = nextGs;


        this.sockets.emitMove(outgoingMove);
        this.sockets.emitGameState();

        const opponent = this.gs.turn;
        const hasLegalMoves = this.validator.hasAnyMoves(this.gs, opponent);
        if (!hasLegalMoves) {
            const inCheck = this.validator.isInCheck(this.gs, opponent);
            this.over = true;
            this.sockets.emitGameOver({
                result: inCheck ? "checkmate" : "stalemate",
                winner: inCheck ? this.colorOf(pid) : null
            });
        }

        return {ok:true};
    }
    getGameState() {
        return {
            board: this.gs.board,
            turn: this.gs.turn,
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
        const [p1, p2] = this.game.players;

        const onmove = (pid) => (move, callback) => {
            console.log("Received move from player ", pid, ": ", move);
            const result = this.game.applyMove(pid, move);
            callback(result);
        }
        this.addListener(p1.socket, "player-move", onmove(p1.id));
        this.addListener(p2.socket, "player-move", onmove(p2.id));

        const onDisconnect = (pid) => () => {
            if (this.game.over) return;
            this.game.over = true;
            this.emitGameOver({
                result: "abandon",
                winner: this.game.colorOf(pid) === "w" ? "b" : "w"
            });
        }
        this.addListener(p1.socket, "disconnect", onDisconnect(p1.id));
        this.addListener(p2.socket, "disconnect", onDisconnect(p2.id));

        const onResign = (pid) => () => {
            if (this.game.over) return;
            this.game.over = true;
            this.emitGameOver({
                result: "resign",
                winner: this.game.colorOf(pid) === "w" ? "b" : "w"
            });
        }
        this.addListener(p1.socket, "resign", onResign(p1.id));
        this.addListener(p2.socket, "resign", onResign(p2.id));
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
        p1.socket.emit("game-start", {
            team: "w",
            me: { username: p1.username },
            opponent: { username: p2.username },
        });
        p2.socket.emit("game-start", {
            team: "b",
            me: { username: p2.username },
            opponent: { username: p1.username },
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

function initBoard() {
    const gs = new GameState();
    const backRank = ["r", "n", "b", "q", "k", "b", "n", "r"];

    for (let x = 0; x < 8; x++) {
        gs.board[x] = { color: "b", piece: backRank[x] };  
        gs.board[8 + x] = { color: "b", piece: "p" };
        gs.board[48 + x] = { color: "w", piece: "p" };
        gs.board[56 + x] = { color: "w", piece: backRank[x] };  
    }
    return gs;
}
