import { SHUFFLE } from '../config.js';
import { isAdminAccount } from '../lib/admin.js';
import { shuffleArray } from '../lib/shuffle.js';
import { gameState, isCodexMode, isImageAnswerMode } from './state.js';

/**
 * Playable catalog tracks that the player has found in Codex mode.
 * Used as the exclusive pool for Vignettes setlist and image distractors.
 * Admin: full current catalog (virtual found, no profile mutation).
 */
export function getFoundPlayableTracks() {
    if (isAdminAccount()) {
        return gameState.tracks;
    }

    const foundIds = new Set(gameState.playerData?.foundTracksIds || []);

    return gameState.tracks.filter(function (track) {
        return foundIds.has(track.id);
    });
}

/**
 * Playable catalog tracks not yet found in Codex.
 * Codex always draws exclusively from this pool.
 */
export function getUnfoundPlayableTracks() {
    const foundIds = new Set(gameState.playerData?.foundTracksIds || []);

    return gameState.tracks.filter(function (track) {
        return !foundIds.has(track.id);
    });
}

/** Catalog pool for the active mode. */
export function getTracksForCurrentMode() {
    // Admin: full catalog in both modes so Codex stays playable for testing.
    if (isAdminAccount()) {
        return gameState.tracks;
    }

    if (isImageAnswerMode()) {
        return getFoundPlayableTracks();
    }

    if (isCodexMode()) {
        return getUnfoundPlayableTracks();
    }

    return gameState.tracks;
}

export function buildSetlist(tracks, requestedCount) {
    const maxTracks = tracks.length;
    const count = Math.min(requestedCount, maxTracks);

    const allTrackIds = tracks.map(function (track) {
        return track.id;
    });
    const shuffled = SHUFFLE ? shuffleArray(allTrackIds) : allTrackIds;

    gameState.setList = shuffled.slice(0, count);
    gameState.setListLength = gameState.setList.length;
    gameState.tracksByGame = gameState.setListLength;

    return gameState.setList;
}
