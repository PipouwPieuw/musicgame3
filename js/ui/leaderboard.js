import { DEFAULTTRACKSBYGAME, DIFFICULTYNAMES, LEADERBOARDDIFFICULTYNAMES } from '../config.js';
import { getTrackMetadata } from '../lib/track-utils.js';
import { getAllProfiles, getAllScores } from '../services/player-api.js';
import { gameState } from '../game/state.js';

export function returnBestScores(allScores, leaderboard, leaderboardCustom) {
    for (const element in allScores) {
        const scores = allScores[element].scores;
        if (scores == null) {
            continue;
        }
        const name = allScores[element].name;
        const initials = allScores[element].initials;
        for (const currentScore in scores) {
            const [difficulty, tracks, points] = scores[currentScore];
            if (tracks != DEFAULTTRACKSBYGAME) {
                if (!(name in leaderboardCustom[difficulty])) {
                    leaderboardCustom[difficulty][name] = [name, tracks, points, initials];
                } else if (leaderboardCustom[difficulty][name][2] < points) {
                    leaderboardCustom[difficulty][name] = [name, tracks, points, initials];
                }
            } else {
                if (!(name in leaderboard[difficulty])) {
                    leaderboard[difficulty][name] = [name, tracks, points, initials];
                } else if (leaderboard[difficulty][name][2] < points) {
                    leaderboard[difficulty][name] = [name, tracks, points, initials];
                }
            }
        }
    }

    for (const difficulty in DIFFICULTYNAMES) {
        const difficultyTableCustom = [];
        for (const playerName in leaderboardCustom[DIFFICULTYNAMES[difficulty]]) {
            difficultyTableCustom.push(leaderboardCustom[DIFFICULTYNAMES[difficulty]][playerName]);
        }
        difficultyTableCustom.sort((a, b) => (a[2] < b[2] ? 1 : b[2] < a[2] ? -1 : 0));
        leaderboardCustom[DIFFICULTYNAMES[difficulty]] = difficultyTableCustom;

        const difficultyTable = [];
        for (const playerName in leaderboard[DIFFICULTYNAMES[difficulty]]) {
            difficultyTable.push(leaderboard[DIFFICULTYNAMES[difficulty]][playerName]);
        }
        difficultyTable.sort((a, b) => (a[2] < b[2] ? 1 : b[2] < a[2] ? -1 : 0));
        leaderboard[DIFFICULTYNAMES[difficulty]] = difficultyTable;
    }

    return [leaderboard, leaderboardCustom];
}

export function buildLeaderboard($, object, title) {
    let counter = 0;
    $('.js-leaderboard-content').append('<span class="leaderboard__section_title">' + title + '</span>');
    for (const difficulty in DIFFICULTYNAMES) {
        counter += 1;
        const label = DIFFICULTYNAMES[difficulty];
        const displayedLabel = LEADERBOARDDIFFICULTYNAMES[difficulty];
        if (object[label].length == 0) {
            continue;
        }
        $('.js-leaderboard-content').append(
            '<span class="leaderboard__title leaderboard__title--' + counter + ' panel_label">' + displayedLabel + '</span>'
        );
        const scoresList = $('<ul class="leaderboard__list"></ul>');
        scoresList.append(
            $('<li class="leaderboard__item"><span class="leaderboard__value--head leaderboard__value--name">Joueur</span><span class="leaderboard__value--head leaderboard__value--tracks">Nombre de morceaux</span><span class="leaderboard__value--head leaderboard__value--points">Score</span></li>')
        );
        for (const currentScore in object[label]) {
            const [name, tracks, points] = object[label][currentScore];
            const scoresItem = $('<li class="leaderboard__item"></li>');
            scoresItem.append($('<span class="leaderboard__value leaderboard__value--name">' + name + '</span>'));
            scoresItem.append($('<span class="leaderboard__value leaderboard__value--tracks">' + tracks + '</span>'));
            scoresItem.append($('<span class="leaderboard__value leaderboard__value--points">' + points + '</span>'));
            scoresList.append(scoresItem);
        }
        $('.js-leaderboard-content').append(scoresList);
    }
}

