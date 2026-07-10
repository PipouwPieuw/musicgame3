import { SEGMENT_DURATIONS_1 } from '../config.js';
import { gameState } from './state.js';

export function applyDifficulty(level) {
    const difficultyLevel = parseInt(level, 10);
    gameState.difficultyLevel = difficultyLevel;
    gameState.pointsMultiplier = difficultyLevel;

    const audioPlayer = document.getElementById('audio_player');
    const audioPlayerHardcore = document.getElementById('audio_player_hardcore');

    audioPlayer.volume = difficultyLevel < 5 ? 1 : 0;
    audioPlayerHardcore.volume = difficultyLevel < 5 ? 0 : 1;

    document.body.classList.toggle('glitched', difficultyLevel === 5);

    if (difficultyLevel >= 5) {
        gameState.currentSegmentDurations = [...SEGMENT_DURATIONS_1];
    }
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
}
