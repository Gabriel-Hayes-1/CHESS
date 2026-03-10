const gameCanvas = document.getElementById('board');
const startPos = [
        "br","bn","bb","bq","bk","bb","bn","br",
        "bp","bp","bp","bp","bp","bp","bp","bp",
        null,null,null,null,null,null,null,null,
        null,null,null,null,null,null,null,null,
        null,null,null,null,null,null,null,null,
        null,null,null,null,null,null,null,null,
        "wp","wp","wp","wp","wp","wp","wp","wp",
        "wr","wn","wb","wq","wk","wb","wn","wr"
    ]

function xyToI(x, y) {
    return y * 8 + x;
}
function iToXY(i) {
    return [i % 8, Math.floor(i / 8)];
}
function inBounds(i) {
    return i >= 0 && i < 64;
}
function inBoundsxy(x, y) {
    return x >= 0 && x < 8 && y >= 0 && y < 8;
}

function strGameStatetoObj(gameState) {
    return gameState.map(tileStr => {
        if (tileStr) {
            const color = tileStr[0];
            const piece = tileStr[1];
            return { color, piece };
        }
        return null;
    })
}

class Game {
    constructor(canvas, team) {
        this.team = team;

        this.allowMoves = true;
        this.validMoves = {final:[],capture:[],exposesKing:[],total:[],noCaptures:[]};

        this.doDraw = true;
        if (canvas) {
            this.canvas = canvas;
        } else {
            throw new Error("Canvas not found");
        }

        this.heldPiece = null;
        this.tileSize=[0,0];
        this.selectedPiece = null; //used for clicking, held piece is used for dragging

        this.GameState = new GameState();
        this.Validator = new MoveValidator();
        this.InputHandler = new InputHandler(this, this.canvas)
        this.Renderer = new Renderer(this, this.canvas)

        this.debug = false;

        this.lastDrawTime = 0;

    }

    resetValidMoves() {
        this.validMoves = {final:[],capture:[],exposesKing:[],total:[],noCaptures:[]};
    }

    fireMouseMove(index) {
        if (index >= 0 && index < 64) {
            const piece = this.GameState.getTile(index);
            if (!this.InputHandler.mouseDown) {
                if (
                    (piece &&
                    (
                        piece.color === this.team
                        || this.team == null
                    ) && this.allowMoves
                    ) || (this.selectedPiece !== null
                        && this.validMoves.total.find(obj=>obj.move === index)
                    )
                ) {
                    this.canvas.style = "cursor: pointer;";
                } else {
                    this.canvas.style = "cursor: default;";
                }
            }
        }
    }
    fireMouseDown(index) {
        const piece = this.GameState.getTile(index);
        const isMyTeam = piece && (piece.color === this.team || this.team == null);

        // Check if this is a valid capture target before overwriting validMoves
        const isValidMove = this.validMoves.total.find(obj => obj.move === index);

        if (isMyTeam && this.allowMoves && !isValidMove) {  // <-- add !isValidMove
            let [px, py] = iToXY(index);
            [px, py] = this.teamPerspective(px, py);
            px = px * this.tileSize[0];
            py = py * this.tileSize[1];
            const dx = this.InputHandler.mousepos[0] - px;
            const dy = this.InputHandler.mousepos[1] - py;

            this.heldPiece = {
                origLocation: index,
                piece,
                offset: [dx, dy],
            };
            if (this.selectedPiece != null && !piece) {
                this.resetValidMoves();
                this.selectedPiece = null;
            }
            this.validMoves = this.Validator.getValidMoves(this.GameState, index);
            this.canvas.style = "cursor: grabbing;";
        } else if (isValidMove) {
            // We're dragging onto a capture target — keep heldPiece for mouseUp
            // but don't overwrite validMoves
            this.canvas.style = "cursor: grabbing;";
        }
    }
    fireMouseUp(index) {
        let moveFromIndex = this.heldPiece
                ? this.heldPiece.origLocation
                : null;

        if (moveFromIndex != null && index >= 0 && index < 64) {
            let move = this.validMoves.final.find(obj=>obj.move ===index)
            if (
                this.allowMoves && move && move.move!==null
            ) {
                //client thinks move is valid, send to server for validation and updating other clients
                this.selectedPiece = null;

                // for demonstration we will update local board
                // THIS IS WHERE NETWORKING CALLS GO
                //this.Renderer.slidePiece(moveFromIndex, index, this.GameState.getTile(moveFromIndex));
                this.GameState = this.GameState.applyMove({ from: moveFromIndex, to: index, promotion: null, castle: move.castle, enPassant:move.enPassant}).state;
            } else {
                let moveWithoutCheck = this.validMoves.exposesKing.find(obj=>obj.move ===index);
                if (this.allowMoves && moveWithoutCheck && moveWithoutCheck.move) {
                    //king is under attack, warn the king tile
                    const kingIndex = this.GameState.findFirstPiece(this.heldPiece.piece.color, "k"); //this.team 
                    if (kingIndex!==null) {
                        this.Renderer.warnTile(kingIndex);
                    }
                }
            }
        }
        this.heldPiece = null;
        if (this.selectedPiece == null) {
            this.resetValidMoves();
        }   
        
        if (this.allowMoves) {
            if (
                this.GameState.getTile(index) &&
                (
                    this.GameState.getTile(index).color === this.team
                    || this.team == null //
                )
            ) {
                this.canvas.style = "cursor: pointer;";
            } else {
                this.canvas.style = "cursor: default;";
            }
        }
    }

