import { DEFAULT_COVER_PATH } from '../config.js';
import { isTitleCorrect } from '../lib/normalize-title.js';
import { findTrackById, getPreviewPath, getTrackMetadata } from '../lib/track-utils.js';
import {
    getCountdownPercentage,
    pauseAudio,
    prepareRoundAudio,
    resetRoundTimer,
    stopAudioForRoundEnd,
} from './audio-player.js';
import { applyCorrectAnswer, applyWrongAnswer, playCorrectSound, resetCountdownBar, updateTrackNumberUI } from './scoring.js';
import { gameState } from './state.js';

const WRONG_ANSWER_FLASH_MS = 400;
const ROUND_END_DISPLAY_MS = 2050;
const MYSTERY_TITLE = 'Morceau mystère';

let nextRoundCallback = null;
let appJquery = null;
let nextRoundTimeoutId = null;
let isAwaitingNextRound = false;

export function setNextRoundCallback(callback) {
    nextRoundCallback = callback;
}

export function setRoundJquery($) {
    appJquery = $;
}

function setLikeButton($, trackId) {
    $('.js-like-track').attr('data-liked', gameState.playerData.likedTracks.indexOf(trackId) >= 0);
}

function resetAnswerForm($) {
    const $form = $('.js-answer-form');
    $form.removeClass('answer_form--correct answer_form--incorrect answer_form--playing');
    $('.js-answer-input').val('').prop('readonly', false).prop('disabled', true);
    // $('.js-answer-feedback').text('');
}

function enableAnswerForm($) {
    const $form = $('.js-answer-form');
    $form.addClass('answer_form--playing');
    $('.js-answer-input').prop('readonly', false).prop('disabled', false).focus();
}

function enableNextRoundInput($) {
    $('.js-answer-input').val('').prop('readonly', true).prop('disabled', false).focus();
}

function clearNextRoundSchedule() {
    if (nextRoundTimeoutId !== null) {
        clearTimeout(nextRoundTimeoutId);
        nextRoundTimeoutId = null;
    }
    isAwaitingNextRound = false;
}

export function cancelNextRoundSchedule() {
    clearNextRoundSchedule();
}

function showGuessingPhaseUI($) {
    // $('.js-cover').attr('src', DEFAULT_COVER_PATH);
    // $('.js-name').text(MYSTERY_TITLE);
    // $('.js-description').text('');
}

function setCoverImage($, imagePath) {
    // const $cover = $('.js-cover');
    const $coverReveal = $('.js-answer-reveal-image img');
    const probe = new Image();

    probe.onload = function () {
        // $cover.attr('src', imagePath);
        $coverReveal.attr('src', imagePath);
    };
    probe.onerror = function () {
        // $cover.attr('src', DEFAULT_COVER_PATH);
        $coverReveal.attr('src', DEFAULT_COVER_PATH);
    };
    probe.src = imagePath;
}

function revealTrackMetadata($, trackId) {
    const meta = getTrackMetadata(gameState.tracks, trackId);
    // $('.js-name').text(meta.name);
    $('.js-answer-reveal-text').text(meta.name);
    // $('.js-description').text(meta.subTitle?.trim() ? meta.subTitle : '');

    if (meta.image) {
        setCoverImage($, meta.image);
    } else {
        // $('.js-cover').attr('src', DEFAULT_COVER_PATH);
    }
}

function revealAnswer($, trackId) {
    // const meta = getTrackMetadata(gameState.tracks, trackId);
    // const feedbackText = meta.subTitle?.trim()
    //     ? 'Réponse : ' + meta.name + ' — ' + meta.subTitle
    //     : 'Réponse : ' + meta.name;
    // $('.js-answer-feedback').text(feedbackText);
    revealTrackMetadata($, trackId);
}

function handleWrongAttempt($) {
    const $form = $('.js-answer-form');

    applyWrongAnswer($);
    $form.addClass('answer_form--incorrect');
    $('.js-answer-input').val('').focus();

    setTimeout(function () {
        if (gameState.isPlaying) {
            $form.removeClass('answer_form--incorrect');
        }
    }, WRONG_ANSWER_FLASH_MS);
}

function finishRound($, audioPlayer) {
    gameState.isPlaying = false;
    resetRoundTimer();
    pauseAudio($);

    const $form = $('.js-answer-form');
    $form.removeClass('answer_form--playing');

    const countdownPercentage = getCountdownPercentage($, audioPlayer);
    resetCountdownBar($, countdownPercentage + '%');

    $form.addClass('answer_form--correct');
    playCorrectSound();
    applyCorrectAnswer($);

    enableNextRoundInput($);

    revealTrackMetadata($, gameState.currentTrackId);
    scheduleNextRound();
}

function advanceToNextRound() {
    if (!isAwaitingNextRound) {
        return;
    }

    clearNextRoundSchedule();

    const $ = appJquery;
    if (!$('.js-wrapper').hasClass('game_started')) {
        return;
    }

    if (gameState.setList.length > 0) {
        resetCountdownBar($, '100%');
        setTimeout(function () {
            playRound($);
        }, 20);
    } else if (nextRoundCallback) {
        nextRoundCallback();
    }
}

function scheduleNextRound() {
    clearNextRoundSchedule();
    isAwaitingNextRound = true;

    nextRoundTimeoutId = setTimeout(function () {
        nextRoundTimeoutId = null;
        advanceToNextRound();
    }, ROUND_END_DISPLAY_MS);
}

export function handleTimeout($) {
    if (!gameState.isPlaying) {
        return;
    }

    gameState.isPlaying = false;
    resetRoundTimer();
    const trackId = gameState.currentTrackId;
    const { audioPlayer } = {
        audioPlayer: document.getElementById('audio_player'),
    };

    $('.js-countdown').text(0);
    stopAudioForRoundEnd($);
    $('.js-answer-form').removeClass('answer_form--playing');
    applyWrongAnswer($);
    revealAnswer($, trackId);
    $('.js-answer-form').addClass('answer_form--incorrect');
    enableNextRoundInput($);

    scheduleNextRound();
}

export function submitAnswer($) {
    if (!gameState.isPlaying) {
        return;
    }

    const input = $('.js-answer-input').val();
    if (!input.trim()) {
        return;
    }

    const trackId = gameState.currentTrackId;
    const track = findTrackById(gameState.tracks, trackId);
    const isCorrect = isTitleCorrect(input, track);

    if (isCorrect) {
        const { audioPlayer } = { audioPlayer: document.getElementById('audio_player') };
        finishRound($, audioPlayer);
    } else {
        handleWrongAttempt($);
    }
}

export function playRound($) {
    resetAnswerForm($);

    gameState.playedTracks += 1;
    updateTrackNumberUI($);

    const trackId = gameState.setList.shift();
    gameState.currentTrackId = trackId;

    setLikeButton($, trackId);
    showGuessingPhaseUI($);

    if (gameState.difficultyLevel === 5) {
        document.body.style.setProperty('--glitchedOpacity', gameState.playedTracks / (gameState.tracksByGame - 1));
        $('body').toggleClass('glitched_halfgame', gameState.playedTracks > gameState.tracksByGame / 2);
    }

    gameState.isPlaying = true;
    enableAnswerForm($);

    const previewPath = getPreviewPath(trackId);
    prepareRoundAudio($, previewPath);
}

export function initAnswerForm($) {
    $('.js-answer-form').on('submit', function (event) {
        event.preventDefault();

        // if (isAwaitingNextRound) {
        //     advanceToNextRound();
        //     return;
        // }

        submitAnswer($);
    });
}
