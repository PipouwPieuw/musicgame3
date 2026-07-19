import { isTitleCorrect } from '../lib/normalize-title.js';
import { shuffleArray } from '../lib/shuffle.js';
import { findTrackById, getPreviewPath, getTrackMetadata } from '../lib/track-utils.js';
import { isTrackDiscovery, setAnswerRevealContent } from '../ui/answer-reveal.js';
import {
    getCountdownPercentage,
    pauseAudio,
    prepareRoundAudio,
    resetRoundTimer,
    stopAudioForRoundEnd,
} from './audio-player.js';
import {
    buildImageChoices,
    disableImageAnswers,
    enableImageAnswers,
    getImageAnswerButton,
    renderImageChoices,
    resetImageAnswers,
} from './image-answers.js';
import { applyCorrectAnswer, applyWrongAnswer, playCorrectSound, resetCountdownBar, updateTrackNumberUI } from './scoring.js';
import { getFoundPlayableTracks, getTracksForCurrentMode } from './setlist.js';
import { gameState, isClassicMode, isImageAnswerMode } from './state.js';

const WRONG_ANSWER_FLASH_MS = 400;
const ROUND_END_DISPLAY_MS = 2050;
const TIMEOUT_NEXT_ROUND_DELAY = 800;
const MYSTERY_TITLE = 'Morceau mystère';
/** Soft advance when no playable replacement track remains. */
const UNPLAYABLE_ROUND_DELAY_MS = 100;

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
    $('.js-skip-round').prop('disabled', true);
    // $('.js-answer-feedback').text('');
    resetImageAnswers($);
}

function enableAnswerForm($) {
    const $form = $('.js-answer-form');
    $form.addClass('answer_form--playing');
    $('.js-answer-input').prop('readonly', false).prop('disabled', false).focus();
    if (isClassicMode()) {
        $('.js-skip-round').prop('disabled', false);
    }
}

