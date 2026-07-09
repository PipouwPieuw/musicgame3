import { DIFFICULTYNAMES } from '../config.js';

const PROFILES_KEY = 'ass_profiles';
const USERNAME_KEY = 'ass_username';

function emptyDifficultyMap() {
    const map = {};
    for (const name of DIFFICULTYNAMES) {
        map[name] = 0;
    }
    return map;
}

function loadProfiles() {
    try {
        const raw = window.localStorage.getItem(PROFILES_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        console.error('Failed to load profiles from localStorage', error);
        return {};
    }
}

function saveProfiles(profiles) {
    window.localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function createDefaultProfile(username) {
    return {
        id: username,
        username,
        initials: username.slice(0, 3).toLowerCase(),
        likedTracks: [],
        games_played: emptyDifficultyMap(),
        good_answers: emptyDifficultyMap(),
        wrong_answers: emptyDifficultyMap(),
        scores: [],
    };
}

function normalizeProfile(profile) {
    if (!profile.likedTracks) {
        profile.likedTracks = [];
    }
    if (!profile.games_played) {
        profile.games_played = emptyDifficultyMap();
    }
    if (!profile.good_answers) {
        profile.good_answers = emptyDifficultyMap();
    }
    if (!profile.wrong_answers) {
        profile.wrong_answers = emptyDifficultyMap();
    }
    if (!profile.scores) {
        profile.scores = [];
    }

    for (const name of DIFFICULTYNAMES) {
        if (profile.games_played[name] == null) {
            profile.games_played[name] = 0;
        }
        if (profile.good_answers[name] == null) {
            profile.good_answers[name] = 0;
        }
        if (profile.wrong_answers[name] == null) {
            profile.wrong_answers[name] = 0;
        }
    }

    return profile;
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

export async function getPlayerData(username) {
    if (!username) {
        return { id: null };
    }

    const profiles = loadProfiles();

    if (!(username in profiles)) {
        const profile = createDefaultProfile(username);
        profiles[username] = profile;
        saveProfiles(profiles);
        return profile;
    }

    return normalizeProfile({ ...profiles[username] });
}

export async function updateLikedTracks(username, likedTracks) {
    const profiles = loadProfiles();
    if (!profiles[username]) {
        return;
    }
    profiles[username].likedTracks = likedTracks;
    saveProfiles(profiles);
}

export async function getScores(username) {
    const profiles = loadProfiles();
    if (!profiles[username]) {
        return [];
    }
    return [{ scores: profiles[username].scores || [] }];
}

export async function getAllScores() {
    const profiles = loadProfiles();
    return Object.values(profiles).map((profile) => ({
        name: profile.username,
        initials: profile.initials,
        scores: profile.scores || [],
    }));
}

export async function getAllProfiles() {
    return Object.values(loadProfiles()).map((profile) => normalizeProfile({ ...profile }));
}

export async function updateScores(username, scores) {
    const profiles = loadProfiles();
    if (!profiles[username]) {
        return;
    }
    profiles[username].scores = scores;
    saveProfiles(profiles);
}

export async function updateGamesPlayed(username, gamesPlayed) {
    const profiles = loadProfiles();
    if (!profiles[username]) {
        return;
    }
    profiles[username].games_played = gamesPlayed;
    saveProfiles(profiles);
}

export async function updateAnswers(username, good, wrong) {
    const profiles = loadProfiles();
    if (!profiles[username]) {
        return;
    }
    profiles[username].good_answers = good;
    profiles[username].wrong_answers = wrong;
    saveProfiles(profiles);
}