    fireClick(index) {
        const piece = this.GameState.getTile(index);
        
        if (this.selectedPiece != null) {
            let move = this.validMoves.final.find(obj => obj.move === index);
            if (move && (move.move !== null)) {
                // Make a move with a slide
                this.Renderer.slidePiece(this.selectedPiece, index, this.GameState.getTile(this.selectedPiece));
                this.GameState = this.GameState.applyMove({ from: this.selectedPiece, to: index, promotion: null, castle: move.castle, enPassant: move.enPassant }).state;
                this.resetValidMoves();
                this.selectedPiece = null;
            } else if (piece && (piece.color === this.team || this.team == null) && this.allowMoves && index !== this.selectedPiece) {
                // Re-select a different friendly piece instead of cancelling
                this.resetValidMoves();
                this.selectedPiece = index;
                this.validMoves = this.Validator.getValidMoves(this.GameState, index);
            } else {
                // Clicked empty square or same piece — deselect
                this.resetValidMoves();
                this.selectedPiece = null;
            }
        } else {
            if (piece && (piece.color === this.team || this.team == null) && this.allowMoves) {
                this.selectedPiece = index;
                this.validMoves = this.Validator.getValidMoves(this.GameState, index);
            }
        }
    }

    teamPerspective(x, y) {
        if (this.team === "b") {
            return [7 - x, 7 - y];
        } else {
            return [x, y];
        }
    }



    draw(doPieces = true) {
        const dt = performance.now() - this.lastDrawTime;
        this.lastDrawTime = performance.now();

        if (this.doDraw) {
            this.Renderer.clearScreen();
            this.tileSize=this.Renderer.drawTiles();
            this.Renderer.stepAnims(dt);

            if (doPieces) {
                this.Renderer.drawPieces(this.GameState.board,this.heldPiece);
                this.Renderer.drawValidMoves(this.validMoves.noCaptures,this.validMoves.capture); 
                this.Renderer.drawHeldPiece(this.heldPiece, this.InputHandler.mousepos);
            }

            if (this.debug) {
                this.Renderer.drawDebugNumbers();
            }
            
        }
        if (doPieces) {
            requestAnimationFrame(() => this.draw());
        }
    }
}

