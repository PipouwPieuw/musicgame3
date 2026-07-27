export const DEFAULT_COVER_PATH = 'assets/images/default.png';
export const NOT_FOUND_COVER_PATH = 'assets/images/not-found.png';
export const COVERS_MANIFEST_PATH = 'assets/covers/manifest.json';

export const DEVMODE = false;
export const SHUFFLE = true;

export const GAME_MODE_CODEX = 'codex';
export const GAME_MODE_VIGNETTES = 'vignettes';

/** Key in playerData.seenUnlocks for the Vignettes mode “débloqué” tooltip. */
export const SEEN_UNLOCK_VIGNETTES = 'vignettes';

/** Difficulty ladder names (levels 1–4), used by Vignettes mode. */
export const DIFFICULTYNAMES = ['Facile', 'Moyen', 'Difficile', 'Glitched'];

/** Persistence / stats / leaderboard keys (mode + optional difficulty). */
export const SCORE_KEYS = [
    'Codex',
    'Vignettes_Facile',
    'Vignettes_Moyen',
    'Vignettes_Difficile',
    'Vignettes_Glitched',
];

/** Score keys that appear on Classement (points boards). Codex is discovery-only. */
export const LEADERBOARD_SCORE_KEYS = SCORE_KEYS.filter(function (key) {
    return key !== 'Codex';
});

/** French display labels for SCORE_KEYS. */
export const SCORE_KEY_LABELS = {
    Codex: 'Codex',
    Vignettes_Facile: 'Vignettes — Facile',
    Vignettes_Moyen: 'Vignettes — Moyen',
    Vignettes_Difficile: 'Vignettes — Difficile',
    Vignettes_Glitched: 'Vignettes — Glitched',
};

/**
 * UI grouping for Classement: mode label, then optional difficulty labels.
 * Persistence still uses flat SCORE_KEYS; Codex is omitted (no points board).
 */
export const SCORE_KEY_GROUPS = [
    {
        modeLabel: 'Vignettes',
        keys: [
            { key: 'Vignettes_Facile', difficultyLabel: 'Facile' },
            { key: 'Vignettes_Moyen', difficultyLabel: 'Moyen' },
            { key: 'Vignettes_Difficile', difficultyLabel: 'Difficile' },
            { key: 'Vignettes_Glitched', difficultyLabel: 'Glitched' },
        ],
    },
];

/**
 * Renames for keys that no longer exist as SCORE_KEYS.
 * Vignettes_Difficile is NOT listed here: it now means the new 5s mode.
 * Old 10s Difficile → Moyen is a one-shot remap (see remapOldDifficile).
 */
const SCORE_KEY_RENAMES = {
    Classique: 'Codex',
    Vignettes_Normal: 'Vignettes_Facile',
};

/** Dropped Vignettes keys (Infernal / Extrême) — filtered out of stats/scores. */
const DROPPED_SCORE_KEYS = {
    Vignettes_Infernal: true,
    Vignettes_Extrême: true,
};

/**
 * Marker in seenUnlocks: legacy Codex/Classique point score tuples were purged.
 * After this flag, new Codex score rows store identified-track counts (not points).
 */
export const SEEN_UNLOCK_CODEX_NO_POINTS = '__codex_no_points';

/**
 * Marker in seenUnlocks: Facile/Moyen/Difficile/Glitched ladder migration applied.
 * After this flag is set, Vignettes_Difficile means the new 5s difficulty.
 */
export const SEEN_UNLOCK_LADDER_V2 = '__ladder_v2';

/**
 * Marker in seenUnlocks: scoring v2 applied (base + streak cap + speed; Vignettes scores purged).
 * After this flag, unlocks use perfectClears (20/20) instead of numeric perfect scores.
 */
export const SEEN_UNLOCK_SCORING_V2 = '__scoring_v2';

/** Map legacy single-axis keys to SCORE_KEYS. */
export const LEGACY_SCORE_KEY_MAP = {
    Normal: 'Codex',
    Difficile: 'Vignettes_Facile',
    Infernal: 'Vignettes_Infernal',
    Extrême: 'Vignettes_Extrême',
    Glitched: 'Vignettes_Glitched',
};

