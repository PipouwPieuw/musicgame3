import { MINSTREAK, POINTSBYANSWER } from '../config.js';
import { shuffleArray } from '../lib/shuffle.js';
import { animateCorrectAnswer } from '../ui/answer-reveal.js';
import { getRoundDuration } from './audio-player.js';
import { gameState, getScoreKey } from './state.js';

const soundRight = new Audio('assets/sounds/right.m4a');
soundRight.volume = 0.5;
const soundWrong = new Audio('assets/sounds/wrong.m4a');

/**
 * Max score for an unbroken correct run of `tracksByGame` answers.
 * Matches incrementStreak / applyCorrectAnswer (20 tracks at ×1 → 191).
 */
export function computePerfectScore(tracksByGame, pointsMultiplier = 1) {
    let score = 0;
    let streak = 0;
    for (let i = 0; i < tracksByGame; i++) {
        streak += 1;
        const streakBonus = streak - MINSTREAK >= 0 ? streak - MINSTREAK + 1 : 0;
        score += (POINTSBYANSWER + streakBonus) * pointsMultiplier;
    }
    return score;
}

export function playSound(soundElem) {
    soundElem.currentTime = 0;
    soundElem.play();
}

export function playCorrectSound() {
    playSound(soundRight);
}

export function playWrongSound() {
    playSound(soundWrong);
}

export function resetStreak($) {
    gameState.streak = 0;
    gameState.streakBonus = 0;
    $('.js-streak-wrapper').removeClass('active');
    $('.js-streak').text('');
}

export function incrementStreak() {
    gameState.streak += 1;
    gameState.streakBonus = gameState.streak - MINSTREAK >= 0 ? gameState.streak - MINSTREAK + 1 : 0;
}

export function recordGoodAnswer() {
    const scoreKey = getScoreKey();
    if (!(scoreKey in gameState.playerData.good_answers) || gameState.playerData.good_answers[scoreKey] == null) {
        gameState.playerData.good_answers[scoreKey] = 0;
    }
    gameState.playerData.good_answers[scoreKey] += 1;
}

export function recordWrongAnswer() {
    const scoreKey = getScoreKey();
    if (!(scoreKey in gameState.playerData.wrong_answers) || gameState.playerData.wrong_answers[scoreKey] == null) {
        gameState.playerData.wrong_answers[scoreKey] = 0;
    }
    gameState.playerData.wrong_answers[scoreKey] += 1;
}

export function applyCorrectAnswer($) {
    incrementStreak();
    const scoreIncrement = (POINTSBYANSWER + gameState.streakBonus) * gameState.pointsMultiplier;
    gameState.score += scoreIncrement;

    if (gameState.streakBonus > 0) {
        $('.js-streak-wrapper').addClass('active');
    }
    $('.js-streak').text(gameState.streakBonus > 0 ? gameState.streakBonus : '');
    updateScoreUI($, POINTSBYANSWER * gameState.pointsMultiplier);
    recordGoodAnswer();
    animateCorrectAnswer($);
}

export function applyWrongAnswer($) {
    playWrongSound();
    recordWrongAnswer();
    resetStreak($);
}

export function updateScoreUI($, increment = 0) {
    $('.js-score').text(gameState.score);

    if (increment > 0) {
        $('.js-multiplicator').parent().append($('<span class="score_increment score_increment--base">+' + increment + '</span>'));
        if (gameState.streakBonus > 0) {
            $('.js-streak-wrapper').append(
                $('<span class="score_increment score_increment--streak">+' + gameState.streakBonus * gameState.pointsMultiplier + '</span>')
            );
        }
        setTimeout(function () {
            $('.score_increment').addClass('animate');
        }, 10);
        setTimeout(function () {
            $('.score_increment').addClass('fade');
        }, 910);
        setTimeout(function () {
            $('.score_increment').remove();
        }, 1010);
    }
}

export function updateTrackNumberUI($) {
    $('.js-track-number').text(gameState.playedTracks);
}

export function resetCountdownBar($, value = '100%') {
    $('.js-countdown-bar').css('width', value);
    $('.js-countdown-bar').attr('data-timer', getRoundDuration());
    $('.js-countdown').text(0);
}

export function setPlaybackRate() {
    let rate = 1;
    const percent = gameState.playedTracks <= 1 ? 0 : Math.floor(((gameState.playedTracks - 1) / gameState.tracksByGame) * 100);
    const rand = Math.floor(Math.random() * 100 + 1);

    if (rand <= percent) {
        gameState.modifierRates = shuffleArray(gameState.modifierRates);
        rate = gameState.modifierRates[0];
    }

    return rate;
}

export function getAudioElements($) {
    return {
        audioPlayer: document.getElementById('audio_player'),
        audioPlayerHardcore: document.getElementById('audio_player_hardcore'),
        jsAudioPlayer: $('.js-audio-player'),
        jsAudioPlayerHardcore: $('.js-audio-player-hardcore'),
    };
}