class GameState {
    constructor() {
        this.board = Array(64).fill(null);
        this.turn = "w";
        this.castlingRights = {
            w: { kingside: true, queenside: true },
            b: { kingside: true, queenside: true }
        };
        this.enPassantTarget = null;
        this.moveHistory = [];
        this.capturedPieces = {
            w: [],
            b: []
        };
    }
    //factories
    static fromBoard(board) {
        const gs = new GameState();
        gs.board = board.slice();
        return gs;
    }
    static fromGs(gs) {
        const newGs = new GameState();
        newGs.board = gs.board.slice();
        newGs.turn = gs.turn;
        newGs.castlingRights = JSON.parse(JSON.stringify(gs.castlingRights));
        newGs.enPassantTarget = gs.enPassantTarget;
        newGs.moveHistory = gs.moveHistory.slice();
        newGs.capturedPieces = {
            w: gs.capturedPieces.w.slice(),
            b: gs.capturedPieces.b.slice()
        };
        return newGs;
    }
    //primary method
    applyMove(move) {
        const next = GameState.fromGs(this);
        const piece = next.board[move.from];
        const captured = next.board[move.to];

        if (captured) {
            next.capturedPieces[captured.color].push(captured.piece);
        }
        next.board[move.to] = move.promotion ? 
            { color: piece.color, piece: move.promotion } 
            : piece;
        next.board[move.from] = null;
        //king move check
        if (piece.piece === "k") {
            next.castlingRights[piece.color].kingside = false;
            next.castlingRights[piece.color].queenside = false;
        }
        //rook move check
        if (piece.piece === "r") {
            const [x, y] = iToXY(move.from);
            if (y === 0) {
                if (x === 0) {
                    next.castlingRights["w"].queenside = false;
                } else if (x === 7) {
                    next.castlingRights["w"].kingside = false;
                }
            } else if (y === 7) {
                if (x === 0) {
                    next.castlingRights["b"].queenside = false;
                } else if (x === 7) {
                    next.castlingRights["b"].kingside = false;
                }
            }
        }
        let rookMove = null;
        if (move.castle) {
            
            if (move.castle === "kingside") {
                rookMove = move.to === xyToI(6, 7) ? {from: xyToI(7, 7), to: xyToI(5, 7)} : {from: xyToI(7, 0), to: xyToI(5, 0)};
            } else if (move.castle === "queenside") {
                rookMove = move.to === xyToI(2, 7) ? {from: xyToI(0, 7), to: xyToI(3, 7)} : {from: xyToI(0, 0), to: xyToI(3, 0)};
            }
            if (rookMove) {
                const rook = next.board[rookMove.from];
                next.board[rookMove.to] = rook;
                next.board[rookMove.from] = null;
            }
        }
        next.enPassantTarget = null;
        if (piece.piece === "p") {
            if (Math.abs(move.to - move.from) === 16) {
                next.enPassantTarget = (move.from + move.to) / 2;
            }
        }
        if (move.enPassant) {
            const capturedIndex = move.enPassant ? move.to + (color === "w" ? -8 : 8) : null;
            console.log(capturedIndex)
            if (capturedIndex !== null) {
                const capturedPawn = next.board[capturedIndex];
                if (capturedPawn) {
                    next.capturedPieces[capturedPawn.color].push(capturedPawn.piece);
                    next.board[capturedIndex] = null;
                }
            }

        }




        next.moveHistory.push(move);
        next.turn = next.turn === "w" ? "b" : "w";
        
        let anim = {
            type: "move",
            piece: piece,
            from: move.from,
            to: move.to,
        };
        if (move.castle) {
            anim.type = "castle";
            anim.rookFrom = rookMove.from;
            anim.rookTo = rookMove.to;
        }

        return {
            state: next,
            anim: anim
        };
    }
    //queries
    getTile(i) {
        return this.board[i];
    }
    isEmpty(i) {
        return this.board[i] === null;
    }
    isOccupiedBy(i, color) {
        const tile = this.board[i];
        return tile && tile.color === color;
    }
    getLastMove() {
        if (this.moveHistory.length > 0) {
            return this.moveHistory[this.moveHistory.length - 1];
        }
    }
    findFirstPiece(color, type) {
        for (let i = 0; i < 64; i++) {
            const tile = this.board[i];
            if (tile && tile.color === color && tile.piece === type) {
                return i;
            }
        }
        return null;
    }
}

