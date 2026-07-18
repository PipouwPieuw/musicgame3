import { DEFAULTTRACKSBYGAME, SCORE_KEYS, DEVMODE, GAME_MODE_VIGNETTES } from './config.js';
import { setupAudioListeners } from './game/audio-player.js';
import { applyDifficulty, applyGameMode, updateAnswerModeUI, updateDifficultyUI } from './game/difficulty.js';
import {
    cancelNextRoundSchedule,
    handleTimeout,
    initAnswerForm,
    initImageAnswers,
    playRound,
    setNextRoundCallback,
    setRoundJquery,
} from './game/round.js';
import { buildSetlist, getTracksForCurrentMode } from './game/setlist.js';
import { getAudioElements, resetStreak, updateScoreUI } from './game/scoring.js';
import { gameState, resetGameState, getDisplayLabel, getScoreKey, isClassicMode } from './game/state.js';
import { loadTracks } from './services/tracks-loader.js';
import { filterPlayableTracks, getPreviewPath, migrateLikedTracksToIds } from './lib/track-utils.js';
import {
    clearStoredUsername,
    getStoredUsername,
    setStoredUsername,
} from './services/local-storage.js';
import {
    getAllScores,
    getPlayerData,
    getScores,
    savePlayerProfile,
    updateLikedTracks,
} from './services/player-api.js';
import {
    buildFavorites,
    buildLeaderboard,
    buildTrophies,
    buildFoundTracks,
    closeLeaderboard,
    initFoundTracksReveal,
    openLeaderboard,
    returnBestScores,
    syncStatsDifficultyColumns,
    updateStatsAnswers,
    updateStatsBestScore,
    updateStatsGamesPlayed,
} from './ui/leaderboard.js';
import {
    clearVignettesNewHighlight,
    lockVignettesMode,
    markVignettesUnlockIfNeeded,
    syncVignettesModeUnlock,
} from './ui/vignettes-unlock.js';

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
    try {
        const result = await getPlayerData(username);
        if (result.id == null) {
            return false;
        }

        // Use the stored casing from the server (canonical username).
        gameState.username = result.username;
        gameState.playerData = result;
        const scoresResult = await getScores(gameState.username);
        gameState.playerData.scores = scoresResult[0]?.scores || [];
        setStoredUsername(gameState.username);
        migrateStoredLikedTracks();
        syncVignettesModeUnlock($);
        showLoggedInUI();
        return true;
    } catch (error) {
        console.error('Failed to load player session', error);
        return false;
    }
}

async function endGame() {
    gameState.playerData.scores.push([getScoreKey(), gameState.tracksByGame, gameState.score]);

    if (isClassicMode()) {
        for (let id of gameState.foundTracksIds) {
            if (!gameState.playerData.foundTracksIds.includes(id)) {
                gameState.playerData.foundTracksIds.push(id);
            }
        }
        gameState.foundTracksIds = [];
    }

    markVignettesUnlockIfNeeded();

    const scoreKey = getScoreKey();
    if (!(scoreKey in gameState.playerData.games_played) || gameState.playerData.games_played[scoreKey] == null) {
        gameState.playerData.games_played[scoreKey] = 0;
    }
    gameState.playerData.games_played[scoreKey] += 1;
    updateStatsGamesPlayed($);
    updateStatsAnswers($);

    try {
        await savePlayerProfile(gameState.username, gameState.playerData);
    } catch (error) {
        console.error('Failed to save player profile after game', error);
        alert('Impossible de sauvegarder la partie. Vérifiez que le serveur est démarré.');
    }

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
    buildSetlist(getTracksForCurrentMode(), gameState.tracksByGame);
}

function startGame() {
    const trackPool = getTracksForCurrentMode();

    if (isClassicMode() && gameState.onlyUnfoundTracks && trackPool.length === 0) {
        alert('Tous les morceaux ont déjà été trouvés. Décochez l\'option ou choisissez un autre mode.');
        return;
    }

    if (isClassicMode()) {
        gameState.foundTracksIds = [];
    }
    buildSetlist(trackPool, gameState.tracksByGame);
    $('.js-track-total').text(gameState.tracksByGame);
    $('.js-wrapper').removeClass('game_ended');
    $('.js-settings').removeClass('visible');
    $('.js-wrapper').addClass('game_started');
    $('.js-score-wrapper').addClass('visible');
    playRound($);
}

