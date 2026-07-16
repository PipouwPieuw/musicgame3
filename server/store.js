import { DIFFICULTYNAMES } from '../js/config.js';
import { supabase } from './supabase.js';

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
        foundTracksIds: [],
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
    if (!profile.foundTracksIds) {
        profile.foundTracksIds = [];
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

function rowToProfile(row) {
    if (!row) {
        return null;
    }

    return normalizeProfile({
        id: row.username,
        username: row.username,
        initials: row.initials,
        likedTracks: row.liked_tracks,
        games_played: row.games_played,
        good_answers: row.good_answers,
        wrong_answers: row.wrong_answers,
        scores: row.scores,
        foundTracksIds: row.found_tracks_ids,
    });
}

function profileToRow(username, profile) {
    const normalized = normalizeProfile({
        ...profile,
        id: username,
        username,
        initials: profile.initials || username.slice(0, 3).toLowerCase(),
    });

    return {
        username,
        initials: normalized.initials,
        liked_tracks: normalized.likedTracks,
        games_played: normalized.games_played,
        good_answers: normalized.good_answers,
        wrong_answers: normalized.wrong_answers,
        scores: normalized.scores,
        found_tracks_ids: normalized.foundTracksIds,
        updated_at: new Date().toISOString(),
    };
}

function throwIfError(error, context) {
    if (error) {
        console.error(context, error);
        throw new Error(error.message || context);
    }
}

export async function getPlayer(username) {
    const key = normalizeUsername(username);
    if (!key) {
        return null;
    }

    const { data, error } = await supabase.from('players').select('*').eq('username', key).maybeSingle();
    throwIfError(error, 'getPlayer failed');
    return rowToProfile(data);
}

export async function getOrCreatePlayer(username) {
    const key = normalizeUsername(username);
    if (!key) {
        return { profile: null, created: false };
    }

    const existing = await getPlayer(key);
    if (existing) {
        return { profile: existing, created: false };
    }

    const profile = createDefaultProfile(key);
    const row = profileToRow(key, profile);
    const { data, error } = await supabase.from('players').insert(row).select('*').single();
    throwIfError(error, 'getOrCreatePlayer insert failed');

    return { profile: rowToProfile(data), created: true };
}

export async function savePlayer(username, profile) {
    const key = normalizeUsername(username);
    if (!key) {
        throw new Error('Invalid username');
    }

    const row = profileToRow(key, profile);
    const { data, error } = await supabase
        .from('players')
        .upsert(row, { onConflict: 'username' })
        .select('*')
        .single();
    throwIfError(error, 'savePlayer failed');
    return rowToProfile(data);
}

export async function updateLikedTracks(username, likedTracks) {
    const key = normalizeUsername(username);
    if (!key) {
        throw new Error('Invalid username');
    }

    const existing = await getPlayer(key);
    if (!existing) {
        throw new Error('Player not found');
    }

    existing.likedTracks = likedTracks;
    return savePlayer(key, existing);
}

export async function getAllProfiles() {
    const { data, error } = await supabase.from('players').select('*');
    throwIfError(error, 'getAllProfiles failed');
    return (data || []).map(rowToProfile);
}

export async function getAllScores() {
    const profiles = await getAllProfiles();
    return profiles.map(function (profile) {
        return {
            name: profile.username,
            initials: profile.initials,
            scores: profile.scores || [],
        };
    });
}
