const gameCanvas = document.getElementById('board');


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

const IMAGES = {}
for (const path of ["wp", "wr", "wn", "wb", "wq", "wk", "bp", "br", "bn", "bb", "bq", "bk"]) {
    const img = new Image();
    img.src = "assets/pieces/" + path + ".svg";
    IMAGES[path] = img;
}
const imagePromises = Object.values(IMAGES).map(img => {
    return new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
    });
});
fetch("assets/positions.json")
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to load positions.json: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        window.getPositionByName = (positionName) => {
            if (data[positionName]) {
                return strGameStatetoObj(data[positionName]);
            } else {
                throw new Error(`Position "${positionName}" not found in positions.json`);
            }
        };
        if (game) {
            game.updateGameState(window.getPositionByName("start"));
        }
    })
    .catch(err => {
        console.error("Error loading positions.json", err);
    });

class GAME {
    constructor(canvas, team) {
        this.GAMESTATE = new Array(8 * 8).fill(null);
        this.COLOR = team;

        this.allowMoves = true;
        this.VALID_MOVES = [];

        this.doDraw = true;
        if (canvas) {
            this.canvas = canvas;
        } else {
            throw new Error("Canvas not found");
        }

        this.heldPiece = null;
        this.mousepos = [0, 0];

        this.tileSize=[0,0];

        this.validator = new moveValidator();
        this.inputHandler = new inputHandler(this, this.canvas)
        this.renderer = new renderer(this, this.canvas)
    }

    fireMouseMove(index) {
        if (index >= 0 && index < 64) {
            const piece = this.GAMESTATE[index];
            if (!this.inputHandler.mouseDown) {
                if (
                    piece &&
                    (
                        piece.color === this.COLOR
                        || this.COLOR == null
                    ) && this.allowMoves
                ) {
                    this.canvas.style = "cursor: grab;";
                } else {
                    this.canvas.style = "cursor: default;";
                }
            }
        }
    }
    fireMouseDown(index) {
        const piece = this.GAMESTATE[index];
        if (piece && (piece.color === this.COLOR || this.COLOR == null) && this.allowMoves) {

            let [px, py] = iToXY(index);
            [px, py] = this.teamPerspective(px, py);
            px = px * this.tileSize[0];
            py = py * this.tileSize[1];
            const dx = this.inputHandler.mousepos[0] - px;
            const dy = this.inputHandler.mousepos[1] - py;

            this.heldPiece = {
                origLocation: index,
                piece,
                offset: [dx, dy],
            };
            this.VALID_MOVES = this.validator.getValidMoves(this.GAMESTATE, index);
            this.canvas.style = "cursor: grabbing;";
        }
    }
    fireMouseUp(index) {
        let moveFromIndex = this.heldPiece
                ? this.heldPiece.origLocation
                : null;


        if (moveFromIndex != null && index >= 0 && index < 64) {
            if (
                this.allowMoves &&
                this.VALID_MOVES.includes(index)
            ) {
                // valid move, do what you want: send update, or redraw board
                // for demonstration we will update local board
                // THIS IS WHERE NETWORKING CALLS GO

                const piece = this.GAMESTATE[moveFromIndex];
                const newGameState = this.GAMESTATE.slice();
                newGameState[index] = piece;
                newGameState[moveFromIndex] = null;
                this.updateGameState(newGameState);
            }
        }
        
        this.heldPiece = null;
        this.VALID_MOVES = [];
        if (this.allowMoves) {
            if (
                this.GAMESTATE[index] &&
                (
                    this.GAMESTATE[index].color === this.COLOR
                    || this.COLOR == null //
                )
            ) {
                this.canvas.style = "cursor: grab;";
            } else {
                this.canvas.style = "cursor: default;";
            }
        }
    }

    teamPerspective(x, y) {
        if (this.COLOR === "b") {
            return [7 - x, 7 - y];
        } else {
            return [x, y];
        }
    }



    draw(doPieces = true) {
        if (this.doDraw) {
            this.renderer.clearScreen();
            this.tileSize=this.renderer.drawTiles();

            if (doPieces) {
                this.renderer.drawPieces(this.GAMESTATE,this.heldPiece);
                this.renderer.drawValidMoves(this.VALID_MOVES);
                this.renderer.drawHeldPiece(this.heldPiece, this.inputHandler.mousepos);
            }
        }
        if (doPieces) {
            requestAnimationFrame(() => this.draw());
        }
    }
    updateGameState(newGameState) {
        if (newGameState.length === 64) {
            this.GAMESTATE = newGameState.slice();
        }
    }
    movePiece(oldI, newI) {
        if (inBounds(oldI) && inBounds(newI)) {
            const piece = this.GAMESTATE[oldI];
            if (piece) {
                const newGameState = this.GAMESTATE.slice();
                newGameState[newI] = piece;
                newGameState[oldI] = null;
                this.updateGameState(newGameState);
            }
        }
    }
    //temporary for debugging
    spawnPiece(i, pieceString) {
        //do safely
        if (inBounds(i) && IMAGES[pieceString]) {
            const color = pieceString[0];
            const piece = pieceString[1];
            this.GAMESTATE[i] = { color, piece };
        }
    }

}

