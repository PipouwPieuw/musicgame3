import {
    GAME_MODE_CLASSIQUE,
    SCORE_KEY_DIFFICULTY_LEVEL,
    VIGNETTES_DIFFICULTY_ENABLED,
    VIGNETTES_DIFFICULTY_UNLOCK_THRESHOLDS,
    VIGNETTES_UNLOCK_THRESHOLD,
} from '../config.js';
import { applyGameMode, updateDifficultyUI } from '../game/difficulty.js';
import { gameState, isImageAnswerMode } from '../game/state.js';

/** Set when unlock happens mid-session so the expand animation can play on return to settings. */
let pendingVignettesReveal = false;

export function isVignettesUnlocked(playerData) {
    return (playerData?.foundTracksIds?.length || 0) >= VIGNETTES_UNLOCK_THRESHOLD;
}

/**
 * Progressive difficulty unlock.
 * Disabled levels (VIGNETTES_DIFFICULTY_ENABLED) never unlock.
 * Thresholds live in VIGNETTES_DIFFICULTY_UNLOCK_THRESHOLDS for future progressive gates.
 */
export function isVignettesDifficultyUnlocked(level, playerData) {
    if (!VIGNETTES_DIFFICULTY_ENABLED[level]) {
        return false;
    }

    if (!isVignettesUnlocked(playerData)) {
        return false;
    }

    const threshold = VIGNETTES_DIFFICULTY_UNLOCK_THRESHOLDS[level];
    if (threshold == null || threshold <= 0) {
        return true;
    }

    return (playerData?.foundTracksIds?.length || 0) >= threshold;
}

/** Whether this score bucket is offered at all (ignores player unlock progress). */
export function isScoreKeyEnabled(scoreKey) {
    if (scoreKey === 'Classique') {
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
    if (scoreKey === 'Classique') {
        return true;
    }

    const level = SCORE_KEY_DIFFICULTY_LEVEL[scoreKey];
    if (level == null) {
        return false;
    }

    return isVignettesDifficultyUnlocked(level, playerData);
}

function forceClassiqueMode($) {
    const $classique = $('#gameModeClassique');
    if (!$classique.prop('checked')) {
        $classique.prop('checked', true);
    }
    applyGameMode(GAME_MODE_CLASSIQUE);
    updateDifficultyUI($, 'Classique');
}

function syncVignettesDifficultyRadios($) {
    $('.js-input-difficulty').each(function () {
        const level = parseInt($(this).val(), 10);
        const unlocked = isVignettesDifficultyUnlocked(level, gameState.playerData);
        $(this).prop('disabled', !unlocked);
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
        $option.addClass('is-locked').removeClass('settings_difficulty__option--new');
        $radio.prop('disabled', true);
        if ($radio.prop('checked') || isImageAnswerMode()) {
            forceClassiqueMode($);
        }
        syncVignettesDifficultyRadios($);
        return;
    }

    $radio.prop('disabled', false);
    syncVignettesDifficultyRadios($);

    const showNewHighlight = !gameState.playerData.hasSeenVignettesMode;
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
 * After endGame merges foundTracksIds: mark a pending reveal if this session crossed the threshold.
 */
export function markVignettesUnlockIfNeeded() {
    if (!isVignettesUnlocked(gameState.playerData)) {
        return;
    }

    const $option = $('.js-vignettes-option');
    if ($option.hasClass('is-locked')) {
        pendingVignettesReveal = true;
    }
}

export function lockVignettesMode($) {
    pendingVignettesReveal = false;
    const $option = $('.js-vignettes-option');
    const $radio = $('#gameModeVignettes');
    $option.addClass('is-locked').removeClass('settings_difficulty__option--new');
    $radio.prop('disabled', true);
    forceClassiqueMode($);
    syncVignettesDifficultyRadios($);
}

export function clearVignettesNewHighlight($) {
    $('.js-vignettes-option').removeClass('settings_difficulty__option--new');
}
