import { SHUFFLE } from '../config.js';
import { shuffleArray } from '../lib/shuffle.js';
import { gameState } from './state.js';

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
