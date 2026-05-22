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
    static promotable = new Set(["q", "r", "b", "n"]);

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
    static defaultBoard() {
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
    //primary method
    applyMove(move) {
        const next = GameState.fromGs(this);
        const piece = next.board[move.from];
        const captured = next.board[move.to];

        if (captured) {
            next.capturedPieces[captured.color].push(captured.piece);
        }
        if (move.promotion && move.promotion !== true) {
            if (!GameState.promotable.has(move.promotion)) {
                move.promotion = "n"; //default is knight
            }
            next.board[move.to] = { color: piece.color, piece: move.promotion }
        } else {
            next.board[move.to] = piece
        }
        next.board[move.from] = null;
        //king move check
        if (piece.piece === "k") {
            next.castlingRights[piece.color].kingside = false;
            next.castlingRights[piece.color].queenside = false;
        }
        //rook move check
        if (y === 0) {          // black's back rank
            if (x === 0) {
                next.castlingRights["b"].queenside = false;
            } else if (x === 7) {
                next.castlingRights["b"].kingside = false;
            }
        } else if (y === 7) {   // white's back rank
            if (x === 0) {
                next.castlingRights["w"].queenside = false;
            } else if (x === 7) {
                next.castlingRights["w"].kingside = false;
            }
        }
        let rookMove = null;
        if (move.castle) {

            if (move.castle === "kingside") {
                rookMove = move.to === xyToI(6, 7) ? { from: xyToI(7, 7), to: xyToI(5, 7) } : { from: xyToI(7, 0), to: xyToI(5, 0) };
            } else if (move.castle === "queenside") {
                rookMove = move.to === xyToI(2, 7) ? { from: xyToI(0, 7), to: xyToI(3, 7) } : { from: xyToI(0, 0), to: xyToI(3, 0) };
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
            const capturedIndex = move.enPassant ? move.to + (piece.color === "w" ? 8 : -8) : null;
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
            move: anim
        };
    }
    setTile(i, piece) {
        let next = GameState.fromGs(this);
        next.board[i] = piece;
        return next;
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
        const board = GameState.board; //gamestate is a full instance of GameState
        const tile = board[index];
        if (!tile) {
            console.error('No piece at index', index);
            return [];
        }
        const color = tile.color;
        const opColor = color === "w" ? "b" : "w";
        const piece = tile.piece;
        let moves = {
            total: [],
            capture: [],
            exposesKing: [],
            final: [],
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
                        moves.total.push({ move: newIndex });
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
                            moves.total.push({ move: newIndex });
                            moves.noCaptures.push({ move: newIndex });
                        } else if (targetTile.color !== color) { //if opposite team
                            moves.total.push({ move: newIndex });
                            moves.capture.push({ move: newIndex });
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
            const finalRow = color === "w" ? 0 : 7
            const direction = color === "w" ? -1 : 1;

            //forward move
            const newX1 = x;
            const newY1 = y + direction;
            const newIndex1 = xyToI(newX1, newY1);
            if (inBoundsxy(newX1, newY1) && !board[newIndex1]) {
                if (newY1 == finalRow) {
                    moves.total.push({ move: newIndex1, promotion: true });
                    moves.noCaptures.push({ move: newIndex1, promotion: true });
                } else {
                    moves.total.push({ move: newIndex1 });
                    moves.noCaptures.push({ move: newIndex1 });
                }
            }

            //double move
            if (y === startingRow) {
                const newX2 = x;
                const newY2 = y + 2 * direction;
                const newIndex2 = xyToI(newX2, newY2);
                if (inBoundsxy(newX2, newY2) && !board[newIndex1] && !board[newIndex2]) {
                    moves.total.push({ move: newIndex2 });
                    moves.noCaptures.push({ move: newIndex2 });
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
                        if (newY1 == finalRow) {
                            moves.total.push({ move: newIndex, promotion: true });
                            moves.noCaptures.push({ move: newIndex, promotion: true });
                        } else {
                            moves.total.push({ move: newIndex });
                            moves.noCaptures.push({ move: newIndex });
                        }
                    } else if (newIndex === enpassantSquare && board[xyToI(newX, y)]?.color === opColor && board[xyToI(newX, y)]?.piece === "p") {
                        moves.total.push({ move: newIndex, enPassant: true });
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
                            moves.total.push({ move: xyToI(6, y), castle: "kingside" });
                            moves.noCaptures.push({ move: xyToI(6, y), castle: "kingside" });
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
                            moves.total.push({ move: xyToI(2, y), castle: "queenside" });
                            moves.noCaptures.push({ move: xyToI(2, y), castle: "queenside" });
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
    hasAnyLegalMove(gs, color) {
        for (let i = 0; i < 64; i++) {
            const tile = gs.board[i];
            if (!tile || tile.color !== color) continue;
            const moves = this.getValidMoves(gs, i);
            if (moves.final.length > 0) return true;
        }
        return false;
    }
}

function inBoundsxy(x, y) {
    return x >= 0 && x < 8 && y >= 0 && y < 8;
}
function xyToI(x, y) {
    return y * 8 + x;
}
function iToXY(i) {
    return [i % 8, Math.floor(i / 8)];
}

export { GameState, MoveValidator, xyToI, iToXY };