function collectScoreMapKeys(map) {
    if (!map || typeof map !== 'object') {
        return [];
    }
    return Object.keys(map);
}

function collectScoresListKeys(scores) {
    const keys = [];
    if (!scores || !scores.length) {
        return keys;
    }
    for (let i = 0; i < scores.length; i++) {
        const entry = scores[i];
        if (entry && entry.length) {
            keys.push(entry[0]);
        }
    }
    return keys;
}

/** True when profile still has pre-rename Vignettes_Normal rows (old Facile). */
export function shouldRemapOldDifficileToMoyen(profile) {
    if (profile?.seenUnlocks && profile.seenUnlocks[SEEN_UNLOCK_LADDER_V2]) {
        return false;
    }
    const keys = collectScoreMapKeys(profile?.games_played)
        .concat(collectScoreMapKeys(profile?.good_answers))
        .concat(collectScoreMapKeys(profile?.wrong_answers))
        .concat(collectScoresListKeys(profile?.scores));
    return keys.indexOf('Vignettes_Normal') !== -1;
}

export function migrateScoreKey(key) {
    if (Object.prototype.hasOwnProperty.call(SCORE_KEY_RENAMES, key)) {
        return SCORE_KEY_RENAMES[key];
    }
    if (DROPPED_SCORE_KEYS[key]) {
        return null;
    }
    if (SCORE_KEYS.indexOf(key) !== -1) {
        return key;
    }
    const legacy = LEGACY_SCORE_KEY_MAP[key];
    if (legacy) {
        if (DROPPED_SCORE_KEYS[legacy]) {
            return null;
        }
        if (Object.prototype.hasOwnProperty.call(SCORE_KEY_RENAMES, legacy)) {
            return SCORE_KEY_RENAMES[legacy];
        }
        return legacy;
    }
    return key;
}

export function emptyScoreMap() {
    const map = {};
    for (const name of SCORE_KEYS) {
        map[name] = 0;
    }
    return map;
}

/**
 * @param {object} map
 * @param {{ remapOldDifficile?: boolean }} [options]
 */
export function migrateStatMap(map, options) {
    const result = emptyScoreMap();
    if (!map) {
        return result;
    }

    const remapOldDifficile = Boolean(options && options.remapOldDifficile);

    for (const key in map) {
        if (!Object.prototype.hasOwnProperty.call(map, key)) {
            continue;
        }
        let newKey;
        if (key === 'Vignettes_Difficile' && remapOldDifficile) {
            newKey = 'Vignettes_Moyen';
        } else {
            newKey = migrateScoreKey(key);
        }
        if (!newKey || SCORE_KEYS.indexOf(newKey) === -1) {
            continue;
        }
        result[newKey] = (result[newKey] || 0) + (map[key] || 0);
    }

    return result;
}

/**
 * @param {Array} scores
 * @param {{ remapOldDifficile?: boolean, purgeCodexPointScores?: boolean, purgeVignettesScores?: boolean }} [options]
 */
export function migrateScoresList(scores, options) {
    if (!scores || !scores.length) {
        return [];
    }

    const remapOldDifficile = Boolean(options && options.remapOldDifficile);
    const purgeCodexPointScores = Boolean(options && options.purgeCodexPointScores);
    const purgeVignettesScores = Boolean(options && options.purgeVignettesScores);

    const migrated = [];
    for (let i = 0; i < scores.length; i++) {
        const entry = scores[i];
        if (!entry || !entry.length) {
            continue;
        }
        const next = entry.slice();
        let key = next[0];
        if (key === 'Vignettes_Difficile' && remapOldDifficile) {
            key = 'Vignettes_Moyen';
        } else {
            key = migrateScoreKey(key);
        }
        if (!key || SCORE_KEYS.indexOf(key) === -1) {
            continue;
        }
        // One-shot: drop legacy Codex/Classique/Normal point rows before identified-count era.
        if (purgeCodexPointScores && key === 'Codex') {
            continue;
        }
        // One-shot scoring v2: drop Vignettes point rows (incomparable under new formula).
        if (purgeVignettesScores && key !== 'Codex') {
            continue;
        }
        next[0] = key;
        migrated.push(next);
    }
    return migrated;
}

