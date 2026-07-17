import { SEGMENT_DURATIONS_1 } from '../config.js';
import { gameState, isClassicMode } from './state.js';

export function applyDifficulty(level) {
    const difficultyLevel = parseInt(level, 10);
    gameState.difficultyLevel = difficultyLevel;
    // gameState.pointsMultiplier = difficultyLevel;
    gameState.pointsMultiplier = 1;

    const audioPlayer = document.getElementById('audio_player');
    const audioPlayerHardcore = document.getElementById('audio_player_hardcore');
    const answerForm = document.getElementById('answer_form');

    audioPlayer.volume = difficultyLevel < 5 ? 1 : 0;
    audioPlayerHardcore.volume = difficultyLevel < 5 ? 0 : 1;

    answerForm.classList.toggle('visually_hidden', difficultyLevel > 1);

    document.body.classList.toggle('glitched', difficultyLevel === 5);

    if (difficultyLevel >= 5) {
        gameState.currentSegmentDurations = [...SEGMENT_DURATIONS_1];
    }
}

export function updateAnswerModeUI($) {
    if (gameState.difficultyLevel === 2) {
        $('.js-answer-form').addClass('visually_hidden');
        $('.js-answers').removeClass('visually_hidden');
    } else {
        $('.js-answer-form').removeClass('visually_hidden');
        $('.js-answers').addClass('visually_hidden');
    }

    $('.js-skip-round').toggleClass('visually_hidden', !isClassicMode());
}

export function updateDifficultyUI($, difficultyName) {
    $('.js-difficulty').text(difficultyName);
    $('.js-difficulty').attr('data-difficulty', gameState.difficultyLevel);
    $('.js-difficulty-details').removeClass('visible');
    $('.js-difficulty-details-' + gameState.difficultyLevel).addClass('visible');
    $('.js-multiplicator').text(gameState.pointsMultiplier);
    $('.js-multiplicator-wrapper').attr('data-value', gameState.pointsMultiplier);
    $('.js-track-cover').removeClass('hidden');

    $('.js-like-button').toggleClass('visually_hidden', gameState.difficultyLevel > 2);
    updateAnswerModeUI($);
}
