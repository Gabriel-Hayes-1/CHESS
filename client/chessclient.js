import { GameState, MoveValidator, xyToI,iToXY } from "../shared/chess.js";
import { settings } from "./settings.js";

export class Networker {
    constructor() {
        this._listeners = {};
        this.socket = io();

        this.socket.onAny((eventName, ...args) => this.emit(eventName, ...args));
    }
    on(eventName, callback) {
        if (!this._listeners[eventName]) this._listeners[eventName] = [];
        this._listeners[eventName].push(callback);
        return ()=>this.off(eventName,fn)
    }
    off(eventName, callback) {
        this._listeners[eventName] = this._listeners[eventName]?.filter(f => f !== callback);
    }
    emit(eventName, ...args) {
        this._listeners[eventName]?.forEach(fn => fn(...args));
    }

    move(move) {
        return new Promise((resolve) => {
            this.socket.emit("player-move", move, (result) => {
                console.log("Move result: ", result)
                resolve(result);

            })
        })
    }
    joinQueue() {
        return new Promise((resolve) => {
            this.socket.emit("joinQueue", (success, message) => {
                if (success) {
                    resolve({ success: true });
                } else {
                    resolve({
                        success: false,
                        message: message || "Failed to join matchmaking queue"
                    });
                }
            });
        });
    }
    leaveQueue() {
        return new Promise((resolve) => {
            this.socket.emit("cancelQueue", (success, message) => {
                if (success) {
                    resolve({ success: true });
                } else {
                    resolve({
                        success: false,
                        message: message || "Failed to cancel matchmaking"
                    })
                }
            })
        })
    }
    resign() {
        return new Promise((resolve) => {
            this.socket.emit("resign", (success, message) => {
                resolve({ success, message})
            })
        })
    }
    requestDraw() {
        return new Promise((resolve) => {
            this.socket.emit("draw", (success, message) => {
                resolve({ success, message })
            })
        })
    }
}

export class Game {
    constructor(canvas, networkMove, team=null, trial=false) {
        this.team = team;
        this.trial = trial;
        this.sendMove = networkMove;

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

    _myTurn() {
        if (this.trial) return true;
        if (this.GameState.turn==this.team) return true;
        return false;
    }

    resetValidMoves() {
        this.validMoves = {final:[],capture:[],exposesKing:[],total:[],noCaptures:[]};
    }

    fireMouseMove(index) {
        if (index >= 0 && index < 64) {
            const piece = this.GameState.getTile(index);
            if (!this.InputHandler.mouseDown) {
                const isOwnPiece = piece && (piece.color === this.team || this.team === null);
                const canPickUp = isOwnPiece && this.allowMoves && this._myTurn()
                const isValidDrop = this.selectedPiece !== null && this.validMoves.final.some(obj => obj.move === index);

                this.canvas.style.cursor = (canPickUp || isValidDrop) ? "pointer" : "default";
            }
        }
    }

    fireMouseDown(index) {
        const piece = this.GameState.getTile(index);
        const isMyTeam = piece && (piece.color === this.team || this.team == null);

        // Check if this is a valid capture target before overwriting validMoves
        const isValidMove = this.validMoves.total.find(obj => obj.move === index);

        if (isMyTeam && this.allowMoves && !isValidMove && this._myTurn()) { 
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
        } else if (isValidMove && this._myTurn()) {
            this.canvas.style = "cursor: grabbing;";
        }
    }
    fireMouseUp(index) {
        const moveFromIndex = this.heldPiece?.origLocation ?? null;
        const inBounds = index >= 0 && index < 64;

        if (moveFromIndex !== null && inBounds) {
            const move = this.validMoves.final.find(obj => obj.move === index);

            if (this.allowMoves && move) {
                const formattedMove = {
                    from: moveFromIndex,
                    to: index,
                    promotion: null,
                    castle: move.castle,
                    enPassant: move.enPassant
                };

                this.trial
                    ? this.GameState = this.GameState.applyMove(formattedMove).state
                    : this.sendMove(formattedMove);

                this.selectedPiece = null;
            } else {
                const exposedMove = this.validMoves.exposesKing.find(obj => obj.move === index);
                if (this.allowMoves && exposedMove) {
                    const kingIndex = this.GameState.findFirstPiece(this.heldPiece.piece.color, "k");
                    if (kingIndex !== null) this.Renderer.warnTile(kingIndex);
                }
            }
        }

        this.heldPiece = null;
        if (this.selectedPiece === null) this.resetValidMoves();

        if (this.allowMoves) {
            const tile = this.GameState.getTile(index);
            const isOwnTile = tile && (tile.color === this.team || this.team === null);
            this.canvas.style.cursor = (isOwnTile && this._myTurn()) ? "pointer" : "default";
        }
    }

    fireClick(index) {
        const piece = this.GameState.getTile(index);
        
        if (this.selectedPiece != null) {
            let move = this.validMoves.final.find(obj => obj.move === index);
            if (move && (move.move !== null)) {

                //client thinks move is valid, send to server for validation and updating other clients
                // for demonstration we will update local board
                // THIS IS WHERE NETWORKING CALLS GO

                const formattedMove = { from: this.selectedPiece, to: index, promotion: null, castle: move.castle, enPassant: move.enPassant }
                this.Renderer.slidePiece(this.selectedPiece, index, this.GameState.getTile(this.selectedPiece));
                this.resetValidMoves();
                if (this.trial) {
                    this.GameState = this.GameState.applyMove(formattedMove).state;
                } else {
                    this.sendMove?.(formattedMove)
                }


                this.selectedPiece = null;

            } else if (piece && (piece.color === this.team || this.team == null) && this.allowMoves && index !== this.selectedPiece) {
                // reselect clicked friendly piece
                this.resetValidMoves();
                this.selectedPiece = index;
                this.validMoves = this.Validator.getValidMoves(this.GameState, index);
            } else {
                //deselect
                this.resetValidMoves();
                this.selectedPiece = null;
            }
        } else {
            if (piece && (piece.color === this.team || this.team == null) && this.allowMoves && this._myTurn()) {
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
        
        
        if (this.doDraw) {
            requestAnimationFrame(() => this.draw());
        }
    }
    loadFromData(gameData) {
        console.log("Set team to ", gameData.team);
        this.team = gameData.team;
        this.handleStateUpdate(gameData)
    }

    handleStateUpdate(data) { //data: board, turn
        this.GameState = GameState.fromBoard(data.board)
        this.GameState.turn = data.turn
    }

    cleanup() {
        this.InputHandler.cleanup();
        this.doDraw = false;
    }
}

class Renderer {
    static avgHex = (a, b) =>
        [1, 3, 5].map(i =>
            (parseInt(a.slice(i, i + 2), 16) +
                parseInt(b.slice(i, i + 2), 16)) / 2
        );
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
        const color = settings.boardColors
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
        const color = settings.boardColors
        const dotColor = Renderer.avgHex(color[0], color[1])
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
        this._abort = new AbortController()
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
        }, { signal: this._abort.signal });

        this.canvas.addEventListener("mousedown", (e) => {
            this.mouseDown = true;
            const {i,rect} = getIndex(e);
            this.downPos = InputHandler.screenToCanvas(e, rect);

            game.fireMouseDown(i,this.w /8);
        }, { signal: this._abort.signal }); 

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



        }, { signal: this._abort.signal });
    }
    cleanup() {
        this._abort.abort()
    }
}
const IMAGES = {}
export async function loadImages() {
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