/**
 * Legacy perfect score (pre-scoring-v2): base 1, uncapped streak, × difficulty level.
 * Used only to seed perfectClears during the scoring-v2 migration.
 */
export function computeLegacyPerfectScore(tracksByGame, pointsMultiplier = 1) {
    let score = 0;
    let streak = 0;
    for (let i = 0; i < tracksByGame; i++) {
        streak += 1;
        const streakBonus = streak - MINSTREAK >= 0 ? streak - MINSTREAK + 1 : 0;
        score += (1 + streakBonus) * pointsMultiplier;
    }
    return score;
}

/**
 * From legacy Vignettes score tuples, mark keys that had a full-length perfect run.
 * @param {Array} scores - already key-migrated list
 * @param {object} [existing]
 * @returns {object} perfectClears map (true flags only matter)
 */
export function seedPerfectClearsFromLegacyScores(scores, existing) {
    const perfectClears = {};
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        for (const key of Object.keys(existing)) {
            if (existing[key]) {
                perfectClears[key] = true;
            }
        }
    }

    if (!scores || !scores.length) {
        return perfectClears;
    }

    for (let i = 0; i < scores.length; i++) {
        const entry = scores[i];
        if (!entry || entry.length < 3) {
            continue;
        }
        const key = entry[0];
        const level = SCORE_KEY_DIFFICULTY_LEVEL[key];
        if (level == null) {
            continue;
        }
        if (entry[1] === DEFAULTTRACKSBYGAME && entry[2] === computeLegacyPerfectScore(DEFAULTTRACKSBYGAME, level)) {
            perfectClears[key] = true;
        }
    }

    return perfectClears;
}

/**
 * Normalize perfectClears to a plain object of truthy flags.
 * @param {object} [map]
 * @returns {object}
 */
export function migratePerfectClearsMap(map) {
    const result = {};
    if (!map || typeof map !== 'object' || Array.isArray(map)) {
        return result;
    }
    for (const key of Object.keys(map)) {
        if (map[key] && SCORE_KEYS.indexOf(key) !== -1 && key !== 'Codex') {
            result[key] = true;
        }
    }
    return result;
}

/**
 * Migrate seenUnlocks difficulty keys.
 * Before the ladder-v2 flag: remaps old level-2 key Vignettes_Difficile → Vignettes_Moyen
 * so the new Difficile unlock tooltip can show. After the flag: keeps Vignettes_Difficile
 * (new difficulty dismissals). Drops Infernal/Extrême. Preserves internal flags.
 */
export function migrateSeenUnlocksMap(seenUnlocks, legacyHasSeenVignettes) {
    const map = {};
    const ladderV2Done = Boolean(
        seenUnlocks &&
            typeof seenUnlocks === 'object' &&
            !Array.isArray(seenUnlocks) &&
            seenUnlocks[SEEN_UNLOCK_LADDER_V2]
    );

    if (seenUnlocks && typeof seenUnlocks === 'object' && !Array.isArray(seenUnlocks)) {
        for (const key of Object.keys(seenUnlocks)) {
            if (!seenUnlocks[key]) {
                continue;
            }
            let nextKey = key;
            if (key === 'Vignettes_Normal') {
                nextKey = 'Vignettes_Facile';
            } else if (key === 'Vignettes_Difficile' && !ladderV2Done) {
                // Old level-2 (now Moyen) used this key for the unlock tooltip.
                nextKey = 'Vignettes_Moyen';
            } else if (key === 'Vignettes_Infernal' || key === 'Vignettes_Extrême') {
                continue;
            }
            map[nextKey] = true;
        }
    }
    if (legacyHasSeenVignettes && !map.vignettes) {
        map.vignettes = true;
    }
    return map;
}

