async function me() {
    const res = await fetch('/api/me', { credentials: "include" });
    const data = await res.json();
    if (res.ok) {
        return data.user;
    } else {
        console.error('Failed to fetch user info:', data.message);
        return null;
    }
}

export async function signup(username, password) {
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

export async function login(username,password) {
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

export async function logout() {
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

export function checkLoginStatus({onSuccess,onFailure}) {
    me().then(user => {
        if (user) {
            onSuccess(user.username);
        } else {
            onFailure();
        }
    }).catch(err => {
        console.error('Error checking login status:', err);
    })
}


