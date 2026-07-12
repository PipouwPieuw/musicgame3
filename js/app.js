import { DEFAULTTRACKSBYGAME, DIFFICULTYNAMES, DEVMODE } from './config.js';
import { setupAudioListeners } from './game/audio-player.js';
import { applyDifficulty, updateDifficultyUI } from './game/difficulty.js';
import {
    cancelNextRoundSchedule,
    handleTimeout,
    initAnswerForm,
    playRound,
    setNextRoundCallback,
    setRoundJquery,
} from './game/round.js';
import { buildSetlist } from './game/setlist.js';
import { getAudioElements, resetStreak, updateScoreUI } from './game/scoring.js';
import { gameState, resetGameState, getDifficultyName } from './game/state.js';
import { loadTracks } from './services/tracks-loader.js';
import { filterPlayableTracks, getPreviewPath, migrateLikedTracksToIds } from './lib/track-utils.js';
import {
    clearStoredUsername,
    getAllScores,
    getPlayerData,
    getScores,
    getStoredUsername,
    setStoredUsername,
    updateAnswers,
    updateGamesPlayed,
    updateLikedTracks,
    updateScores,
} from './services/local-storage.js';
import {
    buildFavorites,
    buildLeaderboard,
    buildTrophies,
    closeLeaderboard,
    openLeaderboard,
    returnBestScores,
    updateStatsAnswers,
    updateStatsBestScore,
    updateStatsGamesPlayed,
} from './ui/leaderboard.js';

const $ = window.jQuery;

function showLoggedInUI() {
    $('.js-settings').addClass('visible');
    $('.js-bar-top').addClass('visible');
    $('.js-login').removeClass('visible');
}

function migrateStoredLikedTracks() {
    if (!gameState.username || !gameState.playerData.likedTracks) {
        return;
    }

    const migrated = migrateLikedTracksToIds(gameState.playerData.likedTracks, gameState.tracks);
    const hasChanged =
        migrated.length !== gameState.playerData.likedTracks.length ||
        migrated.some(function (trackId, index) {
            return trackId !== gameState.playerData.likedTracks[index];
        });

    if (!hasChanged) {
        return;
    }

    gameState.playerData.likedTracks = migrated;
    updateLikedTracks(gameState.username, migrated);
}

async function loadPlayerSession(username) {
    const result = await getPlayerData(username);
    if (result.id == null) {
        return false;
    }

    gameState.username = username;
    gameState.playerData = result;
    const scoresResult = await getScores(username);
    gameState.playerData.scores = scoresResult[0]?.scores || [];
    migrateStoredLikedTracks();
    showLoggedInUI();
    return true;
}

function endGame() {
    gameState.playerData.scores.push([getDifficultyName(), gameState.tracksByGame, gameState.score]);
    updateScores(gameState.username, gameState.playerData.scores);

    const difficultyName = getDifficultyName();
    if (!(difficultyName in gameState.playerData.games_played) || gameState.playerData.games_played[difficultyName] == null) {
        gameState.playerData.games_played[difficultyName] = 0;
    }
    gameState.playerData.games_played[difficultyName] += 1;
    updateStatsGamesPlayed($);
    updateGamesPlayed(gameState.username, gameState.playerData.games_played);

    updateStatsAnswers($);
    updateAnswers(gameState.username, gameState.playerData.good_answers, gameState.playerData.wrong_answers);

    $('.js-wrapper').removeClass('game_started');
    $('.js-wrapper').addClass('game_ended');
    $('.js-score-wrapper').removeClass('visible');
    if (gameState.difficultyLevel == 5) {
        document.body.style.setProperty('--glitchedOpacity', 0);
        $('body').removeClass('glitched_halfgame');
    }
}

function quitGame() {
    resetGameState();
    updateScoreUI($);
    resetStreak($);
    $('.js-wrapper').removeClass('game_ended');
    $('.js-score-wrapper').removeClass('visible');
    if (gameState.difficultyLevel == 5) {
        document.body.style.setProperty('--glitchedOpacity', 0);
        $('body').removeClass('glitched_halfgame');
    }
}

function resetGame() {
    quitGame();
    buildSetlist(gameState.tracks, gameState.tracksByGame);
}

function startGame() {
    buildSetlist(gameState.tracks, gameState.tracksByGame);
    $('.js-track-total').text(gameState.tracksByGame);
    $('.js-wrapper').removeClass('game_ended');
    $('.js-settings').removeClass('visible');
    $('.js-wrapper').addClass('game_started');
    $('.js-score-wrapper').addClass('visible');
    playRound($);
}

function syncTracksByGameToCatalog() {
    const availableTracks = gameState.tracks.length;

    if (availableTracks === 0) {
        return;
    }

    if (gameState.tracksByGame > availableTracks) {
        gameState.tracksByGame = availableTracks;
    }

    $('.js-nb-tracks').attr('max', availableTracks).val(gameState.tracksByGame);
}

async function loadPlaylist() {
    try {
        gameState.tracks = await loadTracks();
        gameState.tracks = await filterPlayableTracks(gameState.tracks);
    } catch (error) {
        console.error(error);
        alert(error.message || 'Impossible de charger le catalogue de morceaux.');
        return;
    }

    if (gameState.tracks.length === 0) {
        alert('Aucun morceau jouable trouvé. Vérifiez que les fichiers audio sont présents dans assets/previews/.');
        return;
    }

    syncTracksByGameToCatalog();

    if (DEVMODE) {
        gameState.tracks.forEach(function (track) {
            console.log(track.id);
            console.log(getPreviewPath(track.id));
            console.log('----------');
        });
    }

    const savedUsername = getStoredUsername();
    if (savedUsername) {
        await loadPlayerSession(savedUsername);
    }

    $('#wrapper').addClass('initialized');
}