class MoveValidator {
    static moveRules = {
        'k': { type: "step", dirs: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] },
        'n': { type: "step", dirs: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]] },
        'q': { type: "slide", dirs: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] },
        'b': { type: "slide", dirs: [[-1, -1], [-1, 1], [1, -1], [1, 1]] },
        "r": { type: "slide", dirs: [[-1, 0], [0, -1], [0, 1], [1, 0]] },
        "p": { type: "pawn" } //edge case
    }
    isIndexAttacked(GameState, index, attackingColor) {
        const board = GameState.board;

        const straightDirs = [[-1, 0], [0, -1], [0, 1], [1, 0]];
        const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        const [x, y] = iToXY(index);

        for (const dir of straightDirs) {
            for (let step = 1; step < 8; step++) {
                const newX = x + dir[0] * step;
                const newY = y + dir[1] * step;
                if (!inBoundsxy(newX, newY)) break;
                const pa = board[xyToI(newX, newY)]; //potential attacker
                if (!pa) continue;
                if (pa.color === attackingColor && (pa.piece === "r" || pa.piece === "q")) {
                    return true;
                }
                break; //blocked by any piece
            }
        }
        for (const dir of diagDirs) {
            for (let step = 1; step < 8; step++) {
                const newX = x + dir[0] * step;
                const newY = y + dir[1] * step;
                if (!inBoundsxy(newX, newY)) break;
                const pa = board[xyToI(newX, newY)]; //potential attacker
                if (!pa) continue;
                if (pa.color === attackingColor && (pa.piece === "b" || pa.piece === "q")) {
                    return true;
                }
                break; //blocked by any piece
            }
        }
        for (const [dx, dy] of MoveValidator.moveRules["n"].dirs) {
            const nx = x + dx, ny = y + dy;
            if (inBoundsxy(nx, ny)) {
                const pa = board[xyToI(nx, ny)];
                if (pa && pa.color === attackingColor && pa.piece === "n") {
                    return true;
                }
            }
        }
        const pawnDir = attackingColor === "w" ? 1 : -1;
        for (const dx of [-1, 1]) {
            const nx = x + dx, ny = y + pawnDir;
            if (inBoundsxy(nx, ny)) {
                const pa = board[xyToI(nx, ny)];
                if (pa && pa.color === attackingColor && pa.piece === "p") {
                    return true;
                }
            }
        }
        for (const dir of MoveValidator.moveRules["k"].dirs) {
            const nx = x + dir[0], ny = y + dir[1];
            if (inBoundsxy(nx, ny)) {
                const pa = board[xyToI(nx, ny)];
                if (pa && pa.color === attackingColor && pa.piece === "k") {
                    return true;
                }
            }
        }
        return false;
    }
    isInCheck(GameState, color) {
        const board = GameState.board;
        let kingIndex = board.findIndex(tile => tile && tile.color === color && tile.piece === "k");
        if (kingIndex === -1) { 
            //no king found, it was captured somehow, just allow moves 
            return false;
        }
        const opponentColor = color === "w" ? "b" : "w";
        return this.isIndexAttacked(GameState, kingIndex, opponentColor);
    }
    getValidMoves(GameState, index) {
        const board = GameState.board; //gamestate is a full object of gamestate
        const tile = board[index];
        if (!tile) {
            console.error('No piece at index', index);
            return [];
        }
        const color = tile.color;
        const opColor = color === "w" ? "b" : "w";
        const piece = tile.piece;
        let moves = {
            total:[],
            capture:[],
            exposesKing:[],
            final:[],
            noCaptures: []
        }


        const [x, y] = iToXY(index);

        const rules = MoveValidator.moveRules[piece];
        if (rules.type === "step") {
            for (const dir of rules.dirs) {
                const [dx, dy] = dir;
                const newX = x + dx;
                const newY = y + dy;
                if (inBoundsxy(newX, newY)) {
                    const newIndex = xyToI(newX, newY);
                    const targetTile = board[newIndex];
                    if (!targetTile || targetTile.color !== color) { //if empty or opposite team
                        moves.total.push({move:newIndex});
                        if (targetTile?.color === opColor) {
                            moves.capture.push({ move: newIndex });  // capture only
                        } else {
                            moves.noCaptures.push({ move: newIndex }); // empty only
                        }
                    }
                }
            }
        } else if (rules.type === "slide") {
            for (const dir of rules.dirs) {
                const [dx, dy] = dir;
                for (let step = 1; step < 8; step++) {
                    const newX = x + dx * step;
                    const newY = y + dy * step;
                    if (inBoundsxy(newX, newY)) {
                        const newIndex = xyToI(newX, newY);
                        const targetTile = board[newIndex];
                        if (!targetTile) {
                            moves.total.push({move:newIndex});
                            moves.noCaptures.push({move:newIndex});
                        } else if (targetTile.color !== color) { //if opposite team
                            moves.total.push({move:newIndex});
                            moves.capture.push({move:newIndex});
                            break; //can't jump over pieces
                        } else {
                            break; //can't jump over pieces
                        }
                    } else {
                        break; //out of bounds
                    }

                }
            }
        } else if (rules.type === "pawn") {
            //holy crap here we go
            const startingRow = color === "w" ? 6 : 1;
            const direction = color === "w" ? -1 : 1;

            //forward move
            const newX1 = x;
            const newY1 = y + direction;
            const newIndex1 = xyToI(newX1, newY1);
            if (inBoundsxy(newX1, newY1) && !board[newIndex1]) {
                moves.total.push({move:newIndex1});
                moves.noCaptures.push({move:newIndex1});
            }

            //double move
            if (y === startingRow) {
                const newX2 = x;
                const newY2 = y + 2 * direction;
                const newIndex2 = xyToI(newX2, newY2);
                if (inBoundsxy(newX2,newY2) && !board[newIndex1] && !board[newIndex2]) {
                    moves.total.push({move:newIndex2});
                    moves.noCaptures.push({move:newIndex2});
                }
            }

            //capture
            let enpassantSquare = GameState.enPassantTarget
            for (const dx of [-1, 1]) {
                const newX = x + dx;
                const newY = y + direction;
                const newIndex = xyToI(newX, newY);
                if (inBoundsxy(newX, newY)) {
                    const targetTile = board[newIndex];
                    if (targetTile && targetTile.color !== color) { //if opposite team
                        moves.total.push({move:newIndex});
                        moves.capture.push({move:newIndex});
                    } else if (newIndex===enpassantSquare) {
                        moves.total.push({move:newIndex,enPassant:true});
                    }
                }
            }
            



        }
        if (piece === "k") {
            //castling
            const castlingRights = GameState.castlingRights[color];
            if (castlingRights.kingside) {
                const rookIndex = xyToI(7, y);
                if (board[rookIndex] && board[rookIndex].piece === "r" && board[rookIndex].color === color) {
                    const empty1 = board[xyToI(5, y)] === null;
                    const empty2 = board[xyToI(6, y)] === null;
                    if (empty1 && empty2) {
                        //check if squares are attacked
                        const throughCheck = this.isIndexAttacked(GameState, xyToI(4, y), opColor) ||
                            this.isIndexAttacked(GameState, xyToI(5, y), opColor) ||
                            this.isIndexAttacked(GameState, xyToI(6, y), opColor);
                        if (!throughCheck) {
                            moves.total.push({move:xyToI(6, y),castle:"kingside"});
                            moves.noCaptures.push({move:xyToI(6, y),castle:"kingside"});
                        }
                    }
                }
            }
            if (castlingRights.queenside) {
                const rookIndex = xyToI(0, y);
                if (board[rookIndex] && board[rookIndex].piece === "r" && board[rookIndex].color === color) {
                    const empty1 = board[xyToI(1, y)] === null;
                    const empty2 = board[xyToI(2, y)] === null;
                    const empty3 = board[xyToI(3, y)] === null;
                    if (empty1 && empty2 && empty3) {
                        //check if squares are attacked
                        const throughCheck = this.isIndexAttacked(GameState, xyToI(4, y), opColor) ||
                            this.isIndexAttacked(GameState, xyToI(3, y), opColor) ||
                            this.isIndexAttacked(GameState, xyToI(2, y), opColor);
                        if (!throughCheck) {
                            moves.total.push({move:xyToI(2, y),castle:"queenside"});
                            moves.noCaptures.push({move:xyToI(2, y),castle:"queenside"});
                        }
                    }
                }
            }
        }

        const isLegal = (moveTo) => {
            const newGameState = GameState.applyMove({ from: index, to: moveTo.move }).state;
            return !this.isInCheck(newGameState, color);
        };

        let tempMoves = Object.fromEntries(
            Object.keys(moves).map(key => [key, []])
        );

        for (const moveTo of moves.total) {
            const legal = isLegal(moveTo);
            const isCapture = board[moveTo.move]?.color === opColor;

            if (legal) {
                tempMoves.final.push(moveTo);
                if (isCapture) tempMoves.capture.push(moveTo);
                else tempMoves.noCaptures.push(moveTo);
            } else {
                tempMoves.exposesKing.push(moveTo);
            }
        }
        tempMoves.total = moves.total;
        moves = tempMoves;
        

        return moves;
       
    }
}

