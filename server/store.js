import { emptyScoreMap, migrateScoresList, migrateStatMap, SCORE_KEYS } from '../js/config.js';
import { supabase } from './supabase.js';

export function createDefaultProfile(username) {
    return {
        id: username,
        username,
        initials: username.slice(0, 3).toLowerCase(),
        likedTracks: [],
        games_played: emptyScoreMap(),
        good_answers: emptyScoreMap(),
        wrong_answers: emptyScoreMap(),
        scores: [],
        foundTracksIds: [],
        hasSeenVignettesMode: false,
    };
}

export function normalizeProfile(profile) {
    if (!profile.likedTracks) {
        profile.likedTracks = [];
    }
    if (!profile.foundTracksIds) {
        profile.foundTracksIds = [];
    }
    if (profile.hasSeenVignettesMode == null) {
        profile.hasSeenVignettesMode = false;
    }

    profile.games_played = migrateStatMap(profile.games_played);
    profile.good_answers = migrateStatMap(profile.good_answers);
    profile.wrong_answers = migrateStatMap(profile.wrong_answers);
    profile.scores = migrateScoresList(profile.scores);

    for (const name of SCORE_KEYS) {
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

/** Trim only — preserves letter casing for display/storage. */
export function trimUsername(username) {
    return String(username || '').trim();
}

/** Lowercase key used for case-insensitive matching. */
export function normalizeUsername(username) {
    return trimUsername(username).toLowerCase();
}

function escapeIlikeExact(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function isUniqueViolation(error) {
    return Boolean(error && (error.code === '23505' || /duplicate key|unique constraint/i.test(error.message || '')));
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
        hasSeenVignettesMode: row.has_seen_vignettes_mode,
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
        has_seen_vignettes_mode: Boolean(normalized.hasSeenVignettesMode),
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

    // Fast path: exact match on lowercase key (covers existing rows).
    const exact = await supabase.from('players').select('*').eq('username', key).maybeSingle();
    throwIfError(exact.error, 'getPlayer failed');
    if (exact.data) {
        return rowToProfile(exact.data);
    }

    // Case-insensitive match for mixed-case stored usernames.
    const ilike = await supabase
        .from('players')
        .select('*')
        .ilike('username', escapeIlikeExact(key))
        .maybeSingle();
    throwIfError(ilike.error, 'getPlayer failed');
    return rowToProfile(ilike.data);
}

export async function getOrCreatePlayer(username) {
    const display = trimUsername(username);
    const key = normalizeUsername(display);
    if (!key) {
        return { profile: null, created: false };
    }

    const existing = await getPlayer(display);
    if (existing) {
        return { profile: existing, created: false };
    }

    const profile = createDefaultProfile(display);
    const row = profileToRow(display, profile);
    const { data, error } = await supabase.from('players').insert(row).select('*').single();

    if (isUniqueViolation(error)) {
        const raced = await getPlayer(display);
        if (raced) {
            return { profile: raced, created: false };
        }
    }

    throwIfError(error, 'getOrCreatePlayer insert failed');

    return { profile: rowToProfile(data), created: true };
}

export async function savePlayer(username, profile) {
    const key = normalizeUsername(username);
    if (!key) {
        throw new Error('Invalid username');
    }

    const existing = await getPlayer(username);
    const canonical = existing?.username || trimUsername(username);
    if (!canonical) {
        throw new Error('Invalid username');
    }

    const row = profileToRow(canonical, profile);
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

    const existing = await getPlayer(username);
    if (!existing) {
        throw new Error('Player not found');
    }

    existing.likedTracks = likedTracks;
    return savePlayer(existing.username, existing);
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
