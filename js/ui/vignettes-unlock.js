import { VIGNETTES_UNLOCK_THRESHOLD } from '../config.js';
import { applyDifficulty, updateDifficultyUI } from '../game/difficulty.js';
import { gameState } from '../game/state.js';

/** Set when unlock happens mid-session so the expand animation can play on return to settings. */
let pendingVignettesReveal = false;

export function isVignettesUnlocked(playerData) {
    return (playerData?.foundTracksIds?.length || 0) >= VIGNETTES_UNLOCK_THRESHOLD;
}

function forceClassiqueMode($) {
    const $classique = $('#difficultyLevel1');
    if (!$classique.prop('checked')) {
        $classique.prop('checked', true);
    }
    applyDifficulty(1);
    updateDifficultyUI($, 'Classique');
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
    const $radio = $('#difficultyLevel2');
    const unlocked = isVignettesUnlocked(gameState.playerData);

    if (!unlocked) {
        pendingVignettesReveal = false;
        $option.addClass('is-locked').removeClass('settings_difficulty__option--new');
        $radio.prop('disabled', true);
        if ($radio.prop('checked') || gameState.difficultyLevel === 2) {
            forceClassiqueMode($);
        }
        return;
    }

    $radio.prop('disabled', false);

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
    const $radio = $('#difficultyLevel2');
    $option.addClass('is-locked').removeClass('settings_difficulty__option--new');
    $radio.prop('disabled', true);
    forceClassiqueMode($);
}

export function clearVignettesNewHighlight($) {
    $('.js-vignettes-option').removeClass('settings_difficulty__option--new');
}
