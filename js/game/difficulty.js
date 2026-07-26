import { GAME_MODE_CODEX, GAME_MODE_VIGNETTES, SEGMENT_DURATIONS_1 } from '../config.js';
import { gameState, getDisplayLabel, isCodexMode, isImageAnswerMode } from './state.js';

/**
 * Apply difficulty ladder (audio, multiplier, glitch).
 * Answer UI (typed vs vignettes) is driven by gameMode via updateAnswerModeUI.
 */
export function applyDifficulty(level) {
    const difficultyLevel = parseInt(level, 10);
    gameState.difficultyLevel = difficultyLevel;

    if (isCodexMode()) {
        gameState.pointsMultiplier = 1;
    } else {
        gameState.pointsMultiplier = difficultyLevel;
    }

    const audioPlayer = document.getElementById('audio_player');
    const audioPlayerHardcore = document.getElementById('audio_player_hardcore');

    audioPlayer.volume = difficultyLevel < 4 ? 1 : 0;
    audioPlayerHardcore.volume = difficultyLevel < 4 ? 0 : 1;

    // document.body.classList.toggle('glitched', difficultyLevel === 4);

    if (difficultyLevel >= 4) {
        gameState.currentSegmentDurations = [...SEGMENT_DURATIONS_1];
    }
}

export function applyGameMode(mode) {
    gameState.gameMode = mode === GAME_MODE_VIGNETTES ? GAME_MODE_VIGNETTES : GAME_MODE_CODEX;

    if (isCodexMode()) {
        applyDifficulty(1);
    } else {
        applyDifficulty(gameState.difficultyLevel || 1);
    }
}

export function updateAnswerModeUI($) {
    if (isImageAnswerMode()) {
        $('.js-answer-form').addClass('visually_hidden');
        $('.js-answers').removeClass('visually_hidden');
    } else {
        $('.js-answer-form').removeClass('visually_hidden');
        $('.js-answers').addClass('visually_hidden');
    }

    $('.js-skip-round').toggleClass('visually_hidden', !isCodexMode());
}

export function updateDifficultyUI($, displayLabel) {
    const label = displayLabel || getDisplayLabel();
    $('.js-difficulty').text(label);
    $('.js-difficulty').attr('data-difficulty', gameState.difficultyLevel);
    $('.js-difficulty').attr('data-game-mode', gameState.gameMode);

    $('.js-mode-details').removeClass('visible');
    $('.js-mode-details-' + gameState.gameMode).addClass('visible');

    const $difficultySettings = $('.js-difficulty-settings');
    if (isImageAnswerMode()) {
        $difficultySettings.removeClass('is-hidden');
        $('.js-difficulty-details').removeClass('visible');
        $('.js-difficulty-details-' + gameState.difficultyLevel).addClass('visible');
    } else {
        $difficultySettings.addClass('is-hidden');
        $('.js-difficulty-details').removeClass('visible');
    }

    $('.js-multiplicator').text(gameState.pointsMultiplier);
    $('.js-multiplicator-wrapper').attr('data-value', gameState.pointsMultiplier);
    $('.js-track-cover').removeClass('hidden');

    $('.js-like-button').toggleClass('visually_hidden', gameState.difficultyLevel > 2);
    updateAnswerModeUI($);
}
