export const DEFAULT_COVER_PATH = 'assets/images/default.png';
export const NOT_FOUND_COVER_PATH = 'assets/images/not-found.png';

export const DEVMODE = false;
export const SHUFFLE = true;

export const GAME_MODE_CLASSIQUE = 'classique';
export const GAME_MODE_VIGNETTES = 'vignettes';

/** Difficulty ladder names (levels 1–5), used by Vignettes mode. */
export const DIFFICULTYNAMES = ['Normal', 'Difficile', 'Infernal', 'Extrême', 'Glitched'];

/** Persistence / stats / leaderboard keys (mode + optional difficulty). */
export const SCORE_KEYS = [
    'Classique',
    'Vignettes_Normal',
    'Vignettes_Difficile',
    'Vignettes_Infernal',
    'Vignettes_Extrême',
    'Vignettes_Glitched',
];

/** French display labels for SCORE_KEYS. */
export const SCORE_KEY_LABELS = {
    Classique: 'Classique',
    Vignettes_Normal: 'Vignettes — Normal',
    Vignettes_Difficile: 'Vignettes — Difficile',
    Vignettes_Infernal: 'Vignettes — Infernal',
    Vignettes_Extrême: 'Vignettes — Extrême',
    Vignettes_Glitched: 'Vignettes — Glitched',
};

/** Map legacy single-axis keys to SCORE_KEYS. */
export const LEGACY_SCORE_KEY_MAP = {
    Normal: 'Classique',
    Difficile: 'Vignettes_Normal',
    Infernal: 'Vignettes_Infernal',
    Extrême: 'Vignettes_Extrême',
    Glitched: 'Vignettes_Glitched',
};

export function migrateScoreKey(key) {
    if (SCORE_KEYS.indexOf(key) !== -1) {
        return key;
    }
    return LEGACY_SCORE_KEY_MAP[key] || key;
}

export function emptyScoreMap() {
    const map = {};
    for (const name of SCORE_KEYS) {
        map[name] = 0;
    }
    return map;
}

export function migrateStatMap(map) {
    const result = emptyScoreMap();
    if (!map) {
        return result;
    }

    for (const key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) {
            continue;
        }
        const newKey = migrateScoreKey(key);
        if (SCORE_KEYS.indexOf(newKey) === -1) {
            continue;
        }
        result[newKey] = (result[newKey] || 0) + (map[key] || 0);
    }

    return result;
}

export function migrateScoresList(scores) {
    if (!scores || !scores.length) {
        return [];
    }

    return scores.map(function (entry) {
        if (!entry || !entry.length) {
            return entry;
        }
        const next = entry.slice();
        next[0] = migrateScoreKey(entry[0]);
        return next;
    });
}

export const MINSTREAK = 3;
export const DEFAULTTRACKSBYGAME = 20;
export const DEFAULTTRACKDURATION = 30;
export const DIFFICILETRACKDURATION = 10;
export const HARDCOREMODETRACKDURATION = 5;
export const IMAGE_ANSWER_COUNT = 8;
export const POINTSBYANSWER = 1;
export const VIGNETTES_UNLOCK_THRESHOLD = 20;

/**
 * Which Vignettes difficulty levels are currently offered (1-indexed).
 * Disabled levels stay out of settings, stats, and leaderboard until re-enabled.
 */
export const VIGNETTES_DIFFICULTY_ENABLED = {
    1: true,
    2: true,
    3: false,
    4: false,
    5: false,
};

/**
 * Placeholder for progressive Vignettes difficulty unlocks.
 * Currently levels 1–3 unlock with the mode (threshold 0); 4–5 stay disabled via VIGNETTES_DIFFICULTY_ENABLED.
 * Values are found-track thresholds (same unit as VIGNETTES_UNLOCK_THRESHOLD).
 */
export const VIGNETTES_DIFFICULTY_UNLOCK_THRESHOLDS = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
};

/** Maps SCORE_KEYS to Vignettes difficulty level (null = Classique / no ladder). */
export const SCORE_KEY_DIFFICULTY_LEVEL = {
    Classique: null,
    Vignettes_Normal: 1,
    Vignettes_Difficile: 2,
    Vignettes_Infernal: 3,
    Vignettes_Extrême: 4,
    Vignettes_Glitched: 5,
};

export const MODIFIER_RATES = [0.25, 0.33, 0.5, 0.66, 0.75, 0.87, 1, 1.25, 1.5, 2, 2.25, 2.5, 2.75, 3, 1];
export const SEGMENT_DURATIONS_1 = [0.5, 1, 1.5, 2];
export const SEGMENT_DURATIONS_2 = [0.5, 1];
