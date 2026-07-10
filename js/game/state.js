import {
    DEFAULTTRACKSBYGAME,
    DIFFICULTYNAMES,
    HARDCOREMODETRACKDURATION,
    MODIFIER_RATES,
    POINTSBYANSWER,
    SEGMENT_DURATIONS_1,
    SEGMENT_DURATIONS_2,
} from '../config.js';
import { getStoredUsername } from '../services/local-storage.js';

export const gameState = {
    tracks: [],
    setList: [],
    setListLength: 0,
    tracksByGame: DEFAULTTRACKSBYGAME,
    difficultyLevel: 1,
    trackStart: 0,
    roundStartTime: 0,
    pointsMultiplier: 1,
    streak: 0,
    streakBonus: 0,
    isPlaying: false,
    score: 0,
    playedTracks: 0,
    currentTrackId: null,
    currentAudioTime: 0,
    currentSegmentDurations: [],
    playerData: {},
    username: getStoredUsername(),
    modifierRates: [...MODIFIER_RATES],
    segmentDurations1: [...SEGMENT_DURATIONS_1],
    segmentDurations2: [...SEGMENT_DURATIONS_2],
};

export function getDifficultyName() {
    return DIFFICULTYNAMES[gameState.difficultyLevel - 1];
}

export function isHardcoreAudio() {
    return gameState.difficultyLevel >= 3;
}

export function getClipDuration() {
    return isHardcoreAudio() ? HARDCOREMODETRACKDURATION : 30;
}

export function resetRoundState() {
    gameState.isPlaying = false;
}

export function resetGameState() {
    gameState.score = 0;
    gameState.streak = 0;
    gameState.streakBonus = 0;
    gameState.setList = [];
    gameState.setListLength = 0;
    gameState.playedTracks = 0;
    gameState.isPlaying = false;
    gameState.roundStartTime = 0;
}

export function computeScoreIncrement() {
    return (POINTSBYANSWER + gameState.streakBonus) * gameState.pointsMultiplier;
}
