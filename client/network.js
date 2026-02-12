const socket = io();

async function startMatchmaking() {
    const res = await fetch('/api/findgame', {
        method: 'POST', 
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ foo: 'bar' })
    });
    const data = await res.json();
    if (data.success) {
        console.log('Matchmaking started successfully');
        return true;
    } else {
        console.error('Failed to start matchmaking');
        return false;
    }
}

async function me() {
    const res = await fetch('/api/me',{credentials:"include"});
    const data = await res.json()
    if (res.ok) {
        return data.user;
    } else {
        if (res.status === 401) {
            console.log('Not logged in: ', data.message);
        } else {
            console.error('Failed to fetch user info:', data.message);
        }
        return null;
    }
}

async function signup(username, password) {
    try {
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password})
        })
        if (!res.ok) {
            const errorData = await res.json();
            console.error('Signup failed:', errorData.message);
            return { success: false, message: errorData.message };
        }

        const data = await res.json();
        console.log('Signup successful. token stored.');
        return { success: true};

    } catch (err) {
        console.error('Error during signup:', err);
    }
}

async function login(username,password) {
    const res = await fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password})
    })
    const data = await res.json();
    if (res.ok) {
        console.log('Login successful. token stored.');
        return { success: true};
    } else {
        console.error('Login failed:', data.message);
        return { success: false, message: data.message };
    }
}

async function logout() {
    const res = await fetch('/api/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': 0
        },
        credentials: 'include'
    })
    const data = await res.json();
    if (res.ok) {
        return { success: true };
    } else {
        console.error('Logout failed:', data.message);
        return { success: false, message: data.message };
    }
}


socket.on('game-begin', (gameData) => {
    const opponentName = gameData.opponentName;
    const team = gameData.team; // 'w' or 'b'
})

me().then(user=>{
    if (user) {
        uiLoggedIn(user.username);
    } else {
        uiLoggedOut();
    }
}).catch(err=>{
    console.error('Error checking login status:', err);
})