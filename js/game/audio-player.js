import {
    DEFAULTTRACKDURATION,
    DIFFICILETRACKDURATION,
    HARDCOREMODETRACKDURATION,
    MOYENTRACKDURATION,
} from '../config.js';
import { shuffleArray } from '../lib/shuffle.js';
import { gameState, usesRandomTrackStart } from './state.js';
import { setPlaybackRate } from './scoring.js';

/** One retry with cache-bust after a failed load (e.g. ERR_CACHE_READ_FAILURE). */
const AUDIO_LOAD_MAX_ATTEMPTS = 2;

let onRoundTimeout = null;
let prepareAudioGeneration = 0;

function getPlayableDuration(audioPlayer) {
    return Number.isFinite(audioPlayer.duration) ? audioPlayer.duration : Infinity;
}

function pickTrackStart(audioPlayer) {
    const duration = getPlayableDuration(audioPlayer);
    const clipSeconds = getRoundDuration();
    const trackLength = Number.isFinite(duration) ? Math.floor(duration) : 30;
    const maxStart = Math.max(0, trackLength - clipSeconds);

    if (maxStart <= 0) {
        return 0;
    }

    return Math.floor(Math.random() * (maxStart + 1));
}

function pickHardcoreStart(audioPlayer) {
    const duration = getPlayableDuration(audioPlayer);
    const maxStart = Number.isFinite(duration) ? Math.max(0, Math.floor(duration) - 1) : 29;

    return Math.floor(Math.random() * Math.min(29, maxStart + 1));
}

export function getRoundDuration() {
    if (gameState.difficultyLevel === 1) {
        return DEFAULTTRACKDURATION;
    }
    if (gameState.difficultyLevel === 2) {
        return MOYENTRACKDURATION;
    }
    if (gameState.difficultyLevel === 3) {
        return DIFFICILETRACKDURATION;
    }
    return HARDCOREMODETRACKDURATION;
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

/** Remaining time as a fraction of the round limit (1 = full time left, 0 = timed out). */
export function getRoundRemainingRatio() {
    const totalDuration = getRoundDuration();
    if (!(totalDuration > 0)) {
        return 0;
    }

    return Math.max(0, Math.min(1, getRemainingTime() / totalDuration));
}

function isRoundTimeUp() {
    return gameState.isPlaying && getElapsedSeconds() >= getRoundDuration() - 0.05;
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

        if (gameState.isPlaying && gameState.difficultyLevel >= 4) {
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

        audioPlayer.currentTime = usesRandomTrackStart() ? gameState.trackStart : 0;
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

    if (gameState.difficultyLevel >= 4) {
        gameState.currentAudioTime = pickHardcoreStart(audioPlayer);
        audioPlayerHardcore.currentTime = gameState.currentAudioTime;
        audioPlayerHardcore.playbackRate = setPlaybackRate();
    }

    if (usesRandomTrackStart()) {
        gameState.trackStart = pickTrackStart(audioPlayer);
        audioPlayer.currentTime = gameState.trackStart;
    } else {
        gameState.trackStart = 0;
        audioPlayer.currentTime = 0;
    }

    gameState.roundStartTime = performance.now();
    $('.js-countdown').text(Math.ceil(getRoundDuration()));

    audioPlayer.play();
    if (gameState.difficultyLevel >= 4) {
        audioPlayerHardcore.play();
    }

    startAudioCountdown($);
}

function withCacheBust(path) {
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}cb=${Date.now()}`;
}

/**
 * Loads preview audio and starts the round timer once metadata is ready.
 * On load failure: retries once with a cache-busting URL, then calls onLoadFailure
 * so the round can recover without punishing the player.
 */
export function prepareRoundAudio($, previewPath, options = {}) {
    const onLoadFailure = typeof options.onLoadFailure === 'function' ? options.onLoadFailure : null;
    const generation = ++prepareAudioGeneration;
    const audioPlayer = document.getElementById('audio_player');
    const audioPlayerHardcore = document.getElementById('audio_player_hardcore');
    const jsAudioPlayer = $('.js-audio-player');
    const jsAudioPlayerHardcore = $('.js-audio-player-hardcore');

    let attempt = 0;
    let settled = false;

    audioPlayer.loop = false;

    function isStale() {
        return generation !== prepareAudioGeneration || !gameState.isPlaying;
    }

    function cleanup() {
        audioPlayer.removeEventListener('error', onError);
        audioPlayer.removeEventListener('loadedmetadata', onMetadata);
    }

    function settleSuccess() {
        if (settled || isStale()) {
            return;
        }

        settled = true;
        cleanup();
        beginRoundPlayback($, audioPlayer, audioPlayerHardcore);
    }

    function settleFailure() {
        if (settled || isStale()) {
            return;
        }

        settled = true;
        cleanup();

        if (onLoadFailure) {
            onLoadFailure();
        }
    }

    function onMetadata() {
        settleSuccess();
    }

    function onError() {
        if (settled || isStale()) {
            return;
        }

        attempt += 1;

        if (attempt < AUDIO_LOAD_MAX_ATTEMPTS) {
            console.warn('Audio load failed, retrying with cache-bust:', previewPath);
            loadSrc(withCacheBust(previewPath));
            return;
        }

        console.warn('Audio load failed after retry:', previewPath);
        settleFailure();
    }

    function loadSrc(path) {
        jsAudioPlayer.attr('src', path);
        jsAudioPlayerHardcore.attr('src', path);
        audioPlayer.load();
    }

    audioPlayer.addEventListener('error', onError);
    audioPlayer.addEventListener('loadedmetadata', onMetadata, { once: true });
    loadSrc(previewPath);

    return { audioPlayer, audioPlayerHardcore };
}
