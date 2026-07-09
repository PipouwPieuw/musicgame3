import { isTitleCorrect } from '../lib/normalize-title.js';
import { findTrackById, getPreviewPath, getTrackMetadata } from '../lib/track-utils.js';
import {
    getCountdownPercentage,
    pauseAudio,
    prepareRoundAudio,
    stopAudioForRoundEnd,
} from './audio-player.js';
import { applyCorrectAnswer, applyWrongAnswer, playCorrectSound, resetCountdownBar, updateTrackNumberUI } from './scoring.js';
import { gameState } from './state.js';

let nextRoundCallback = null;
let appJquery = null;

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
    $('.js-answer-input').val('').prop('disabled', true);
    $('.js-answer-submit').prop('disabled', true);
    $('.js-answer-feedback').text('');
}

function enableAnswerForm($) {
    const $form = $('.js-answer-form');
    $form.addClass('answer_form--playing');
    $('.js-answer-input').prop('disabled', false).focus();
    $('.js-answer-submit').prop('disabled', false);
}

function showTrackMetadata($, trackId) {
    if (gameState.displayTrackInfos) {
        const meta = getTrackMetadata(gameState.tracks, trackId);
        $('.js-cover').attr('src', meta.image);
        $('.js-name').text(meta.name);
        $('.js-artist').text(meta.subTitle);
    } else {
        $('.js-name').text('Morceau mystère');
        $('.js-artist').text('Artiste inconnu');
    }
}

function revealAnswer($, trackId) {
    const meta = getTrackMetadata(gameState.tracks, trackId);
    $('.js-answer-feedback').text('Réponse : ' + meta.name + ' — ' + meta.subTitle);
}

function finishRound($, isCorrect, trackId, audioPlayer) {
    gameState.isPlaying = false;
    pauseAudio($);

    const $form = $('.js-answer-form');
    $form.removeClass('answer_form--playing');

    const countdownPercentage = getCountdownPercentage($, audioPlayer);
    resetCountdownBar($, countdownPercentage + '%');

    if (isCorrect) {
        $form.addClass('answer_form--correct');
        playCorrectSound();
        applyCorrectAnswer($);
    } else {
        $form.addClass('answer_form--incorrect');
        applyWrongAnswer($);
        revealAnswer($, trackId);
    }

    $('.js-answer-input').prop('disabled', true);
    $('.js-answer-submit').prop('disabled', true);

    scheduleNextRound();
}

function scheduleNextRound() {
    const $ = appJquery;
    setTimeout(function () {
        if (gameState.setList.length > 0) {
            resetCountdownBar($, '100%');
            setTimeout(function () {
                playRound($);
            }, 20);
        } else if ($('.js-wrapper').hasClass('game_started') && nextRoundCallback) {
            nextRoundCallback();
        }
    }, 1000);
}

export function handleTimeout($) {
    if (!gameState.isPlaying) {
        return;
    }

    gameState.isPlaying = false;
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
    $('.js-answer-input').prop('disabled', true);
    $('.js-answer-submit').prop('disabled', true);

    scheduleNextRound();
}

export function submitAnswer($) {
    if (!gameState.isPlaying) {
        return;
    }

    const input = $('.js-answer-input').val();
    const trackId = gameState.currentTrackId;
    const track = findTrackById(gameState.tracks, trackId);
    const isCorrect = isTitleCorrect(input, track);
    const { audioPlayer } = { audioPlayer: document.getElementById('audio_player') };

    finishRound($, isCorrect, trackId, audioPlayer);
}

export function playRound($) {
    resetAnswerForm($);

    gameState.playedTracks += 1;
    updateTrackNumberUI($);

    const trackId = gameState.setList.shift();
    gameState.currentTrackId = trackId;

    setLikeButton($, trackId);
    showTrackMetadata($, trackId);

    const previewPath = getPreviewPath(trackId);
    prepareRoundAudio($, previewPath);

    if (gameState.difficultyLevel === 5) {
        document.body.style.setProperty('--glitchedOpacity', gameState.playedTracks / (gameState.tracksByGame - 1));
        $('body').toggleClass('glitched_halfgame', gameState.playedTracks > gameState.tracksByGame / 2);
    }

    gameState.isPlaying = true;
    enableAnswerForm($);
}

export function initAnswerForm($) {
    $('.js-answer-form').on('submit', function (event) {
        event.preventDefault();
        submitAnswer($);
    });
}
