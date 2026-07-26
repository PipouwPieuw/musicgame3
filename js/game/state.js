import {
    DEFAULT_ACTIVE_GENRES,
    DEFAULTTRACKDURATION,
    DEFAULTTRACKSBYGAME,
    DIFFICILETRACKDURATION,
    DIFFICULTYNAMES,
    GAME_MODE_CODEX,
    GAME_MODE_VIGNETTES,
    HARDCOREMODETRACKDURATION,
    MODIFIER_RATES,
    MOYENTRACKDURATION,
    SCORE_KEY_LABELS,
    SEGMENT_DURATIONS_1,
    SEGMENT_DURATIONS_2,
} from '../config.js';
import { getStoredUsername } from '../services/local-storage.js';

export const gameState = {
    tracks: [],
    setList: [],
    setListLength: 0,
    tracksByGame: DEFAULTTRACKSBYGAME,
    gameMode: GAME_MODE_CODEX,
    difficultyLevel: 1,
    trackStart: 0,
    roundStartTime: 0,
    streak: 0,
    streakBonus: 0,
    isPlaying: false,
    score: 0,
    playedTracks: 0,
    currentTrackId: null,
    roundChoices: [],
    currentAudioTime: 0,
    currentSegmentDurations: [],
    playerData: {},
    username: getStoredUsername(),
    modifierRates: [...MODIFIER_RATES],
    segmentDurations1: [...SEGMENT_DURATIONS_1],
    segmentDurations2: [...SEGMENT_DURATIONS_2],
    foundTracksIds: [],
    /** Track IDs already used this game (including the current round). */
    sessionTrackIds: [],
    /** Wrongs + timeouts this Vignettes session (for 20/20 perfect clears). */
    sessionWrongCount: 0,
    activeGenres: [...DEFAULT_ACTIVE_GENRES],
};

export function getDifficultyName() {
    return DIFFICULTYNAMES[gameState.difficultyLevel - 1];
}

/** Persistence key for scores / stats maps. */
export function getScoreKey() {
    if (isCodexMode()) {
        return 'Codex';
    }

    return 'Vignettes_' + getDifficultyName();
}

/** French label for end screen / UI. */
export function getDisplayLabel() {
    return SCORE_KEY_LABELS[getScoreKey()] || getScoreKey();
}

export function isHardcoreAudio() {
    return gameState.difficultyLevel >= 3;
}

/** Random clip start (Moyen+). */
export function usesRandomTrackStart() {
    return gameState.difficultyLevel >= 2;
}

/** Alternate cover variants among ID-prefixed images (Difficile+). */
export function usesAlternateCovers() {
    return gameState.difficultyLevel >= 3;
}

export function isImageAnswerMode() {
    return gameState.gameMode === GAME_MODE_VIGNETTES;
}

export function isCodexMode() {
    return gameState.gameMode === GAME_MODE_CODEX;
}

export function getClipDuration() {
    if (gameState.difficultyLevel === 1) {
        return DEFAULTTRACKDURATION;
    }
    if (gameState.difficultyLevel === 2) {
        return MOYENTRACKDURATION;
    }
    if (gameState.difficultyLevel === 3) {
        return DIFFICILETRACKDURATION;
    }
    return HARDCOREMODETRACKDURATION;
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
    gameState.foundTracksIds = [];
    gameState.sessionTrackIds = [];
    gameState.sessionWrongCount = 0;
}
