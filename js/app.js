import {
    DEFAULTTRACKSBYGAME,
    SCORE_KEYS,
    DEVMODE,
    GAME_MODE_VIGNETTES,
    KEYWORD_MIN_LENGTH,
    KEYWORD_MAX_LENGTH,
    SEEN_UNLOCK_VIGNETTES,
    VIGNETTES_MIN_TRACKS_BY_GAME,
} from './config.js';
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
import { gameState, resetGameState, getDisplayLabel, getScoreKey, isClassicMode, isImageAnswerMode } from './game/state.js';
import { loadTracksFromGenres } from './services/tracks-loader.js';
import { filterPlayableTracks, getPreviewPath, loadCoversManifest, migrateLikedTracksToIds } from './lib/track-utils.js';
import {
    clearStoredUsername,
    getStoredUsername,
    setStoredUsername,
} from './services/local-storage.js';
import {
    getAllScores,
    getPlayerData,
    getScores,
    loginPlayer,
    savePlayerProfile,
    updateLikedTracks,
} from './services/player-api.js';
import {
    buildAchievementsTab,
    buildFavorites,
    buildLeaderboard,
    buildGlobalTrophies,
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
    clearUnlockNewHighlight,
    getVignettesScoreKeyForLevel,
    lockVignettesMode,
    markVignettesUnlockIfNeeded,
    setUnlockSeen,
    syncVignettesModeUnlock,
} from './ui/vignettes-unlock.js';
import { loadAllAchievementDefinitions } from './achievements/loader.js';
import { processPostGameAchievements } from './achievements/post-game.js';
import { initGenreSelection, updateActiveTracksCount } from './ui/genre-selection.js';

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

async function applyPlayerSession(profile) {
    if (!profile || profile.id == null) {
        return false;
    }

    // Use the stored casing from the server (canonical username).
    gameState.username = profile.username;
    gameState.playerData = profile;
    const scoresResult = await getScores(gameState.username);
    gameState.playerData.scores = scoresResult[0]?.scores || [];
    setStoredUsername(gameState.username);
    migrateStoredLikedTracks();
    syncVignettesModeUnlock($);
    syncStatsDifficultyColumns($);
    syncTracksByGameToCatalog();
    showLoggedInUI();
    $('.js-username-display').text("Bienvenue " + gameState.username);
    return true;
}

