const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const cookie = require('cookie');
const game = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const connectedPlayers = new Map();

const JWT_SECRET = '444796dbd8f84d921dbd9e55dbfff3f14086f7e6249287ffb12e1e2b2443eaeb' //maybe define in .env later

const database = {}; //EXTREMELY TEMPORARY. REPLACE WITH REAL DATABASE LATER

const PORT = process.argv[2] || 3000; // Use command-line argument or default to 3000

app.use(cookieParser());
app.use(express.json());

// Serve everything in the client directory
const clientDir = path.join(__dirname, '../client');
app.use(express.static(clientDir));

function guestName() {
    //like guest-12345
    return `Guest-${Math.floor(Math.random()*100000)}`;
}

function authenticate(req,res,next) {
    const token = req.cookies.sessionToken;

    if (!token) {
        return res.status(401).json({message: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({message: 'Invalid token' });
        }
        const user = database[decoded.username];

        if (!user) {
            res.clearCookie('sessionToken',{
                httpOnly:true,
                secure: false //in production make true
            })
            return res.status(401).json({message: 'User no longer exsists' });
        }

        req.user = decoded; // Attach decoded user info to request
        next();
    });
}

// client requests a game.
app.post('/api/findgame', authenticate, (req, res) => {
    console.log(`Player ${req.user.username} is looking for a game`);
});


app.post('/api/signup', async (req, res)=>{
    try {
        if (!req.body) {
            return res.status(400).json({message: 'Invalid request body' });
        }
        const {username, password} = req.body;

        if (!username || !password) {
            return res.status(400).json({message: 'Username and password are required' });
        }

        const exsistingUser = database[username]; //again use real db for this

        if (exsistingUser) {
            return res.status(409).json({message: 'Username already exists' });
        }

        const hash = await bcrypt.hash(password, 10); //10 is cost, more is more secure but slower

        const newUser = {
            id: crypto.randomUUID(),
            username,
            passwordHash: hash,
        }

        //store in db (again replace with real db)
        database[username] = newUser;

        const token = jwt.sign({ id: newUser.id, username: newUser.username }, JWT_SECRET, { expiresIn: '1d' });

        res.cookie('sessionToken',token,{
            maxAge:1000*60*60*24*7, //week
            httpOnly:true,
        })

        res.status(201).json({message:'User created successfully'});
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
})
app.post('/api/login', async (req, res)=>{
    try {
        if (!req.body) {
            return res.status(400).json({message: 'Invalid request body' });
        }
        console.log(req.body)
        const {username, password} = req.body;


        if (!username || !password) { //no account exsists
            return res.status(400).json({message: 'Username and password are required' });
        }

        const exsistingUser = database[username]; //again use real db for this

        if (!exsistingUser) {
            return res.status(400).json({message: 'Invalid username or password'});
        }

        const passwordMatch = await bcrypt.compare(password, exsistingUser.passwordHash);

        if (!passwordMatch) { //login info not match (wrong password)
            return res.status(400).json({message: 'Invalid username or password' });
        }

        const token = jwt.sign({ id: exsistingUser.id, username: exsistingUser.username }, JWT_SECRET, { expiresIn: '1d' });

        res.cookie('sessionToken',token,{
            maxAge:1000*60*60*24*7, //week
            httpOnly:true,
            secure: false //in production make true
        })
        
        res.status(200).json({message: 'Login successful' });

    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
});
app.post("/api/logout", authenticate, (req,res)=>{
    res.clearCookie('sessionToken',{
        httpOnly:true,
        secure: false //in production make true
    });
    res.status(200).json({message: 'Logout successful'});
})
app.get("/api/me",authenticate, (req,res)=>{
    res.status(200).json({user: { id: req.user.id, username: req.user.username } });
})



io.use((socket,next)=>{
    let token = null;
    if (socket.handshake.headers.cookie){
        const cookies = cookie.parse(socket.handshake.headers.cookie);
        token = cookies.sessionToken;
    }
    if (!token) {
        return next();
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded; // Attach decoded user info to socket
        next();
    } catch(err) {
        next();
    }
})

//socket stuff. Socket is only used for real-time chess game
io.on('connection', (socket) => {
    const socketId = socket.id;
    const accountId = socket.userId?.id || null;

    let username;
    if (accountId) {
        username = socket.userId.username;
    } else {
        username = `Guest-${guestName()}`;
    }

    connectedPlayers.set(socketId, {
        socket,
        username,
        game:null,
        accountId
    });
})









// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});