const defaults = {
    boardColors: ['#f0d9b5', '#b58863']
}
export const options = {
    boardColors: {
        classic: ['#f0d9b5', '#b58863'],
        dark: ['#555555', '#333333'],
        felt: ['#e2dcc7', '#6f8f5a'],
        steel: ['#ededed', '#8a8a8a'],
        parchment: ['#f6f1e3', '#b8a887'],
        marble: ['#e6e6e4', '#3b3b3b'],
        slate: ['#d9d9d9', '#7b7f85'],
        ash: ['#cfcfcf', '#5f5f5f'],
        olive: ['#d6dbc8', '#7b8461'],
        dusk: ['#3a3f4a', '#1f232b'],
        sand: ['#e7dcc6', '#b3a17a'],
        clay: ['#d1a08a', '#7a4a3a'],
    }
}


function load() {
    try {
        const saved = JSON.parse(localStorage.getItem('settings'))
        return {...defaults, ...saved}
    } catch {
        return defaults
    }
}

function save(settings) {
    localStorage.setItem("settings",JSON.stringify(settings))
}


export const settings = load();

export function updateSetting(setting,value) {
    settings[setting] = value;
    save(settings);
}