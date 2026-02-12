const gameCanvas = document.getElementById('board');


function xyToI(x,y){
    return y*8 + x;
}
function iToXY(i) {
    return [i%8, Math.floor(i/8)];
}
function inBounds(i) {
    return i>=0 && i<64;
}
function inBoundsxy(x,y) {
    return x>=0 && x<8 && y>=0 && y<8;
}
function tileIndexFromMouseEvent(mouseEvent, rect) {
    const [x,y] = screenToCanvas(mouseEvent,rect)
    return xyToI(Math.floor((x / rect.width) * 8), Math.floor((y / rect.height) * 8));
}
function screenToCanvas(mouseEvent,rect) {
    return [mouseEvent.clientX-rect.left,mouseEvent.clientY-rect.top]
}
function strGameStatetoObj(gameState) {
    return gameState.map(tileStr => {
        if (tileStr) {
            const color = tileStr[0];
            const piece = tileStr[1];
            return {color, piece};
        }
        return null;
    })
}

const IMAGES = {}
for (const path of ["wp","wr","wn","wb","wq","wk","bp","br","bn","bb","bq","bk"]) {
    const img = new Image();
    img.src = "assets/"+path+".svg";
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
        this.GAMESTATE = new Array(8*8).fill(null);
        this.COLOR = team;
        this.validator = new moveValidator(this.GAMESTATE);
        this.allowMoves = true;
        this.VALID_MOVES = [];

        this.doDraw = true;
        if (canvas) {
            this.canvas = canvas;
        } else {
            throw new Error("Canvas not found");
        }

        //attempt to make a context
        if (this.canvas.getContext) {
            this.ctx = this.canvas.getContext('2d');
        } else {
            throw new Error("Canvas not supported");
        }

        this.dpr = window.devicePixelRatio || 1;
        this.w = this.canvas.width/this.dpr;
        this.h = this.canvas.height/this.dpr;

        this.mousedown = false;
        this.heldPiece = null;
        this.mousepos = [0,0];
    }
    initCanvasListeners() {
        this.canvas.addEventListener("mousemove",(e)=>{
            const rect = this.canvas.getBoundingClientRect();
            this.mousepos = screenToCanvas(e,rect)
            const index = tileIndexFromMouseEvent(e, rect);
            if (index>=0 && index<64) {
                const piece = this.GAMESTATE[index];
                if (!this.mousedown) {
                    if (piece && piece.color === this.COLOR) {
                        if (this.allowMoves) {
                            this.canvas.style = "cursor: grab;";
                        }
                    } else {
                        this.canvas.style = "cursor: default;";
                    }
                }
            }
        })
        this.canvas.addEventListener("mousedown",(e)=>{
            const rect = this.canvas.getBoundingClientRect();
            const index = tileIndexFromMouseEvent(e, rect);
            if (index>=0 && index<64) {
                const piece = this.GAMESTATE[index];
                if (piece && piece.color === this.COLOR) {
                    this.mousedown = true;
                    
                    let [x,y] = iToXY(index);
                    x = x * this.w/8;
                    y = y * this.h/8;
                    const dx = this.mousepos[0] - x;
                    const dy = this.mousepos[1] - y;
                    
                    this.heldPiece = {origLocation:index,piece,offset:[dx,dy]};

                    
                    if (this.allowMoves) {
                        this.VALID_MOVES = this.validator.getValidMoves(index);
                    }
                    this.canvas.style = "cursor: grabbing;";
                } 
            }
        })
        this.canvas.addEventListener("mouseup",(e)=>{
            const rect = this.canvas.getBoundingClientRect();
            
            const moveFromIndex = this.heldPiece ? this.heldPiece.origLocation : null;
            const index = tileIndexFromMouseEvent(e, rect);
            if (moveFromIndex!=null && index>=0 && index<64) {
                if (this.allowMoves && this.VALID_MOVES.includes(index)) {
                    //valid move, do what you want: send update, or redraw board
                    //for demonstration we will update local board

                    const piece = this.GAMESTATE[moveFromIndex];
                    const newGameState = this.GAMESTATE.slice();
                    newGameState[index] = piece;
                    newGameState[moveFromIndex] = null;
                    this.updateGameState(newGameState);

                }
            }
            this.mousedown = false;
            this.heldPiece = null;
            this.VALID_MOVES = [];
            if (this.allowMoves) {
                if (this.GAMESTATE[index] && this.GAMESTATE[index].color === this.COLOR) {
                    this.canvas.style = "cursor: grab;";
                } else {
                    this.canvas.style = "cursor: default;";
                }
            }
        })
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
            this.w = this.canvas.width/this.dpr;
            this.h = this.canvas.height/this.dpr;

            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(this.dpr, this.dpr);
        }

    }

    draw(doPieces = true) {
        if (this.doDraw) {
            this.resizeCanvas();        
            this.ctx.clearRect(0, 0, this.w, this.h);

            let w = this.w/8;
            let h = this.h/8;
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    let c = color[(i+j)%2];
                    this.ctx.fillStyle = c;
                    this.ctx.fillRect(i*w, j*h, w, h);
                } 
            }
            if (doPieces){
                //draw GAMESTATE
                for (let i = 0; i < 8; i++) {
                    for (let j = 0; j < 8; j++) {
                        const index = i*8 + j;
                        const tile = this.GAMESTATE[index];

                        if (this.heldPiece==null || this.heldPiece.origLocation!=index) {
                            if (tile) {
                                this.ctx.drawImage(IMAGES[tile.color+tile.piece], j*w, i*h, w, h);
                            }
                        } 

                        
                    }
                }
                //draw VALID_MOVE_BUBBLES
                for (const spot of this.VALID_MOVES) {
                    //list of indices: draw one at each
                    const [x,y] = iToXY(spot);
                    this.ctx.fillStyle = "rgba(255,255,255,0.5)";
                    this.ctx.beginPath();
                    this.ctx.arc(x*w+w/2, y*h+h/2, Math.min(w,h)/4, 0, 2 * Math.PI);
                    this.ctx.fill();
                }
                if (this.heldPiece) {
                    const offset = this.heldPiece.offset
                    this.ctx.drawImage(IMAGES[this.heldPiece.piece.color+this.heldPiece.piece.piece],
                        this.mousepos[0]-offset[0],this.mousepos[1]-offset[1],w,h
                    )
                }
            }
        }
        if (doPieces) {
            requestAnimationFrame(()=>this.draw());
        }
    }
    updateGameState(newGameState) {
        if (newGameState.length === 64) {
            this.GAMESTATE = newGameState.slice();
            this.validator.updateGameState(newGameState);
        }
    }
    movePiece(oldI,newI) {
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
            this.GAMESTATE[i] = {color, piece};
            this.validator.updateGameState(this.GAMESTATE);
        }
    }

}

