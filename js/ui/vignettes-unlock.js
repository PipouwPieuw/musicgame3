import {
    DEFAULTTRACKSBYGAME,
    DIFFICULTYNAMES,
    SCORE_KEY_DIFFICULTY_LEVEL,
    SEEN_UNLOCK_VIGNETTES,
    VIGNETTES_DIFFICULTY_ENABLED,
    VIGNETTES_DIFFICULTY_UNLOCK,
    VIGNETTES_UNLOCK_THRESHOLD,
} from '../config.js';
import { applyDifficulty, updateDifficultyUI } from '../game/difficulty.js';
import { computePerfectScore } from '../game/scoring.js';
import { gameState, isImageAnswerMode } from '../game/state.js';

/** Set when unlock happens mid-session so the expand animation can play on return to settings. */
let pendingVignettesReveal = false;

/** Difficulty options that crossed the unlock gate this session (for reveal on return to settings). */
let pendingDifficultyRevealLevels = [];

export function isVignettesUnlocked(playerData) {
    return (playerData?.foundTracksIds?.length || 0) >= VIGNETTES_UNLOCK_THRESHOLD;
}

export function getVignettesScoreKeyForLevel(level) {
    const name = DIFFICULTYNAMES[level - 1];
    if (!name) {
        return null;
    }
    return 'Vignettes_' + name;
}

export function hasSeenUnlock(playerData, unlockKey) {
    return Boolean(playerData?.seenUnlocks && playerData.seenUnlocks[unlockKey]);
}

/** Mark an unlock tooltip as dismissed. Returns true if the flag changed. */
export function setUnlockSeen(playerData, unlockKey) {
    if (!playerData || !unlockKey) {
        return false;
    }
    if (!playerData.seenUnlocks) {
        playerData.seenUnlocks = {};
    }
    if (playerData.seenUnlocks[unlockKey]) {
        return false;
    }
    playerData.seenUnlocks[unlockKey] = true;
    return true;
}

/**
 * Whether the player has a full-length perfect run stored for this score key.
 * Uses DEFAULTTRACKSBYGAME and the Vignettes difficulty multiplier (level === multiplier).
 */
export function hasPerfectScoreForKey(playerData, scoreKey) {
    const level = SCORE_KEY_DIFFICULTY_LEVEL[scoreKey];
    if (level == null) {
        return false;
    }

    const perfect = computePerfectScore(DEFAULTTRACKSBYGAME, level);
    const scores = playerData?.scores || [];
    for (let i = 0; i < scores.length; i++) {
        const entry = scores[i];
        if (entry[0] === scoreKey && entry[1] === DEFAULTTRACKSBYGAME && entry[2] === perfect) {
            return true;
        }
    }
    return false;
}

function meetsUnlockCondition(condition, level, playerData) {
    if (condition == null) {
        return true;
    }

    if (condition.type === 'perfectScoreOnPrevious') {
        const previousKey = getVignettesScoreKeyForLevel(level - 1);
        if (!previousKey) {
            return false;
        }
        return hasPerfectScoreForKey(playerData, previousKey);
    }

    return false;
}

/**
 * Progressive difficulty unlock.
 * Disabled levels (VIGNETTES_DIFFICULTY_ENABLED) never unlock.
 * Conditions live in VIGNETTES_DIFFICULTY_UNLOCK.
 */
export function isVignettesDifficultyUnlocked(level, playerData) {
    if (!VIGNETTES_DIFFICULTY_ENABLED[level]) {
        return false;
    }

    if (!isVignettesUnlocked(playerData)) {
        return false;
    }

    return meetsUnlockCondition(VIGNETTES_DIFFICULTY_UNLOCK[level], level, playerData);
}

/** Whether this score bucket is offered at all (ignores player unlock progress). */
export function isScoreKeyEnabled(scoreKey) {
    if (scoreKey === 'Codex') {
        return true;
    }

    const level = SCORE_KEY_DIFFICULTY_LEVEL[scoreKey];
    if (level == null) {
        return false;
    }

    return Boolean(VIGNETTES_DIFFICULTY_ENABLED[level]);
}

/** Whether the logged-in player may see this score bucket in the leaderboard. */
export function isScoreKeyUnlocked(scoreKey, playerData) {
    if (scoreKey === 'Codex') {
        return true;
    }

    const level = SCORE_KEY_DIFFICULTY_LEVEL[scoreKey];
    if (level == null) {
        return false;
    }

    return isVignettesDifficultyUnlocked(level, playerData);
}

function forceCodexMode($) {
    const $codex = $('#gameModeCodex');
    $codex.prop('checked', true);
    // Trigger change so app.js reloads the Codex (single-genre) catalog and syncs genre UI.
    $codex.trigger('change');
}