export function buildFavorites($) {
    for (const index in gameState.playerData.likedTracks) {
        const trackId = gameState.playerData.likedTracks[index];
        const meta = getTrackMetadata(gameState.tracks, trackId);

        const favoriteElem = $('<div class="track_display track_display--favorite"></div>');
        favoriteElem.append(
            '<div class="track_display__half track_display__half--cover track_display__half--cover_favorite"><img class="track_display__cover track_display__cover--favorite" src="' +
                meta.image +
                '"/></div>'
        );
        const favoriteElemDetails = $(
            '<div class="track_display__details track_display__half track_display__half--details track_display__half--details_favorites"></div>'
        );
        const favoriteElemContent = $('<div class="track_display__content"></div>');
        favoriteElemContent.append('<div class="track_display__name">' + meta.name + '</div>');
        favoriteElemContent.append('<div class="track_display__description">' + meta.subTitle + '</div>');
        favoriteElemDetails.append(favoriteElemContent);
        const favoriteElemLike = $(
            '<button class="track_display__like default_tooltip__wrapper js-like-track" data-liked="true" data-track-id="' +
                trackId +
                '"</button>'
        );
        favoriteElemLike.append(
            $('<span class="track_display__like_legend default_tooltip default_transition" data-liked="true">Retirer des favoris</span>')
        );
        favoriteElemLike.append(
            $('<span class="track_display__like_legend default_tooltip default_transition" data-liked="false">Ajouter aux favoris</span>')
        );
        favoriteElemDetails.append(favoriteElemLike);
        favoriteElem.append(favoriteElemDetails);
        $('.js-favorites-content').append(favoriteElem);
    }
}

export async function buildTrophies($) {
    const result = await getAllProfiles();
    const gamesPlayed = [];
    const answersRatio = [];

    for (const i in result) {
        const player = result[i];
        let totalGames = 0;
        for (const j in player.games_played) {
            totalGames += player.games_played[j];
        }
        gamesPlayed[i] = [player.initials, totalGames];

        if (totalGames > 0) {
            let goodAnswers = 0;
            let wrongAnswers = 0;
            for (const j in player.good_answers) {
                goodAnswers += player.good_answers[j];
            }
            for (const j in player.wrong_answers) {
                wrongAnswers += player.wrong_answers[j];
            }
            const answersPercent = Math.ceil((goodAnswers / (goodAnswers + wrongAnswers)) * 100) || 0;
            answersRatio.push([player.initials, answersPercent]);
        }
    }

    let mostLikedTracks = [];
    let lessLikedTracks = [];

    for (const i in result) {
        const player = result[i];
        if (player.likedTracks != null) {
            if (mostLikedTracks.length == 0 || mostLikedTracks[1] < player.likedTracks.length) {
                mostLikedTracks = [player.initials, player.likedTracks.length];
            }
            if (lessLikedTracks.length == 0 || lessLikedTracks[1] > player.likedTracks.length) {
                lessLikedTracks = [player.initials, player.likedTracks.length];
            }
        }
    }

    if (gamesPlayed.length > 0) {
        gamesPlayed.sort((a, b) => (a[1] < b[1] ? 1 : b[1] < a[1] ? -1 : 0));
        $('.js-trophy-most-games').attr('src', 'assets/avatars/' + gamesPlayed[0][0] + '.png');
        $('.js-trophy-most-games-value').text(gamesPlayed[0][1]);
        $('.js-trophy-less-games').attr('src', 'assets/avatars/' + gamesPlayed[gamesPlayed.length - 1][0] + '.png');
        $('.js-trophy-less-games-value').text(gamesPlayed[gamesPlayed.length - 1][1]);
    }

    if (answersRatio.length > 0) {
        answersRatio.sort((a, b) => (a[1] < b[1] ? 1 : b[1] < a[1] ? -1 : 0));
        $('.js-trophy-precision').attr('src', 'assets/avatars/' + answersRatio[0][0] + '.png');
        $('.js-trophy-precision-value').text(answersRatio[0][1]);
        $('.js-trophy-less-precision').attr('src', 'assets/avatars/' + answersRatio[answersRatio.length - 1][0] + '.png');
        $('.js-trophy-less-precision-value').text(answersRatio[answersRatio.length - 1][1]);
    }

    if (mostLikedTracks.length) {
        $('.js-trophy-most-favorites').attr('src', 'assets/avatars/' + mostLikedTracks[0] + '.png');
        $('.js-trophy-most-favorites-value').text(mostLikedTracks[1]);
        $('.js-trophy-less-favorites').attr('src', 'assets/avatars/' + lessLikedTracks[0] + '.png');
        $('.js-trophy-less-favorites-value').text(lessLikedTracks[1]);
    }

    const allScores = await getAllScores();
    const leaderboard = {};
    const leaderboardCustom = {};
    for (const difficulty in DIFFICULTYNAMES) {
        leaderboard[DIFFICULTYNAMES[difficulty]] = {};
        leaderboardCustom[DIFFICULTYNAMES[difficulty]] = {};
    }
    const [leaderboardResult] = returnBestScores(allScores, leaderboard, leaderboardCustom);

    const totalScores = {};
    for (const i in leaderboardResult) {
        for (const j in leaderboardResult[i]) {
            const initials = leaderboardResult[i][j][3];
            if (!(initials in totalScores)) {
                totalScores[leaderboardResult[i][j][3]] = leaderboardResult[i][j][2];
            } else {
                totalScores[leaderboardResult[i][j][3]] += leaderboardResult[i][j][2];
            }
        }
    }

    const totalScoresArray = [];
    let counter = 0;
    for (const i in totalScores) {
        totalScoresArray[counter] = [i, totalScores[i]];
        counter += 1;
    }

    if (totalScoresArray.length > 0) {
        totalScoresArray.sort((a, b) => (a[1] < b[1] ? 1 : b[1] < a[1] ? -1 : 0));
        $('.js-trophy-best-scores').attr('src', 'assets/avatars/' + totalScoresArray[0][0] + '.png');
        $('.js-trophy-best-scores-value').text(totalScoresArray[0][1]);
        $('.js-trophy-worst-scores').attr('src', 'assets/avatars/' + totalScoresArray[totalScoresArray.length - 1][0] + '.png');
        $('.js-trophy-worst-scores-value').text(totalScoresArray[totalScoresArray.length - 1][1]);
    }
}

