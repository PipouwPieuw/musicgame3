const PROFILES_KEY = 'ass_profiles';
const USERNAME_KEY = 'ass_username';

function loadLegacyProfiles() {
    try {
        const raw = window.localStorage.getItem(PROFILES_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error('Failed to load legacy profiles from localStorage', error);
        return {};
    }
}

function saveLegacyProfiles(profiles) {
    try {
        window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    } catch (error) {
        console.error('Failed to save legacy profiles to localStorage', error);
    }
}

export function getStoredUsername() {
    return window.localStorage.getItem(USERNAME_KEY) || window.localStorage.getItem('username') || '';
}

export function setStoredUsername(username) {
    window.localStorage.setItem(USERNAME_KEY, username);
    window.localStorage.removeItem('username');
    window.localStorage.removeItem('userkey');
}

export function clearStoredUsername() {
    window.localStorage.removeItem(USERNAME_KEY);
    window.localStorage.removeItem('username');
    window.localStorage.removeItem('userkey');
}

export function getLegacyProfile(username) {
    if (!username) {
        return null;
    }

    const profiles = loadLegacyProfiles();
    if (!(username in profiles)) {
        return null;
    }

    return { ...profiles[username] };
}

export function removeLegacyProfile(username) {
    if (!username) {
        return;
    }

    const profiles = loadLegacyProfiles();
    if (!(username in profiles)) {
        return;
    }

    delete profiles[username];
    saveLegacyProfiles(profiles);
}