function forceNormalDifficulty($) {
    const $normal = $('#difficultyLevel1');
    if (!$normal.prop('checked')) {
        $normal.prop('checked', true);
    }
    applyDifficulty(1);
    updateDifficultyUI($);
}

function syncDifficultyNewHighlight($option, level) {
    const scoreKey = getVignettesScoreKeyForLevel(level);
    // Normal has no unlock tooltip; only gated difficulties (wrapped options) do.
    const showNew = Boolean(scoreKey && !hasSeenUnlock(gameState.playerData, scoreKey));
    $option.toggleClass('settings_difficulty__option--new', showNew);
}

function syncVignettesDifficultyRadios($, options) {
    const animate = Boolean(options && options.animate);

    $('.js-input-difficulty').each(function () {
        const level = parseInt($(this).val(), 10);
        const unlocked = isVignettesDifficultyUnlocked(level, gameState.playerData);
        const $radio = $(this);
        const $option = $radio.closest('.js-difficulty-option');

        $radio.prop('disabled', !unlocked);

        if (!$option.length) {
            return;
        }

        if (!unlocked) {
            $option.addClass('is-locked').removeClass('settings_difficulty__option--new');
            if ($radio.prop('checked')) {
                forceNormalDifficulty($);
            }
            return;
        }

        const pendingIndex = pendingDifficultyRevealLevels.indexOf(level);
        if (animate && pendingIndex !== -1) {
            pendingDifficultyRevealLevels.splice(pendingIndex, 1);
            $option.addClass('is-locked');
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    $option.removeClass('is-locked');
                    syncDifficultyNewHighlight($option, level);
                });
            });
            return;
        }

        $option.removeClass('is-locked');
        syncDifficultyNewHighlight($option, level);
    });
}

/**
 * Sync Vignettes radio visibility with player progress.
 * @param {JQueryStatic} $
 * @param {{ animate?: boolean }} [options]
 *   - animate: when true and newly unlocked, keep locked for one frame then expand
 */
export function syncVignettesModeUnlock($, options) {
    const animate = Boolean(options && options.animate);
    const $option = $('.js-vignettes-option');
    const $radio = $('#gameModeVignettes');
    const unlocked = isVignettesUnlocked(gameState.playerData);

    if (!unlocked) {
        pendingVignettesReveal = false;
        pendingDifficultyRevealLevels = [];
        $option.addClass('is-locked').removeClass('settings_difficulty__option--new');
        $radio.prop('disabled', true);
        if ($radio.prop('checked') || isImageAnswerMode()) {
            forceCodexMode($);
        }
        syncVignettesDifficultyRadios($, options);
        return;
    }

    $radio.prop('disabled', false);
    syncVignettesDifficultyRadios($, options);

    const showNewHighlight = !hasSeenUnlock(gameState.playerData, SEEN_UNLOCK_VIGNETTES);
    $option.toggleClass('settings_difficulty__option--new', showNewHighlight);

    if (animate && pendingVignettesReveal) {
        pendingVignettesReveal = false;
        $option.addClass('is-locked');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                $option.removeClass('is-locked');
            });
        });
        return;
    }

    $option.removeClass('is-locked');
}

/**
 * After endGame merges foundTracksIds / scores: mark pending reveals if this session crossed a gate.
 */
export function markVignettesUnlockIfNeeded() {
    if (!isVignettesUnlocked(gameState.playerData)) {
        return;
    }

    const $option = $('.js-vignettes-option');
    if ($option.hasClass('is-locked')) {
        pendingVignettesReveal = true;
    }

    $('.js-difficulty-option').each(function () {
        const level = parseInt($(this).attr('data-difficulty-level'), 10);
        if (!level || !$(this).hasClass('is-locked')) {
            return;
        }
        if (isVignettesDifficultyUnlocked(level, gameState.playerData)) {
            if (pendingDifficultyRevealLevels.indexOf(level) === -1) {
                pendingDifficultyRevealLevels.push(level);
            }
        }
    });
}

export function lockVignettesMode($) {
    pendingVignettesReveal = false;
    pendingDifficultyRevealLevels = [];
    const $option = $('.js-vignettes-option');
    const $radio = $('#gameModeVignettes');
    $option.addClass('is-locked').removeClass('settings_difficulty__option--new');
    $radio.prop('disabled', true);
    forceCodexMode($);
    syncVignettesDifficultyRadios($);
}

export function clearUnlockNewHighlight($, unlockKey) {
    if (unlockKey === SEEN_UNLOCK_VIGNETTES) {
        $('.js-vignettes-option').removeClass('settings_difficulty__option--new');
        return;
    }

    $('.js-difficulty-option').each(function () {
        const level = parseInt($(this).attr('data-difficulty-level'), 10);
        if (getVignettesScoreKeyForLevel(level) === unlockKey) {
            $(this).removeClass('settings_difficulty__option--new');
        }
    });
}