/** Soft login keyword length bounds (plaintext ownership check, not real auth). */
export const KEYWORD_MIN_LENGTH = 4;
export const KEYWORD_MAX_LENGTH = 128;

export const MINSTREAK = 3;
/** Max additive streak bonus; at cap, base points are doubled (hot streak). */
export const MAX_STREAK_BONUS = 5;
export const DEFAULT_ACTIVE_GENRES = ['shows2000'];
/** Legacy default (Facile / historical scores). Prefer STANDARD_TRACKS_BY_SCORE_KEY for new logic. */
export const DEFAULTTRACKSBYGAME = 20;
/**
 * Standard round counts by score key.
 * Codex: null = use full current pool (unfound playable in selected genre).
 */
export const STANDARD_TRACKS_BY_SCORE_KEY = {
    Codex: null,
    Vignettes_Facile: 20,
    Vignettes_Moyen: 40,
    Vignettes_Difficile: 40,
    Vignettes_Glitched: 60,
};

/**
 * Resolve how many tracks a game should use for a score key, clamped to pool size.
 * @param {string} scoreKey
 * @param {number} poolSize
 * @returns {number}
 */
export function getStandardTracksByGame(scoreKey, poolSize) {
    const configured = STANDARD_TRACKS_BY_SCORE_KEY[scoreKey];
    if (configured == null) {
        return poolSize;
    }
    return Math.min(configured, poolSize);
}

export const DEFAULTTRACKDURATION = 30;
export const MOYENTRACKDURATION = 20;
export const DIFFICILETRACKDURATION = 10;
// export const HARDCOREMODETRACKDURATION = 5;
export const HARDCOREMODETRACKDURATION = 10;
export const IMAGE_ANSWER_COUNT = 8;
/** Base points per correct answer by Vignettes difficulty level (1-indexed). */
export const POINTS_BASE_BY_DIFFICULTY = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
};
/**
 * Speed bonus from remaining time fraction of the round limit.
 * First matching threshold (highest first) wins; otherwise 0.
 */
export const SPEED_BONUS_THRESHOLDS = [
    { minRemainingRatio: 0.75, bonus: 3 },
    { minRemainingRatio: 0.5, bonus: 2 },
    { minRemainingRatio: 0.25, bonus: 1 },
];
export const VIGNETTES_UNLOCK_THRESHOLD = 20;
export const VIGNETTES_MIN_TRACKS_BY_GAME = 20;

/**
 * Which Vignettes difficulty levels are currently offered (1-indexed).
 * Disabled levels stay out of settings, stats, and leaderboard until re-enabled.
 */
export const VIGNETTES_DIFFICULTY_ENABLED = {
    1: true,
    2: true,
    3: true,
    4: true,
};

/**
 * Unlock conditions per Vignettes difficulty level (1-indexed).
 * null = unlocked once the mode is unlocked (and ENABLED).
 * perfectClearOnPrevious = full standard length for that difficulty
 * (STANDARD_TRACKS_BY_SCORE_KEY, zero wrongs) on the previous difficulty.
 */
export const VIGNETTES_DIFFICULTY_UNLOCK = {
    1: null,
    2: { type: 'perfectClearOnPrevious' },
    3: { type: 'perfectClearOnPrevious' },
    4: { type: 'perfectClearOnPrevious' },
};

/** Maps SCORE_KEYS to Vignettes difficulty level (null = Codex / no ladder). */
export const SCORE_KEY_DIFFICULTY_LEVEL = {
    Codex: null,
    Vignettes_Facile: 1,
    Vignettes_Moyen: 2,
    Vignettes_Difficile: 3,
    Vignettes_Glitched: 4,
};

export const MODIFIER_RATES = [0.25, 0.33, 0.5, 0.66, 0.75, 0.87, 1, 1.25, 1.5, 2, 2.25, 2.5, 2.75, 3, 1];
export const SEGMENT_DURATIONS_1 = [0.5, 1, 1.5, 2];
export const SEGMENT_DURATIONS_2 = [0.5, 1];