function enableNextRoundInput($) {
    if (isImageAnswerMode()) {
        disableImageAnswers($);
        return;
    }

    $('.js-answer-input').val('').prop('readonly', true).prop('disabled', false).focus();
    $('.js-skip-round').prop('disabled', true);
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

function revealTrackMetadata($, trackId) {
    const meta = getTrackMetadata(gameState.tracks, trackId);
    // $('.js-name').text(meta.name);
    // $('.js-description').text(meta.subTitle?.trim() ? meta.subTitle : '');
    // Quiet preload into the hidden overlay (no animation) for the next reveal.
    setAnswerRevealContent($, {
        title: meta.name,
        imagePath: meta.image,
    });
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

async function finishRound($, audioPlayer) {
    gameState.isPlaying = false;
    resetRoundTimer();
    pauseAudio($);

    if (isImageAnswerMode()) {
        disableImageAnswers($);
    } else {
        const $form = $('.js-answer-form');
        $form.removeClass('answer_form--playing');
        $form.addClass('answer_form--correct');
    }

    const countdownPercentage = getCountdownPercentage($, audioPlayer);
    resetCountdownBar($, countdownPercentage + '%');

    playCorrectSound();

    const meta = getTrackMetadata(gameState.tracks, gameState.currentTrackId);
    const discovery = isTrackDiscovery(gameState.currentTrackId);
    await setAnswerRevealContent($, {
        title: meta.name,
        imagePath: meta.image,
        discovery,
    });

    applyCorrectAnswer($);

    enableNextRoundInput($);
    scheduleNextRound();
}

function finishImageRoundWrong($, answerIndex) {
    gameState.isPlaying = false;
    resetRoundTimer();
    stopAudioForRoundEnd($);
    disableImageAnswers($);

    const $button = getImageAnswerButton($, answerIndex);
    $button.addClass('incorrect');

    $('.js-countdown').text(0);
    const audioPlayer = document.getElementById('audio_player');
    const countdownPercentage = getCountdownPercentage($, audioPlayer);
    resetCountdownBar($, countdownPercentage + '%');

    applyWrongAnswer($);
    revealAnswer($, gameState.currentTrackId);
    enableNextRoundInput($);

    scheduleNextRound(TIMEOUT_NEXT_ROUND_DELAY);
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

function scheduleNextRound(delay = ROUND_END_DISPLAY_MS) {
    clearNextRoundSchedule();
    isAwaitingNextRound = true;

    nextRoundTimeoutId = setTimeout(function () {
        nextRoundTimeoutId = null;
        advanceToNextRound();
    }, delay);
}

function finishRoundAsWrong($, nextroundDelay = TIMEOUT_NEXT_ROUND_DELAY) {
    if (!gameState.isPlaying) {
        return;
    }

    gameState.isPlaying = false;
    resetRoundTimer();
    const trackId = gameState.currentTrackId;

    $('.js-countdown').text(0);
    stopAudioForRoundEnd($);

    if (isImageAnswerMode()) {
        disableImageAnswers($);
    } else {
        $('.js-answer-form').removeClass('answer_form--playing');
        $('.js-answer-form').addClass('answer_form--incorrect');
    }

    applyWrongAnswer($);
    revealAnswer($, trackId);
    enableNextRoundInput($);

    scheduleNextRound(nextroundDelay);
}

export function handleTimeout($) {
    finishRoundAsWrong($);
}

export function skipRound($) {
    if (!gameState.isPlaying || !isClassicMode() || isImageAnswerMode()) {
        return;
    }

    finishRoundAsWrong($, 100);
}

export function submitAnswer($) {
    if (!gameState.isPlaying || isImageAnswerMode()) {
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
        if (isClassicMode()) {
            gameState.foundTracksIds.push(trackId);
        }
        finishRound($, audioPlayer);
    } else {
        handleWrongAttempt($);
    }
}

export function submitImageAnswer($, answerIndex) {
    if (!gameState.isPlaying || !isImageAnswerMode()) {
        return;
    }

    const choice = gameState.roundChoices[answerIndex];
    if (!choice) {
        return;
    }

    if (choice.isCorrect) {
        const $button = getImageAnswerButton($, answerIndex);
        $button.addClass('correct');
        const { audioPlayer } = { audioPlayer: document.getElementById('audio_player') };
        finishRound($, audioPlayer);
    } else {
        finishImageRoundWrong($, answerIndex);
    }
}

/**
 * Pick a replacement track without consuming future setlist slots when possible,
 * so the game length stays the same after an audio load failure.
 */
function pickReplacementTrackId(attemptedIds) {
    const reserved = new Set([...gameState.setList, ...gameState.sessionTrackIds, ...attemptedIds]);
    const candidates = getTracksForCurrentMode()
        .map(function (track) {
            return track.id;
        })
        .filter(function (id) {
            return !reserved.has(id);
        });

    if (candidates.length > 0) {
        return shuffleArray(candidates)[0];
    }

    // Last resort: borrow from the upcoming setlist so this round can still play.
    while (gameState.setList.length > 0) {
        const nextId = gameState.setList.shift();
        if (!attemptedIds.has(nextId)) {
            return nextId;
        }
    }

    return null;
}

function bindCurrentTrackForRound($, trackId) {
    gameState.currentTrackId = trackId;

    const lastIndex = gameState.sessionTrackIds.length - 1;
    if (lastIndex >= 0) {
        gameState.sessionTrackIds[lastIndex] = trackId;
    } else {
        gameState.sessionTrackIds.push(trackId);
    }

    setLikeButton($, trackId);
    $('.js-answer-input').val('');

    if (isImageAnswerMode()) {
        gameState.roundChoices = buildImageChoices(trackId, getFoundPlayableTracks());
        renderImageChoices($, gameState.roundChoices).then(function () {
            if (gameState.isPlaying && gameState.currentTrackId === trackId) {
                enableImageAnswers($);
            }
        });
    }
}

/** Advance without wrong-answer penalty when no playable track can be loaded. */
function softSkipUnplayableRound($) {
    if (!gameState.isPlaying) {
        return;
    }

    console.warn('No playable replacement track; advancing without penalty.');
    gameState.isPlaying = false;
    resetRoundTimer();
    stopAudioForRoundEnd($);

    if (isImageAnswerMode()) {
        disableImageAnswers($);
    } else {
        $('.js-answer-form').removeClass('answer_form--playing');
    }

    enableNextRoundInput($);
    scheduleNextRound(UNPLAYABLE_ROUND_DELAY_MS);
}

function recoverRoundAudio($, attemptedIds) {
    if (!gameState.isPlaying) {
        return;
    }

    const replacementId = pickReplacementTrackId(attemptedIds);
    if (!replacementId) {
        softSkipUnplayableRound($);
        return;
    }

    console.warn('Swapping unplayable track for same round:', gameState.currentTrackId, '→', replacementId);
    attemptedIds.add(replacementId);
    bindCurrentTrackForRound($, replacementId);
    startRoundAudio($, attemptedIds);
}

function startRoundAudio($, attemptedIds = new Set()) {
    const trackId = gameState.currentTrackId;
    attemptedIds.add(trackId);

    prepareRoundAudio($, getPreviewPath(trackId), {
        onLoadFailure: function () {
            recoverRoundAudio($, attemptedIds);
        },
    });
}

export function playRound($) {
    resetAnswerForm($);

    gameState.playedTracks += 1;
    updateTrackNumberUI($);

    const trackId = gameState.setList.shift();
    gameState.currentTrackId = trackId;
    gameState.sessionTrackIds.push(trackId);

    setLikeButton($, trackId);
    showGuessingPhaseUI($);

    if (gameState.difficultyLevel === 5) {
        document.body.style.setProperty('--glitchedOpacity', gameState.playedTracks / (gameState.tracksByGame - 1));
        $('body').toggleClass('glitched_halfgame', gameState.playedTracks > gameState.tracksByGame / 2);
    }

    gameState.isPlaying = true;

    if (isImageAnswerMode()) {
        gameState.roundChoices = buildImageChoices(trackId, getFoundPlayableTracks());
        renderImageChoices($, gameState.roundChoices).then(function () {
            if (gameState.isPlaying && gameState.currentTrackId === trackId) {
                enableImageAnswers($);
            }
        });
    } else {
        enableAnswerForm($);
    }

    startRoundAudio($);
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

    $('.js-skip-round').on('click', function () {
        skipRound($);
    });
}

export function initImageAnswers($) {
    $('body').on('click', '.js-answer', function () {
        if (!gameState.isPlaying || !isImageAnswerMode()) {
            return;
        }

        const answerIndex = parseInt($(this).attr('data-index'), 10);
        if (Number.isNaN(answerIndex)) {
            return;
        }

        submitImageAnswer($, answerIndex);
    });
}