async function loadPlayerSession(username) {
    try {
        const result = await getPlayerData(username);
        if (!result.hasKeyword) {
            clearStoredUsername();
            $('.js-username').val(result.username || username);
            alert('Veuillez vous reconnecter pour définir un mot-clé et sécuriser votre compte.');
            return false;
        }
        return await applyPlayerSession(result);
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
    if (gameState.difficultyLevel == 4) {
        document.body.style.setProperty('--glitchedOpacity', 0);
        $('body').removeClass('glitched_halfgame');
    }

    await processPostGameAchievements($, {
        sessionScore: gameState.score,
        scoreKey: getScoreKey(),
    });
}

function quitGame() {
    resetGameState();
    updateScoreUI($);
    resetStreak($);
    $('.js-wrapper').removeClass('game_ended');
    $('.js-score-wrapper').removeClass('visible');
    if (gameState.difficultyLevel == 4) {
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

function syncPlayButtonState($) {
    const poolSize = getTracksForCurrentMode().length;
    const $notice = $('.js-vignettes-pool-notice');
    const $playButton = $('.js-play-track');
    const isVignettesPoolTooSmall =
        isImageAnswerMode() && poolSize < VIGNETTES_MIN_TRACKS_BY_GAME;

    $notice.toggleClass('is-hidden', !isVignettesPoolTooSmall);
    $playButton.prop('disabled', isVignettesPoolTooSmall);
}

function syncTracksByGameToCatalog() {
    const availableTracks = getTracksForCurrentMode().length;
    const $input = $('.js-nb-tracks');
    let min = 1;

    if (isImageAnswerMode() && availableTracks >= VIGNETTES_MIN_TRACKS_BY_GAME) {
        min = VIGNETTES_MIN_TRACKS_BY_GAME;
    }

    if (availableTracks > 0) {
        if (gameState.tracksByGame > availableTracks) {
            gameState.tracksByGame = availableTracks;
        }

        if (gameState.tracksByGame < min) {
            gameState.tracksByGame = min;
        }

        $input.attr('min', min).attr('max', availableTracks).val(gameState.tracksByGame);
    } else {
        $input.attr('min', min).attr('max', min);
    }

    updateActiveTracksCount($);
    syncPlayButtonState($);
}

async function reloadActiveTracks() {
    const tracks = await loadTracksFromGenres(gameState.activeGenres);
    gameState.tracks = await filterPlayableTracks(tracks);

    if (gameState.tracks.length === 0) {
        throw new Error(
            'Aucun morceau jouable trouvé. Vérifiez que les fichiers audio sont présents dans assets/audio/.'
        );
    }

    syncTracksByGameToCatalog();
    migrateStoredLikedTracks();
}

async function handleGenresChange() {
    try {
        await reloadActiveTracks();
    } catch (error) {
        console.error(error);
        alert(error.message || 'Impossible de charger le catalogue de morceaux.');
        throw error;
    }
}

async function loadPlaylist() {
    try {
        await reloadActiveTracks();
    } catch (error) {
        console.error(error);
        alert(error.message || 'Impossible de charger le catalogue de morceaux.');
        return false;
    }

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
    return true;
}

let isLoggingIn = false;

function setLoginLoading(isLoading) {
    isLoggingIn = isLoading;
    $('.js-login-button').prop('disabled', isLoading);
    $('.js-username, .js-keyword').prop('disabled', isLoading);
    $('.js-login-loader')
        .toggleClass('visible', isLoading)
        .attr('aria-hidden', isLoading ? 'false' : 'true')
        .attr('aria-busy', isLoading ? 'true' : 'false');
}

async function login() {
    if (isLoggingIn) {
        return;
    }

    const username = $('.js-username').val().trim();
    const keyword = $('.js-keyword').val();

    if (!username || !keyword) {
        alert('Veuillez entrer un nom d\'utilisateur et un mot-clé');
        return;
    }
    if (keyword.length < KEYWORD_MIN_LENGTH) {
        alert('Le mot-clé doit contenir au moins ' + KEYWORD_MIN_LENGTH + ' caractères.');
        return;
    }
    if (keyword.length > KEYWORD_MAX_LENGTH) {
        alert('Le mot-clé ne peut pas dépasser ' + KEYWORD_MAX_LENGTH + ' caractères.');
        return;
    }

    setLoginLoading(true);
    let loginError = null;
    let profileLoadFailed = false;
    try {
        const profile = await loginPlayer(username, keyword);
        const loggedIn = await applyPlayerSession(profile);
        if (!loggedIn) {
            profileLoadFailed = true;
            return;
        }
        $('.js-username').val('');
        $('.js-keyword').val('');
    } catch (error) {
        console.error('Login failed', error);
        loginError = error;
    } finally {
        setLoginLoading(false);
    }

    if (profileLoadFailed) {
        alert('Impossible de charger le profil. Vérifiez que le serveur est démarré.');
        return;
    }
    if (loginError) {
        alert(loginError.message || 'Impossible de se connecter. Vérifiez que le serveur est démarré.');
    }
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
        syncStatsDifficultyColumns($);
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
        syncStatsDifficultyColumns($);
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

            if (gameState.playerData && setUnlockSeen(gameState.playerData, SEEN_UNLOCK_VIGNETTES)) {
                clearUnlockNewHighlight($, SEEN_UNLOCK_VIGNETTES);
                savePlayerProfile(gameState.username, gameState.playerData).catch(function (error) {
                    console.error('Failed to save seen unlock flag', error);
                    delete gameState.playerData.seenUnlocks[SEEN_UNLOCK_VIGNETTES];
                    $('.js-vignettes-option').addClass('settings_difficulty__option--new');
                    alert('Impossible de sauvegarder le statut du mode Vignettes. Vérifiez que le serveur est démarré.');
                });
            }
        }

        syncTracksByGameToCatalog();
    });

    $('.js-input-difficulty').on('change', function () {
        const level = parseInt($(this).val(), 10);
        applyDifficulty(level);
        updateDifficultyUI($);
        syncTracksByGameToCatalog();

        const unlockKey = getVignettesScoreKeyForLevel(level);
        // Normal (level 1) has no gated tooltip; only Difficile+ options do.
        if (unlockKey && level > 1 && gameState.playerData && setUnlockSeen(gameState.playerData, unlockKey)) {
            clearUnlockNewHighlight($, unlockKey);
            savePlayerProfile(gameState.username, gameState.playerData).catch(function (error) {
                console.error('Failed to save seen unlock flag', error);
                delete gameState.playerData.seenUnlocks[unlockKey];
                $('.js-difficulty-option').each(function () {
                    if (parseInt($(this).attr('data-difficulty-level'), 10) === level) {
                        $(this).addClass('settings_difficulty__option--new');
                    }
                });
                alert('Impossible de sauvegarder le statut de la difficulté. Vérifiez que le serveur est démarré.');
            });
        }
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

    $('.js-username, .js-keyword').on('keyup', function (e) {
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
            $('.js-leaderboard-content').empty();
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
        buildAchievementsTab($);
        buildGlobalTrophies($);
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
    loadAllAchievementDefinitions().catch(function (error) {
        console.error('Failed to load achievement definitions', error);
    });
    bindEvents();
    initFoundTracksReveal($);

    loadCoversManifest().catch(function (error) {
        console.warn('Failed to load covers manifest', error);
    });

    loadPlaylist()
        .then(function (loaded) {
            if (!loaded) {
                return;
            }

            return initGenreSelection($, handleGenresChange, syncTracksByGameToCatalog);
        })
        .catch(function (error) {
            console.error('Failed to initialize genre selection', error);
        });
}

init();