async function login() {
    const username = $('.js-username').val().trim().toLowerCase();
    if (!username) {
        alert('Veuillez entrer un nom d\'utilisateur');
        return;
    }

    const loggedIn = await loadPlayerSession(username);
    if (!loggedIn) {
        alert('Impossible de charger le profil');
        return;
    }

    setStoredUsername(username);
    $('.js-username').val('');
}

function logout() {
    gameState.username = '';
    gameState.playerData = {};
    clearStoredUsername();
    closeLeaderboard($);
    $('.js-settings').removeClass('visible');
    $('.js-bar-top').removeClass('visible');
    $('.js-login').addClass('visible');
    $('.js-wrapper').removeClass('game_ended');
}

function bindEvents() {
    $('.js-play-track').on('click', startGame);

    $('.js-replay-game').on('click', function () {
        resetGame();
        $('.js-wrapper').addClass('game_started');
        $('.js-score-wrapper').addClass('visible');
        playRound($);
    });

    $('.js-back-menu').on('click', function () {
        cancelNextRoundSchedule();
        quitGame();
        $('.js-wrapper').removeClass('game_started');
        $('.js-settings').addClass('visible');
    });

    $('.js-quit-game').on('click', function () {
        cancelNextRoundSchedule();
        gameState.isPlaying = false;
        const { audioPlayer, audioPlayerHardcore } = getAudioElements($);
        audioPlayer.pause();
        audioPlayerHardcore.pause();
        quitGame();
        $('.js-wrapper').removeClass('game_started');
        $('.js-settings').addClass('visible');
    });

    $('.js-nb-tracks').on('keyup mouseup', function () {
        const min = +$(this).attr('min');
        const max = Math.min(+$(this).attr('max'), gameState.tracks.length || +$(this).attr('max'));

        if (+$(this).val() < min) {
            $(this).val(min);
        } else if (+$(this).val() > max) {
            $(this).val(max);
        }

        gameState.tracksByGame = +$(this).val();
    });

    $('.js-input-difficulty').on('change', function () {
        const difficultyName = $(this).find('+ label .text_no_glitch').text();
        applyDifficulty($(this).val());
        updateDifficultyUI($, difficultyName);
    });

    $(document).on('click', '.js-like-track', function () {
        const currentState = $(this).attr('data-liked') == 'true';
        const trackIdAttr = $(this).attr('data-track-id');
        const activeTrackId =
            typeof trackIdAttr !== 'undefined' && trackIdAttr !== false
                ? trackIdAttr
                : gameState.currentTrackId;
        if (!currentState) {
            gameState.playerData.likedTracks.push(activeTrackId);
        } else {
            gameState.playerData.likedTracks.splice(gameState.playerData.likedTracks.indexOf(activeTrackId), 1);
        }
        updateLikedTracks(gameState.username, gameState.playerData.likedTracks);
        $(this).attr('data-liked', !currentState);
    });

    $('.js-login-button').on('click', login);

    $('.js-username').on('keyup', function (e) {
        if (e.which == 13) {
            login();
        }
    });

    $('.js-logout-button').on('click', logout);

    $('.js-display-leaderboard').on('click', function () {
        if ($(this).hasClass('active')) {
            closeLeaderboard($);
            return;
        }

        if ($('.js-wrapper').hasClass('game_ended')) {
            quitGame();
        }

        updateStatsGamesPlayed($);
        updateStatsAnswers($);
        updateStatsBestScore($);

        getAllScores().then(function (result) {
            const leaderboard = {};
            const leaderboardCustom = {};
            for (const difficulty in DIFFICULTYNAMES) {
                leaderboard[DIFFICULTYNAMES[difficulty]] = {};
                leaderboardCustom[DIFFICULTYNAMES[difficulty]] = {};
            }
            const [classic, custom] = returnBestScores(result, leaderboard, leaderboardCustom);
            buildLeaderboard($, classic, 'Classement parties classiques');
            buildLeaderboard($, custom, 'Classement parties personnalisées');
            openLeaderboard($);
        });

        buildFavorites($);
        buildTrophies($);
    });

    $('.js-close-leaderboard').on('click', function () {
        closeLeaderboard($);
    });

    $('.js-tab').on('click', function () {
        if ($(this).hasClass('active')) {
            return;
        }
        const target = $(this).attr('rel');
        $('.js-tab.active').removeClass('active');
        $('.js-tab-section.active').removeClass('active');
        $(this).addClass('active');
        $('.js-tab-section[rel="' + target + '"]').addClass('active');
    });

    $('.js-answer-reveal').on('click', function () {
        if($(this).hasClass('toggled')) {
            return;
        }
        $('.js-answer-reveal-image').addClass('visible');
        $('.js-answer-reveal').addClass('toggled');
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
        }, 1800);
    });
}

function init() {
    setRoundJquery($);
    setNextRoundCallback(endGame);
    initAnswerForm($);

    const audioElements = getAudioElements($);
    setupAudioListeners($, audioElements, function () {
        handleTimeout($);
    });

    updateScoreUI($);
    gameState.tracksByGame = DEFAULTTRACKSBYGAME;
    applyDifficulty(1);
    loadPlaylist();
    bindEvents();
}

init();
