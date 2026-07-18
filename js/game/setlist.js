import { SHUFFLE } from '../config.js';
import { shuffleArray } from '../lib/shuffle.js';
import { gameState, isClassicMode, isImageAnswerMode } from './state.js';

/**
 * Playable catalog tracks that the player has found in Classique mode.
 * Used as the exclusive pool for Vignettes setlist and image distractors.
 */
export function getFoundPlayableTracks() {
    const foundIds = new Set(gameState.playerData?.foundTracksIds || []);

    return gameState.tracks.filter(function (track) {
        return foundIds.has(track.id);
    });
}

/**
 * Playable catalog tracks not yet found in Classique.
 * Used when the “non trouvés uniquement” Classique option is checked.
 */
export function getUnfoundPlayableTracks() {
    const foundIds = new Set(gameState.playerData?.foundTracksIds || []);

    return gameState.tracks.filter(function (track) {
        return !foundIds.has(track.id);
    });
}

/** Catalog pool for the active mode and Classique filter options. */
export function getTracksForCurrentMode() {
    if (isImageAnswerMode()) {
        return getFoundPlayableTracks();
    }

    if (isClassicMode() && gameState.onlyUnfoundTracks) {
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