class moveValidator {
    static moveRules = {
        'k': { type: "step", dirs: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] },
        'n': { type: "step", dirs: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]] },
        'q': { type: "slide", dirs: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] },
        'b': { type: "slide", dirs: [[-1, -1], [-1, 1], [1, -1], [1, 1]] },
        "r": { type: "slide", dirs: [[-1, 0], [0, -1], [0, 1], [1, 0]] },
        "p": { type: "pawn" } //edge case
    }
    isInCheck(color) {

    }
    getValidMoves(gameState, index) {
        const tile = gameState[index];
        if (!tile) {
            throw new Error(`getValidMoves called on empty tile: ${iToXY(index)}`);
        }
        const color = tile.color;
        const piece = tile.piece;
        const moves = [];

        const [x, y] = iToXY(index);

        const rules = moveValidator.moveRules[piece];
        if (rules.type === "step") {
            for (const dir of rules.dirs) {
                const [dx, dy] = dir;
                const newX = x + dx;
                const newY = y + dy;
                if (inBoundsxy(newX, newY)) {
                    const newIndex = xyToI(newX, newY);
                    const targetTile = gameState[newIndex];
                    if (!targetTile || targetTile.color !== color) { //if empty or opposite team
                        moves.push(newIndex);
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
                        const targetTile = gameState[newIndex];
                        if (!targetTile) {
                            moves.push(newIndex);
                        } else if (targetTile.color !== color) { //if opposite team
                            moves.push(newIndex);
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
            if (inBounds(newIndex1) && !gameState[newIndex1]) {
                moves.push(newIndex1);
            }

            //double move
            if (y === startingRow) {
                const newX2 = x;
                const newY2 = y + 2 * direction;
                const newIndex2 = xyToI(newX2, newY2);
                if (inBounds(newIndex2) && !gameState[newIndex1] && !gameState[newIndex2]) {
                    moves.push(newIndex2);
                }
            }

            //capture
            for (const dx of [-1, 1]) {
                const newX = x + dx;
                const newY = y + direction;
                const newIndex = xyToI(newX, newY);
                if (inBounds(newIndex)) {
                    const targetTile = gameState[newIndex];
                    if (targetTile && targetTile.color !== color) { //if opposite team
                        moves.push(newIndex);
                    }
                }
            }

        }
        return moves;
    }
}
class renderer {
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;
        

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
                const index = i * 8 + j; const tile = gameState[index]; 
                const [drawX, drawY] = this.game.teamPerspective(j, i); 
                if (heldPiece == null || heldPiece.origLocation != index) { 
                    if (tile) {
                        this.ctx.drawImage(IMAGES[tile.color + tile.piece], drawX * w, drawY * h, w, h)
                    }
                }
            }
        }
    }
    drawValidMoves(validMoves) {
        let w = this.w / 8;
        let h = this.h / 8;
        const dotColor = findAverageofTwoHex(color[0], color[1])
        for (const spot of validMoves) {
            //list of indices: draw one at each
            const [x, y] = this.game.teamPerspective(...iToXY(spot));
            this.ctx.fillStyle = `rgba(${dotColor[0]}, ${dotColor[1]}, ${dotColor[2]}, 0.5)`;
            this.ctx.beginPath();
            this.ctx.arc(x * w + w / 2, y * h + h / 2, Math.min(w, h) / 4, 0, 2 * Math.PI);
            this.ctx.fill();
        }
    }
    drawHeldPiece(heldPiece, mousepos){ 
        let w = this.w / 8;
        let h = this.h / 8;
        if (heldPiece) {
            const offset = heldPiece.offset
            this.ctx.drawImage(IMAGES[heldPiece.piece.color + heldPiece.piece.piece],
                mousepos[0] - offset[0], mousepos[1] - offset[1], w, h
            )
        }
    }
}

class inputHandler {
    static screenToCanvas=(e,r)=>[e.clientX-r.left,e.clientY-r.top]
    static tileIndexFromMouseEvent(mouseEvent, rect) {
        const [x, y] = inputHandler.screenToCanvas(mouseEvent, rect)
        return xyToI(Math.floor((x / rect.width) * 8), Math.floor((y / rect.height) * 8));
    }

    
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;
        this.mousepos = null;
        this.mouseDown = false;

        canvas.addEventListener("mousemove", (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mousepos = inputHandler.screenToCanvas(e, rect);

            const [x, y] = this.game.teamPerspective(
                ...iToXY(inputHandler.tileIndexFromMouseEvent(e, rect))
            );

            const index = xyToI(x, y);
            game.fireMouseMove(index);
        });

        this.canvas.addEventListener("mousedown", (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const [x, y] = this.game.teamPerspective(
                ...iToXY(inputHandler.tileIndexFromMouseEvent(e, rect))
            );
            const index = xyToI(x, y);
            this.mouseDown = true;
            game.fireMouseDown(index,this.w /8);
        });

        this.canvas.addEventListener("mouseup", (e) => {
            const rect = this.canvas.getBoundingClientRect();
            
            const [x, y] = this.game.teamPerspective(
                ...iToXY(inputHandler.tileIndexFromMouseEvent(e, rect))
            );
            const index = xyToI(x, y);
            this.mouseDown = false;
            game.fireMouseUp(index);
        });
    }

}

let game;
try {
    if (gameCanvas) {
        game = new GAME(gameCanvas, null);
        game.draw(false);
    } else {
        throw new Error('Canvas element #board not found in DOM');
    }
} catch (err) {
    console.error(err);
}
Promise.all(imagePromises)
    .then(() => {
        if (game) {
            game.draw();
        }
    })
    .catch(err => {
        console.error("Error loading images", err);
    });

// Redraw on resize when the page is visible
window.addEventListener('resize', () => { if (game) game.draw(); });

// Expose for other scripts (nav) to trigger redraws when pages are shown
if (game) {
    try { window.__CHESS_GAME = game; } catch (_) { /* ignore if unavailable */ }
}