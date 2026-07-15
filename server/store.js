import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIFFICULTYNAMES } from '../js/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS_FILE = path.join(__dirname, 'data', 'players.json');
const PLAYERS_TMP_FILE = path.join(__dirname, 'data', 'players.json.tmp');

let writeChain = Promise.resolve();

function emptyDifficultyMap() {
    const map = {};
    for (const name of DIFFICULTYNAMES) {
        map[name] = 0;
    }
    return map;
}

export function createDefaultProfile(username) {
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

export function normalizeProfile(profile) {
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

export function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}

async function readProfilesFile() {
    try {
        const raw = await fs.readFile(PLAYERS_FILE, 'utf8');
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}

async function writeProfilesFile(profiles) {
    await fs.mkdir(path.dirname(PLAYERS_FILE), { recursive: true });
    await fs.writeFile(PLAYERS_TMP_FILE, JSON.stringify(profiles, null, 2), 'utf8');
    await fs.rename(PLAYERS_TMP_FILE, PLAYERS_FILE);
}

function withWriteLock(task) {
    const next = writeChain.then(task, task);
    writeChain = next.catch(function () {
        // Keep the queue alive after a failed write.
    });
    return next;
}

export async function getPlayer(username) {
    const key = normalizeUsername(username);
    if (!key) {
        return null;
    }

    const profiles = await readProfilesFile();
    if (!(key in profiles)) {
        return null;
    }

    return normalizeProfile({ ...profiles[key] });
}

export async function getOrCreatePlayer(username) {
    const key = normalizeUsername(username);
    if (!key) {
        return { profile: null, created: false };
    }

    return withWriteLock(async function () {
        const profiles = await readProfilesFile();

        if (key in profiles) {
            return {
                profile: normalizeProfile({ ...profiles[key] }),
                created: false,
            };
        }

        const profile = createDefaultProfile(key);
        profiles[key] = profile;
        await writeProfilesFile(profiles);

        return { profile: normalizeProfile({ ...profile }), created: true };
    });
}

export async function savePlayer(username, profile) {
    const key = normalizeUsername(username);
    if (!key) {
        throw new Error('Invalid username');
    }

    return withWriteLock(async function () {
        const profiles = await readProfilesFile();
        profiles[key] = normalizeProfile({ ...profile, id: key, username: key });
        await writeProfilesFile(profiles);
        return profiles[key];
    });
}

export async function updateLikedTracks(username, likedTracks) {
    const key = normalizeUsername(username);
    if (!key) {
        throw new Error('Invalid username');
    }

    return withWriteLock(async function () {
        const profiles = await readProfilesFile();
        if (!(key in profiles)) {
            throw new Error('Player not found');
        }

        profiles[key].likedTracks = likedTracks;
        profiles[key] = normalizeProfile(profiles[key]);
        await writeProfilesFile(profiles);
        return profiles[key];
    });
}

export async function getAllProfiles() {
    const profiles = await readProfilesFile();
    return Object.values(profiles).map(function (profile) {
        return normalizeProfile({ ...profile });
    });
}

export async function getAllScores() {
    const profiles = await readProfilesFile();
    return Object.values(profiles).map(function (profile) {
        return {
            name: profile.username,
            initials: profile.initials,
            scores: profile.scores || [],
        };
    });
}
