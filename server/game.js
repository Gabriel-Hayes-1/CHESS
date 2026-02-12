
class GameManager {
    constructor() {
        this.games = {};
    }
    addGame(pid1, pid2) {
        let game = new Game()
        const id = crypto.randomUUID();
        this.games[id] = {game,p1:pid1,p2:pid2}
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
    
    constructor(p1,p2) {
        this.gameState = new Array(64);
        this.players = [p1,p2];
        this.turn = 0;
        this.moveCount=0;
        this.validator = new moveValidator(this);
    }
    isOccupied(i) {
        return this.gameState[i]!=null;
    }
    move(pid, move, gameState = this.gameState) {
        let nessesaryTurn = this.players.indexOf(pid);
        if (pid>=0) {
            if (this.turn==nessesaryTurn) {
                this.#move(move, gameState);
            }
        }
    }
    #move(move, gameState) {
        this.moveCount++;
        this.turn = (this.turn+1)%2;
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

module.exports = GameManager