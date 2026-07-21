import {
    emptyScoreMap,
    KEYWORD_MAX_LENGTH,
    KEYWORD_MIN_LENGTH,
    migrateScoresList,
    migrateStatMap,
    SCORE_KEYS,
} from '../js/config.js';
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
        seenUnlocks: {},
        unlockedAchievements: [],
        lastHeldGlobalTrophies: [],
    };
}

/**
 * Normalize seen-unlock map. Migrates legacy hasSeenVignettesMode / has_seen_vignettes_mode into { vignettes: true }.
 */
export function normalizeSeenUnlocks(seenUnlocks, legacyHasSeenVignettes) {
    const map = {};
    if (seenUnlocks && typeof seenUnlocks === 'object' && !Array.isArray(seenUnlocks)) {
        for (const key of Object.keys(seenUnlocks)) {
            if (seenUnlocks[key]) {
                map[key] = true;
            }
        }
    }
    if (legacyHasSeenVignettes && !map.vignettes) {
        map.vignettes = true;
    }
    return map;
}

function normalizeUnlockedAchievements(list) {
    if (!Array.isArray(list)) {
        return [];
    }
    return list
        .filter(function (entry) {
            return entry && typeof entry.id === 'string' && entry.id.length > 0;
        })
        .map(function (entry) {
            return {
                id: entry.id,
                unlockedAt: entry.unlockedAt || new Date(0).toISOString(),
            };
        });
}

function normalizeHeldGlobalTrophies(list) {
    if (!Array.isArray(list)) {
        return [];
    }
    return list.filter(function (id) {
        return typeof id === 'string' && id.length > 0;
    });
}

export function normalizeProfile(profile) {
    if (!profile.likedTracks) {
        profile.likedTracks = [];
    }
    if (!profile.foundTracksIds) {
        profile.foundTracksIds = [];
    }
    profile.seenUnlocks = normalizeSeenUnlocks(profile.seenUnlocks, profile.hasSeenVignettesMode);
    delete profile.hasSeenVignettesMode;
    profile.unlockedAchievements = normalizeUnlockedAchievements(profile.unlockedAchievements);
    profile.lastHeldGlobalTrophies = normalizeHeldGlobalTrophies(profile.lastHeldGlobalTrophies);

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

    // Never expose keyword on client-facing profiles.
    profile.hasKeyword = profile.keyword != null && String(profile.keyword).length > 0;
    delete profile.keyword;

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

/** Soft login keyword as typed (no trim). */
export function asKeyword(keyword) {
    return keyword == null ? '' : String(keyword);
}

export function isValidKeyword(keyword) {
    const value = asKeyword(keyword);
    return value.length >= KEYWORD_MIN_LENGTH && value.length <= KEYWORD_MAX_LENGTH;
}

export class LoginError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'LoginError';
        this.statusCode = statusCode || 400;
    }
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
        seenUnlocks: normalizeSeenUnlocks(row.seen_unlocks, row.has_seen_vignettes_mode),
        unlockedAchievements: row.unlocked_achievements,
        lastHeldGlobalTrophies: row.last_held_global_trophies,
        keyword: row.keyword,
    });
}

function profileToRow(username, profile, keyword) {
    const normalized = normalizeProfile({
        ...profile,
        id: username,
        username,
        initials: profile.initials || username.slice(0, 3).toLowerCase(),
    });

    const row = {
        username,
        initials: normalized.initials,
        liked_tracks: normalized.likedTracks,
        games_played: normalized.games_played,
        good_answers: normalized.good_answers,
        wrong_answers: normalized.wrong_answers,
        scores: normalized.scores,
        found_tracks_ids: normalized.foundTracksIds,
        seen_unlocks: normalized.seenUnlocks || {},
        // Keep legacy column in sync while it still exists in the DB.
        has_seen_vignettes_mode: Boolean(normalized.seenUnlocks && normalized.seenUnlocks.vignettes),
        unlocked_achievements: normalized.unlockedAchievements,
        last_held_global_trophies: normalized.lastHeldGlobalTrophies,
        updated_at: new Date().toISOString(),
    };

    if (keyword !== undefined) {
        row.keyword = keyword;
    }

    return row;
}

function throwIfError(error, context) {
    if (error) {
        console.error(context, error);
        throw new Error(error.message || context);
    }
}

async function getPlayerRow(username) {
    const key = normalizeUsername(username);
    if (!key) {
        return null;
    }

    // Fast path: exact match on lowercase key (covers existing rows).
    const exact = await supabase.from('players').select('*').eq('username', key).maybeSingle();
    throwIfError(exact.error, 'getPlayer failed');
    if (exact.data) {
        return exact.data;
    }

    // Case-insensitive match for mixed-case stored usernames.
    const ilike = await supabase
        .from('players')
        .select('*')
        .ilike('username', escapeIlikeExact(key))
        .maybeSingle();
    throwIfError(ilike.error, 'getPlayer failed');
    return ilike.data || null;
}

export async function getPlayer(username) {
    const row = await getPlayerRow(username);
    return rowToProfile(row);
}

/**
 * Soft-password login: create, claim missing keyword, or verify match.
 * Keyword is never returned on the profile.
 */
export async function loginWithKeyword(username, keyword) {
    const display = trimUsername(username);
    const key = normalizeUsername(display);
    const keywordValue = asKeyword(keyword);

    if (!key) {
        throw new LoginError('Nom d\'utilisateur invalide', 400);
    }
    if (!isValidKeyword(keywordValue)) {
        throw new LoginError(
            `Le mot-clé doit contenir entre ${KEYWORD_MIN_LENGTH} et ${KEYWORD_MAX_LENGTH} caractères.`,
            400
        );
    }

    const existing = await getPlayerRow(display);

    if (!existing) {
        const profile = createDefaultProfile(display);
        const row = profileToRow(display, profile, keywordValue);
        const { data, error } = await supabase.from('players').insert(row).select('*').single();

        if (isUniqueViolation(error)) {
            // Race: another request created the row — re-run as existing-user login.
            return loginWithKeyword(display, keywordValue);
        }

        throwIfError(error, 'loginWithKeyword insert failed');
        return { profile: rowToProfile(data), created: true };
    }

    const storedKeyword = existing.keyword == null ? '' : String(existing.keyword);

    if (!storedKeyword) {
        const { data, error } = await supabase
            .from('players')
            .update({ keyword: keywordValue, updated_at: new Date().toISOString() })
            .eq('username', existing.username)
            .select('*')
            .single();
        throwIfError(error, 'loginWithKeyword claim failed');
        return { profile: rowToProfile(data), created: false };
    }

    if (storedKeyword !== keywordValue) {
        throw new LoginError(
            'Ce nom d\'utilisateur existe déjà et le mot-clé ne correspond pas.',
            403
        );
    }

    return { profile: rowToProfile(existing), created: false };
}

export async function savePlayer(username, profile) {
    const key = normalizeUsername(username);
    if (!key) {
        throw new Error('Invalid username');
    }

    const existing = await getPlayerRow(username);
    const canonical = existing?.username || trimUsername(username);
    if (!canonical) {
        throw new Error('Invalid username');
    }

    // Preserve DB keyword — never accept it from client profile payloads.
    const preservedKeyword = existing ? existing.keyword : undefined;
    const row = profileToRow(canonical, profile, preservedKeyword);
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