function syncTracksByGameToCatalog() {
    const availableTracks = getTracksForCurrentMode().length;

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
        alert('Aucun morceau jouable trouvé. Vérifiez que les fichiers audio sont présents dans assets/audio/.');
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
    const username = $('.js-username').val().trim();
    if (!username) {
        alert('Veuillez entrer un nom d\'utilisateur');
        return;
    }

    const loggedIn = await loadPlayerSession(username);
    if (!loggedIn) {
        alert('Impossible de charger le profil. Vérifiez que le serveur est démarré.');
        return;
    }

    $('.js-username').val('');
}

function logout() {
    gameState.username = '';
    gameState.playerData = {};
    clearStoredUsername();
    lockVignettesMode($);
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
        syncVignettesModeUnlock($, { animate: true });
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
        syncVignettesModeUnlock($, { animate: true });
    });

    $('.js-nb-tracks').on('keyup mouseup', function () {
        const min = +$(this).attr('min');
        const poolSize = getTracksForCurrentMode().length;
        const max = Math.min(+$(this).attr('max'), poolSize || +$(this).attr('max'));

        if (+$(this).val() < min) {
            $(this).val(min);
        } else if (+$(this).val() > max) {
            $(this).val(max);
        }

        gameState.tracksByGame = +$(this).val();
    });

    $('.js-unfound-only').on('change', function () {
        gameState.onlyUnfoundTracks = $(this).prop('checked');
        syncTracksByGameToCatalog();
    });

    $('.js-input-game-mode').on('change', function () {
        const selectedMode = String($(this).val());
        applyGameMode(selectedMode);
        updateDifficultyUI($);

        if (selectedMode === GAME_MODE_VIGNETTES) {
            const $checkedDifficulty = $('.js-input-difficulty:checked');
            if ($checkedDifficulty.length) {
                applyDifficulty($checkedDifficulty.val());
                updateDifficultyUI($);
            }

            if (gameState.playerData && !gameState.playerData.hasSeenVignettesMode) {
                gameState.playerData.hasSeenVignettesMode = true;
                clearVignettesNewHighlight($);
                savePlayerProfile(gameState.username, gameState.playerData).catch(function (error) {
                    console.error('Failed to save vignettes seen flag', error);
                    gameState.playerData.hasSeenVignettesMode = false;
                    $('.js-vignettes-option').addClass('settings_difficulty__option--new');
                    alert('Impossible de sauvegarder le statut du mode Vignettes. Vérifiez que le serveur est démarré.');
                });
            }
        }

        syncTracksByGameToCatalog();
    });

    $('.js-input-difficulty').on('change', function () {
        applyDifficulty($(this).val());
        updateDifficultyUI($);
        syncTracksByGameToCatalog();
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
        syncStatsDifficultyColumns($);

        getAllScores().then(function (result) {
            const leaderboard = {};
            const leaderboardCustom = {};
            for (const i in SCORE_KEYS) {
                leaderboard[SCORE_KEYS[i]] = {};
                leaderboardCustom[SCORE_KEYS[i]] = {};
            }
            const [classic, custom] = returnBestScores(result, leaderboard, leaderboardCustom);
            buildLeaderboard($, classic, 'Classement parties standards');
            buildLeaderboard($, custom, 'Classement parties personnalisées');
            openLeaderboard($);
        });

        buildFavorites($);
        buildTrophies($);
        buildFoundTracks($);
    });

    $('.js-close-leaderboard').on('click', function () {
        closeLeaderboard($);
        syncVignettesModeUnlock($, { animate: true });
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
}

function init() {
    setRoundJquery($);
    setNextRoundCallback(endGame);
    initAnswerForm($);
    initImageAnswers($);

    const audioElements = getAudioElements($);
    setupAudioListeners($, audioElements, function () {
        handleTimeout($);
    });

    updateScoreUI($);
    gameState.tracksByGame = DEFAULTTRACKSBYGAME;
    applyGameMode('classique');
    updateDifficultyUI($, getDisplayLabel());
    updateAnswerModeUI($);
    syncStatsDifficultyColumns($);
    loadPlaylist();
    initFoundTracksReveal($);
    bindEvents();
}

init();