export async function buildFoundTracks($) {
    $('.js-found-tracks-list').empty();
    const foundTracks = gameState.playerData.foundTracksIds;
    $('.js-found-tracks-count').text(foundTracks.length);
    for (const track in foundTracks) {
        $('.js-found-tracks-list').append('<li class="found_tracks__item"><img src="assets/covers/' + foundTracks[track] + '.png"/></li>');
    }
}

export function updateStatsGamesPlayed($) {
    $('.js-games-played').each(function () {
        const level = $(this).attr('rel');
        $(this).text(gameState.playerData.games_played[level]);
    });
}

export function updateStatsAnswers($) {
    $('.js-good-answers').each(function () {
        const level = $(this).attr('rel');
        $(this).text(gameState.playerData.good_answers[level]);
    });
    $('.js-wrong-answers').each(function () {
        const level = $(this).attr('rel');
        $(this).text(gameState.playerData.wrong_answers[level]);
    });
}

export function updateStatsBestScore($) {
    const bestScores = {
        Normal: 0,
        Difficile: 0,
        Infernal: 0,
        Extrême: 0,
        Glitched: 0,
    };

    for (const scoreItem in gameState.playerData.scores) {
        const currentData = gameState.playerData.scores[scoreItem];
        const currentDifficulty = currentData[0];
        const currentScore = currentData[2];
        bestScores[currentDifficulty] =
            bestScores[currentDifficulty] > currentScore ? bestScores[currentDifficulty] : currentScore;
    }

    $('.js-best-score').each(function () {
        const level = $(this).attr('rel');
        $(this).text(bestScores[level]);
    });
}

export function openLeaderboard($) {
    $('body.glitched').addClass('no_glitch');
    $('.js-settings').removeClass('visible');
    $('.js-leaderboard').addClass('visible');
    $('.js-close-leaderboard').addClass('visible');
    $('.js-logout-button').addClass('hidden');
    $('.js-display-leaderboard').addClass('active');
    $('#wrapper').removeClass('game_ended');
}

export function closeLeaderboard($) {
    $('body.glitched').removeClass('no_glitch');
    $('.js-settings').addClass('visible');
    $('.js-leaderboard').removeClass('visible');
    $('.js-close-leaderboard').removeClass('visible');
    $('.js-display-leaderboard').removeClass('active');
    $('.js-logout-button').removeClass('hidden');
    $('.js-leaderboard-content').empty();
    $('.js-favorites-content').empty();
}