class moveValidator {
    static moveRules = {
        'k': {type:"step",dirs:[[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]},
        'n': {type:"step",dirs:[[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]},
        'q': {type:"slide",dirs:[[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]},
        'b': {type:"slide",dirs:[[-1, -1], [-1, 1], [1, -1], [1, 1]]},
        "r": {type:"slide",dirs:[[-1, 0], [0, -1], [0, 1], [1, 0]]},
        "p": {type:"pawn"} //holy edge case, i hate pawns
    } 
    constructor(gameState) {
        this.gameState = gameState
    }
    updateGameState(newGameState) {
        if (newGameState.length === 64) {
            this.gameState = newGameState.slice();
        }
    }
    isInCheck(color) {

    }
    _clipBoardEdges(indices) {
        //remove indicies outside of board 
        return indices.filter(i => i>=0 && i<64);
    }

    getValidMoves(index) {
        const tile = this.gameState[index];
        if (!tile) {
            throw new Error(`getValidMoves called on empty tile: ${iToXY(index)}`);
        }
        const color = tile.color;
        const piece = tile.piece;
        const moves = [];

        const [x,y] = iToXY(index);

        const rules = moveValidator.moveRules[piece];
        if (rules.type === "step") {
            for (const dir of rules.dirs) {
                const [dx,dy] = dir;
                const newX = x + dx;
                const newY = y + dy;
                if (inBoundsxy(newX,newY)) {
                    const newIndex = xyToI(newX, newY);
                    const targetTile = this.gameState[newIndex];
                    if (!targetTile || targetTile.color !== color) { //if empty or opposite team
                        moves.push(newIndex);
                    }
                }
            }
        } else if (rules.type === "slide") {
            for (const dir of rules.dirs) {
                const [dx,dy] = dir;
                for (let step = 1; step < 8; step++) {
                    const newX = x + dx*step;
                    const newY = y + dy*step;
                    if (inBoundsxy(newX,newY)) {
                        const newIndex = xyToI(newX, newY);
                        const targetTile = this.gameState[newIndex];
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
            if (inBounds(newIndex1) && !this.gameState[newIndex1]) {
                moves.push(newIndex1);
            }

            //double move
            if (y === startingRow) {
                const newX2 = x;
                const newY2 = y + 2*direction;
                const newIndex2 = xyToI(newX2, newY2);
                if (inBounds(newIndex2) && !this.gameState[newIndex1] && !this.gameState[newIndex2]) {
                    moves.push(newIndex2);
                }
            }

            //capture
            for (const dx of [-1, 1]) {
                const newX = x + dx;
                const newY = y + direction;
                const newIndex = xyToI(newX, newY);
                if (inBounds(newIndex)) {
                    const targetTile = this.gameState[newIndex];
                    if (targetTile && targetTile.color !== color) { //if opposite team
                        moves.push(newIndex);    
                    }
                }
            }
            
        }
        return moves;
    }

}

let game;
try {
    if (gameCanvas) {
        game = new GAME(gameCanvas,"w");
        game.initCanvasListeners();
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