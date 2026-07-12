import { DEFAULTTRACKDURATION, DIFFICULTYNAMES, HARDCOREMODETRACKDURATION, MINSTREAK, POINTSBYANSWER } from '../config.js';
import { shuffleArray } from '../lib/shuffle.js';
import { gameState } from './state.js';

const soundRight = new Audio('assets/right.m4a');
soundRight.volume = 0.5;
const soundWrong = new Audio('assets/wrong.m4a');

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
    const difficultyName = DIFFICULTYNAMES[gameState.difficultyLevel - 1];
    if (!(difficultyName in gameState.playerData.good_answers) || gameState.playerData.good_answers[difficultyName] == null) {
        gameState.playerData.good_answers[difficultyName] = 0;
    }
    gameState.playerData.good_answers[difficultyName] += 1;
}

export function recordWrongAnswer() {
    const difficultyName = DIFFICULTYNAMES[gameState.difficultyLevel - 1];
    if (!(difficultyName in gameState.playerData.wrong_answers) || gameState.playerData.wrong_answers[difficultyName] == null) {
        gameState.playerData.wrong_answers[difficultyName] = 0;
    }
    gameState.playerData.wrong_answers[difficultyName] += 1;
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
    $('.js-countdown-bar').attr(
        'data-timer',
        gameState.difficultyLevel <= 2 ? DEFAULTTRACKDURATION : HARDCOREMODETRACKDURATION
    );
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

function animateCorrectAnswer($) {
    $('.js-answer-reveal').addClass('toggled');
    setTimeout(function () {
        $('.js-answer-reveal-image').addClass('visible');
    }, 10);
    setTimeout(function () {
        // $('.js-answer-reveal-star').addClass('active');
        $('.js-answer-reveal-text-wrapper').addClass('appear');
    }, 150);
    setTimeout(function () {
        $('.js-answer-reveal-image').addClass('shine');
    }, 500);
    setTimeout(function () {
        $('.js-answer-reveal-image').removeClass('shine');
    }, 1000);
    setTimeout(function () {
         $('.js-answer-reveal-text-wrapper').removeClass('appear');
         $('.js-answer-reveal-image').removeClass('visible');
     }, 1500);
    setTimeout(function () {
        // $('.js-answer-reveal-star').removeClass('active');
         $('.js-answer-reveal').removeClass('toggled');
    }, 1600);
}