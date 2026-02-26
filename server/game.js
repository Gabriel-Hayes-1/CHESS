
class GameManager {
    constructor(io) {
        this.games = {};
        this.io = io;
    }
    addGame(p1, p2) {
        const id = crypto.randomUUID();
        if (Math.random() > 0.5) {
            [p1, p2] = [p1, p2];
        }
        let game = new Game(p1, p2, id, this.io);
        this.games[id] = game;
        return id;
    }
    removeGame(gid) {
        delete this.games[gid];
    }
    getGameState(gid) {
        return this.games[gid].game.getGameState();
    }
    pIndexFromId(gid, pid) {

    }
    makeMove(gid,pid,move) {
        let game = this.games[gid].game;
        game.move(pid,move)
    }
}
class Game {   
    constructor(p1,p2,id,io) {
        this.gameState = new Array(64);
        this.players = [p1,p2];


        this.turn = 0;
        this.moveCount=0;
        this.validator = new moveValidator(this);
        this.socketManager = new socketManager(this, io);
        this.gid = id;
        
        this.socketManager.addSocketsToRoom();
        this.socketManager.emitGameStart();
    }
    isOccupied(i) {
        return this.gameState[i]!=null;
    }
    getTeam(pid) {
        if (this.players[0].id === pid) {
            return 'w';
        } else {
            return 'b';
        }
    }


    

    getGameState() {
        return this.gameState.slice(); //copy
    }
}
class moveValidator {
    constructor (parent) {
        this.gameState = new Array(64);
        this.parent = parent;
    }
    validateMove(move) {

    }
    getValidMoveLocations(i) {
        //i: index of the piece we are getting the valid moves of
        const piece = this.gameState[i];
        switch (piece.type){
            case 'king':
                return this.#getValidKingMoves(i);
            case 'queen':
                return this.#getValidQueenMoves(i);
            case 'rook':
                return this.#getValidRookMoves(i);
            case 'bishop':
                return this.#getValidBishopMoves(i);
            case 'knight':
                return this.#getValidKnightMoves(i);
            case 'pawn':
                return this.#getValidPawnMoves(i);
            default:
                return [];
        }
    }
    #getValidKingMoves() {

    }
    #getValidQueenMoves() {

    }
    #getValidRookMoves() {

    }
    #getValidBishopMoves() {

    }
    #getValidKnightMoves() {

    }
    #getValidPawnMoves() {

    }
}
class socketManager {
    constructor(ownerGame, io) {
        this.io = io;
        this.game = ownerGame;
        this.socket1 = ownerGame.players[0].socket;
        this.socket2 = ownerGame.players[1].socket;
        this.room = ownerGame.gid;
    }
    _emit(eventName, data) {
        this.io.to(this.room).emit(eventName, data);
    }
    addSocketsToRoom() {
        this.socket1.join(this.room);
        this.socket2.join(this.room);
    }
    emitGameStart() {
        const gameState = this.game.getGameState();
        this.socket1.emit('game-start', {
            team: this.game.getTeam(this.game.players[0].id),
            opponent: {name:this.game.players[1].username},
            me: {username:this.game.players[0].username},
        })
        this.socket2.emit('game-start', {
            team: this.game.getTeam(this.game.players[1].id),
            opponent: {name:this.game.players[0].username},
            me: {username:this.game.players[1].username},
        })
    }
    emitGameState() {
        const gameState = this.game.getGameState();
        this.io.to(this.room).emit('game-state-update', gameState);
    }
    emitMove(move) {
        this.io.to(this.room).emit('player-move', move);
    }
}

module.exports = {GameManager}