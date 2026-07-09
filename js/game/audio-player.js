import { DEFAULTTRACKDURATION, HARDCOREMODETRACKDURATION } from '../config.js';
import { shuffleArray } from '../lib/shuffle.js';
import { gameState } from './state.js';
import { setPlaybackRate } from './scoring.js';

export function startAudioCountdown($, audioPlayer) {
    function audioCountdown() {
        const timer =
            gameState.difficultyLevel <= 2
                ? DEFAULTTRACKDURATION - Math.floor(audioPlayer.currentTime)
                : gameState.trackStart + HARDCOREMODETRACKDURATION - Math.floor(audioPlayer.currentTime);

        if (timer <= 0) {
            return;
        }

        $('.js-countdown').text(timer);

        if (gameState.isPlaying) {
            const currentDuration = gameState.difficultyLevel <= 2 ? DEFAULTTRACKDURATION : HARDCOREMODETRACKDURATION;
            const currentCountdown =
                gameState.difficultyLevel <= 2
                    ? DEFAULTTRACKDURATION - audioPlayer.currentTime
                    : gameState.trackStart + HARDCOREMODETRACKDURATION - audioPlayer.currentTime;
            const countdownPercentage = (currentCountdown / currentDuration) * 100;
            $('.js-countdown-bar').css('width', countdownPercentage + '%');
            window.requestAnimationFrame(audioCountdown);
        }
    }

    window.requestAnimationFrame(audioCountdown);
}

export function setupAudioListeners($, { audioPlayer, audioPlayerHardcore, jsAudioPlayer, jsAudioPlayerHardcore }, onTimeout) {
    jsAudioPlayer.off('timeupdate').on('timeupdate', function () {
        const clipEnded =
            (gameState.difficultyLevel >= 3 && audioPlayer.currentTime >= gameState.trackStart + HARDCOREMODETRACKDURATION) ||
            (gameState.difficultyLevel <= 2 && audioPlayer.currentTime >= audioPlayer.duration);

        if (clipEnded) {
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
                    gameState.currentAudioTime = Math.floor(Math.random() * 29);
                    audioPlayerHardcore.playbackRate = setPlaybackRate();
                    audioPlayerHardcore.currentTime = gameState.currentAudioTime;
                } else {
                    gameState.currentAudioTime = audioPlayerHardcore.currentTime;
                }
            }
        }
    });

    jsAudioPlayerHardcore.off('timeupdate').on('timeupdate', function () {
        if (gameState.isPlaying && audioPlayerHardcore.currentTime < 1) {
            gameState.currentAudioTime = 0;
        }
    });
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
    const currentDuration = gameState.difficultyLevel <= 2 ? DEFAULTTRACKDURATION : HARDCOREMODETRACKDURATION;
    const currentCountdown =
        gameState.difficultyLevel <= 2
            ? DEFAULTTRACKDURATION - audioPlayer.currentTime
            : gameState.trackStart + HARDCOREMODETRACKDURATION - audioPlayer.currentTime;
    return (currentCountdown / currentDuration) * 100;
}

function getAudioFromDom($) {
    return {
        audioPlayer: document.getElementById('audio_player'),
        audioPlayerHardcore: document.getElementById('audio_player_hardcore'),
    };
}

export function prepareRoundAudio($, previewPath) {
    const { audioPlayer, audioPlayerHardcore, jsAudioPlayer, jsAudioPlayerHardcore } = {
        audioPlayer: document.getElementById('audio_player'),
        audioPlayerHardcore: document.getElementById('audio_player_hardcore'),
        jsAudioPlayer: $('.js-audio-player'),
        jsAudioPlayerHardcore: $('.js-audio-player-hardcore'),
    };

    jsAudioPlayer.attr('src', previewPath);
    jsAudioPlayerHardcore.attr('src', previewPath);

    if (gameState.difficultyLevel >= 5) {
        gameState.currentAudioTime = Math.floor(Math.random() * 29);
        audioPlayerHardcore.currentTime = gameState.currentAudioTime;
        audioPlayerHardcore.playbackRate = setPlaybackRate();
    }

    if (gameState.difficultyLevel >= 3) {
        gameState.trackStart = Math.floor(Math.random() * 24 + 1);
        audioPlayer.currentTime = gameState.trackStart;
    }

    $('.js-countdown').text(gameState.difficultyLevel <= 2 ? DEFAULTTRACKDURATION : HARDCOREMODETRACKDURATION);

    audioPlayer.play();
    if (gameState.difficultyLevel >= 5) {
        audioPlayerHardcore.play();
    }

    startAudioCountdown($, audioPlayer);

    return { audioPlayer, audioPlayerHardcore };
}
