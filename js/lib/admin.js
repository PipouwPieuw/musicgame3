import { ADMIN_USERNAME } from '../config.js';
import { gameState } from '../game/state.js';

/**
 * Whether the given (or current session) username is the admin account.
 * Case-insensitive; does not mutate saved progress.
 * @param {string} [username]
 * @returns {boolean}
 */
export function isAdminAccount(username) {
    const name = username != null ? username : gameState.username;
    return String(name || '').trim().toLowerCase() === ADMIN_USERNAME;
}

/**
 * Gate for future test-only UI / features.
 * Currently identical to isAdminAccount.
 * @param {string} [username]
 * @returns {boolean}
 */
export function canAccessTestFeatures(username) {
    return isAdminAccount(username);
}

/**
 * Track IDs treated as found for admin catalogue / stats (full list from tracks).
 * @param {Array<{ id: string }>} tracks
 * @returns {string[]}
 */
export function getAdminFoundTrackIds(tracks) {
    if (!Array.isArray(tracks)) {
        return [];
    }
    return tracks.map(function (track) {
        return track.id;
    });
}
