import { DEFAULTTRACKDURATION, HARDCOREMODETRACKDURATION } from '../config.js';
import { shuffleArray } from '../lib/shuffle.js';
import { gameState } from './state.js';
import { setPlaybackRate } from './scoring.js';

let onRoundTimeout = null;

function getPlayableDuration(audioPlayer) {
    return Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : Infinity;
}

function pickTrackStart(audioPlayer) {
    const duration = getPlayableDuration(audioPlayer);
    const maxStart = Math.min(24, Math.max(0, Math.floor(duration) - 1));

    if (maxStart <= 0) {
        return 0;
    }

    return Math.floor(Math.random() * maxStart + 1);
}

function pickHardcoreStart(audioPlayer) {
    const duration = getPlayableDuration(audioPlayer);
    const maxStart = Number.isFinite(duration) ? Math.max(0, Math.floor(duration) - 1) : 29;

    return Math.floor(Math.random() * Math.min(29, maxStart + 1));
}

export function getRoundDuration() {
    return gameState.difficultyLevel <= 2
        ? DEFAULTTRACKDURATION
        : HARDCOREMODETRACKDURATION;
}

function getElapsedSeconds() {
    if (!gameState.roundStartTime) {
        return 0;
    }

    return (performance.now() - gameState.roundStartTime) / 1000;
}

function getRemainingTime() {
    return Math.max(0, getRoundDuration() - getElapsedSeconds());
}

function isRoundTimeUp() {
    return gameState.isPlaying && getElapsedSeconds() >= getRoundDuration() - 0.05;
}

function whenMetadataReady(audioPlayer, callback) {
    if (audioPlayer.readyState >= HTMLMediaElement.HAVE_METADATA) {
        callback();
        return;
    }

    audioPlayer.addEventListener('loadedmetadata', callback, { once: true });
}

export function startAudioCountdown($) {
    function audioCountdown() {
        const remaining = getRemainingTime();
        const timer = Math.ceil(remaining);

        if (timer <= 0) {
            if (gameState.isPlaying && onRoundTimeout) {
                onRoundTimeout();
            }
            return;
        }

        $('.js-countdown').text(timer);

        if (gameState.isPlaying) {
            const totalDuration = getRoundDuration();
            const countdownPercentage = totalDuration > 0 ? (remaining / totalDuration) * 100 : 0;
            $('.js-countdown-bar').css('width', countdownPercentage + '%');
            window.requestAnimationFrame(audioCountdown);
        }
    }

    window.requestAnimationFrame(audioCountdown);
}

export function setupAudioListeners($, { audioPlayer, audioPlayerHardcore, jsAudioPlayer, jsAudioPlayerHardcore }, onTimeout) {
    onRoundTimeout = onTimeout;

    jsAudioPlayer.off('timeupdate').on('timeupdate', function () {
        if (isRoundTimeUp()) {
            onTimeout();
            return;
        }

        if (gameState.isPlaying && gameState.difficultyLevel >= 5) {
            const segmentEnd =
                gameState.currentAudioTime +
                gameState.currentSegmentDurations[0] * audioPlayerHardcore.playbackRate;

            if (audioPlayerHardcore.currentTime >= segmentEnd) {
                const percent =
                    gameState.playedTracks <= 1 ? 0 : Math.floor(((gameState.playedTracks - 1) / (gameState.tracksByGame / 2)) * 100);
                const rand = Math.floor(Math.random() * 100 + 1);

                if (rand <= percent) {
                    gameState.currentSegmentDurations =
                        gameState.playedTracks - 1 >= gameState.tracksByGame / 2
                            ? shuffleArray(gameState.segmentDurations2)
                            : shuffleArray(gameState.segmentDurations1);
                    gameState.currentAudioTime = pickHardcoreStart(audioPlayerHardcore);
                    audioPlayerHardcore.playbackRate = setPlaybackRate();
                    audioPlayerHardcore.currentTime = gameState.currentAudioTime;
                } else {
                    gameState.currentAudioTime = audioPlayerHardcore.currentTime;
                }
            }
        }
    });

    jsAudioPlayer.off('ended').on('ended', function () {
        if (!gameState.isPlaying || isRoundTimeUp()) {
            return;
        }

        audioPlayer.currentTime = gameState.difficultyLevel >= 3 ? gameState.trackStart : 0;
        audioPlayer.play();
    });

    jsAudioPlayerHardcore.off('timeupdate').on('timeupdate', function () {
        if (gameState.isPlaying && audioPlayerHardcore.currentTime < 1) {
            gameState.currentAudioTime = 0;
        }
    });
}

export function resetRoundTimer() {
    gameState.roundStartTime = 0;
}

export function pauseAudio($) {
    const { audioPlayer, audioPlayerHardcore } = getAudioFromDom($);
    audioPlayer.pause();
    audioPlayerHardcore.pause();
}

export function stopAudioForRoundEnd($) {
    const { audioPlayer, audioPlayerHardcore } = getAudioFromDom($);
    audioPlayer.pause();
    audioPlayerHardcore.pause();
    audioPlayer.currentTime = 0;
}

export function getCountdownPercentage($, audioPlayer) {
    const totalDuration = getRoundDuration();
    const remaining = getRemainingTime();
    return totalDuration > 0 ? (remaining / totalDuration) * 100 : 0;
}

function getAudioFromDom($) {
    return {
        audioPlayer: document.getElementById('audio_player'),
        audioPlayerHardcore: document.getElementById('audio_player_hardcore'),
    };
}

function beginRoundPlayback($, audioPlayer, audioPlayerHardcore) {
    if (!gameState.isPlaying) {
        return;
    }

    if (gameState.difficultyLevel >= 5) {
        gameState.currentAudioTime = pickHardcoreStart(audioPlayer);
        audioPlayerHardcore.currentTime = gameState.currentAudioTime;
        audioPlayerHardcore.playbackRate = setPlaybackRate();
    }

    if (gameState.difficultyLevel >= 3) {
        gameState.trackStart = pickTrackStart(audioPlayer);
        audioPlayer.currentTime = gameState.trackStart;
    } else {
        gameState.trackStart = 0;
        audioPlayer.currentTime = 0;
    }

    gameState.roundStartTime = performance.now();
    $('.js-countdown').text(Math.ceil(getRoundDuration()));

    audioPlayer.play();
    if (gameState.difficultyLevel >= 5) {
        audioPlayerHardcore.play();
    }

    startAudioCountdown($);
}

export function prepareRoundAudio($, previewPath) {
    const audioPlayer = document.getElementById('audio_player');
    const audioPlayerHardcore = document.getElementById('audio_player_hardcore');
    const jsAudioPlayer = $('.js-audio-player');
    const jsAudioPlayerHardcore = $('.js-audio-player-hardcore');

    audioPlayer.loop = false;

    jsAudioPlayer.attr('src', previewPath);
    jsAudioPlayerHardcore.attr('src', previewPath);
    audioPlayer.load();

    whenMetadataReady(audioPlayer, function () {
        beginRoundPlayback($, audioPlayer, audioPlayerHardcore);
    });

    return { audioPlayer, audioPlayerHardcore };
}