class Renderer {
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;

        this.animations = [];
        

        this.dpr = window.devicePixelRatio || 1;
        this.w = canvas.width / this.dpr;
        this.h = canvas.height / this.dpr;

        //attempt to make a context
        if (this.canvas.getContext) {
            this.ctx = this.canvas.getContext('2d');
        } else {
            throw new Error("Please make sure Canvas is supported and not blocked by an extension");
        }
    }
    resizeCanvas() {
        const newDpr = window.devicePixelRatio || 1;
        const r = this.canvas.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return; // canvas is hidden, skip
        const w = r.width * newDpr;
        const h = r.height * newDpr;

        if (this.canvas.width !== w || this.canvas.height !== h || this.dpr !== newDpr) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.dpr = newDpr;
            this.w = this.canvas.width / this.dpr;
            this.h = this.canvas.height / this.dpr;

            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(this.dpr, this.dpr);
        }
    }
    clearScreen() {
        this.resizeCanvas();
        this.ctx.clearRect(0, 0, this.w, this.h);
    }
    drawTiles() {
        let w = this.w / 8;
        let h = this.h / 8;
        for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
                let c = color[(i + j) % 2];
                this.ctx.fillStyle = c;
                this.ctx.fillRect(i * w, j * h, w, h);
            }
        }
        return [this.w / 8, this.h / 8];
    }
    drawPieces(gameState,heldPiece) {
        let w = this.w / 8;
        let h = this.h / 8;
        for (let i = 0; i < 8; i++) { 
            for (let j = 0; j < 8; j++) { 
                const index = i * 8 + j;

                let skip = false;
                for (const anim of this.animations) {
                    if (anim.type === "move") {
                        if (anim.from === index || anim.to === index) {
                            skip = true;
                        }
                    }
                }

                if (!skip){
                    const tile = gameState[index]; 
                    const [drawX, drawY] = this.game.teamPerspective(j, i); 
                    if (heldPiece == null || heldPiece.origLocation != index) { 
                        if (tile) {
                            this.ctx.drawImage(IMAGES[tile.color + tile.piece], drawX * w, drawY * h, w, h)
                        }
                    }
                }
            }
        }
    }
    drawValidMoves(noCaptures, captures) {
        let w = this.w / 8;
        let h = this.h / 8;
        const dotColor = findAverageofTwoHex(color[0], color[1])
        for (let spot of noCaptures) {
            spot = spot.move;
            //draw a dot at each
            const [x, y] = this.game.teamPerspective(...iToXY(spot));
            this.ctx.fillStyle = `rgba(${dotColor[0]}, ${dotColor[1]}, ${dotColor[2]}, 0.5)`;
            this.ctx.beginPath();
            this.ctx.arc(x * w + w / 2, y * h + h / 2, Math.min(w, h) / 4, 0, 2 * Math.PI);
            this.ctx.fill();
        }
        for (let spot of captures) {
            spot = spot.move;
            //draw a outlined circle at each
            const [x, y] = this.game.teamPerspective(...iToXY(spot));
            this.ctx.strokeStyle = `rgba(${dotColor[0]}, ${dotColor[1]}, ${dotColor[2]}, 0.4)`;
            let lw = 6;
            this.ctx.lineWidth = lw
            this.ctx.beginPath();
            this.ctx.arc(x * w + w / 2, y * h + h / 2, Math.min(w, h)/2-lw/2, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
    }
    drawHeldPiece(heldPiece, mousepos){ 
        let w = this.w / 8;
        let h = this.h / 8;
        if (heldPiece) {
            const offset = heldPiece.offset
            this.ctx.drawImage(IMAGES[heldPiece.piece.color + heldPiece.piece.piece],
                mousepos[0] - w/2, mousepos[1] - h/2, w, h
            )
        }
    }
    drawDebugNumbers() {
        let w = this.w / 8;
        let h = this.h / 8;
        this.ctx.fillStyle = "rgba(255,0,0,0.5)";
        this.ctx.font = `${Math.min(w, h) / 2}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        for (let i = 0; i < 64; i++) {
            const [x, y] = iToXY(i);
            const [drawX, drawY] = this.game.teamPerspective(x, y);
            this.ctx.fillText(i, drawX * w + w / 2, drawY * h + h / 2);
        }
    }
    warnTile(index) {
        this.animations.push({
            type: "tileFlash",
            index: index,
            t: 0,
            duration: 1, //seconds
        })
    }
    slidePiece(from, to, piece) {
        const [fromX, fromY] = iToXY(from);
        const [toX, toY] = iToXY(to);
        const distance = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
        let totalDuration = 0.1 + 0.05 * distance; // base time + time per square
        totalDuration = Math.min(totalDuration, 0.4); // cap max duration for long moves
        this.animations.push({
            type: "move",
            piece: piece,
            from: from,
            to: to,
            t: 0,
            duration: totalDuration, 
        })
    }
    stepAnims(dt) {
        let w = this.w / 8;
        let h = this.h / 8;
        for (const anim of this.animations) {
            if (anim.t > anim.duration) {
                this.animations.splice(this.animations.indexOf(anim), 1);
            }

            if (anim.type=="tileFlash") {
                //flash tile red and back to normal over duration
                const progress = anim.t / anim.duration;
                const flashIntensity = Math.abs(Math.sin(progress * Math.PI*2)); //sinusoidal flash
                const [x, y] = iToXY(anim.index);
                const [drawX, drawY] = this.game.teamPerspective(x, y);
                this.ctx.fillStyle = `rgba(255, 0, 0, ${flashIntensity * 0.7})`;
                this.ctx.fillRect(drawX * w, drawY * h, w, h);
            }
            if (anim.type === "move") {
                const [fromX, fromY] = iToXY(anim.from);
                const [toX, toY] = iToXY(anim.to);
                
                //make duration based on distance
                const progress = Math.min(anim.t / anim.duration, 1);
                
                const [drawFromX, drawFromY] = this.game.teamPerspective(fromX, fromY);
                const [drawToX, drawToY] = this.game.teamPerspective(toX, toY);
                const currentX = drawFromX * w + (drawToX - drawFromX) * progress * w;
                const currentY = drawFromY * h + (drawToY - drawFromY) * progress * h;
                this.ctx.drawImage(IMAGES[anim.piece.color + anim.piece.piece], currentX, currentY, w, h);
            }


            anim.t = (anim.t || 0) + (dt || 16) / 1000;
        }
    }

}

class InputHandler {
    static screenToCanvas=(e,r)=>[e.clientX-r.left,e.clientY-r.top]
    static getIndex(mouseEvent, rect) {
        const [x, y] = InputHandler.screenToCanvas(mouseEvent, rect)
        return xyToI(Math.floor((x / rect.width) * 8), Math.floor((y / rect.height) * 8));
    }

    
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;
        this.mousepos = null;
        this.downPos = null;
        this.mouseDown = false;
        const CLICK_THRESHOLD = 5; // pixels

        const getIndex = (e) =>{
            const rect = canvas.getBoundingClientRect();
            const [x, y] = this.game.teamPerspective(
                ...iToXY(InputHandler.getIndex(e, rect))
            );
            return {i:xyToI(x, y),rect};
        }
        

        canvas.addEventListener("mousemove", (e) => {
            const {i,rect} = getIndex(e);
            this.mousepos = InputHandler.screenToCanvas(e, rect);

            game.fireMouseMove(i);
        });

        this.canvas.addEventListener("mousedown", (e) => {
            this.mouseDown = true;
            const {i,rect} = getIndex(e);
            this.downPos = InputHandler.screenToCanvas(e, rect);

            game.fireMouseDown(i,this.w /8);
        }); 

        this.canvas.addEventListener("mouseup", (e) => {
            this.mouseDown = false;
            const {i,rect} = getIndex(e);
            let upPos = InputHandler.screenToCanvas(e, rect);

            game.fireMouseUp(i);
            //distance from upPos and downPos 
            const dx = upPos[0] - this.downPos[0];
            const dy = upPos[1] - this.downPos[1];
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < CLICK_THRESHOLD) {
                game.fireClick(i);
            } 



        });
    }
}

const IMAGES = {}
function loadImages() {
    const paths = ["wp", "wr", "wn", "wb", "wq", "wk", "bp", "br", "bn", "bb", "bq", "bk"];
    const promises = paths.map(path => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = reject;
        img.src = `assets/pieces/${path}.svg`;
        IMAGES[path] = img;
    }));
    return Promise.all(promises);
}

async function init() {
    await Promise.all([
        loadImages()
    ])
    const game = new Game(gameCanvas, null);
    game.GameState = GameState.fromBoard(strGameStatetoObj(startPos));
    game.draw();
    window.__CHESS_GAME = game;
}
init();