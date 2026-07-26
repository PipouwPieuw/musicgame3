import { migrateScoreKey, NOT_FOUND_COVER_PATH, SCORE_KEY_GROUPS, SCORE_KEYS } from '../config.js';
import { returnBestScores } from '../lib/leaderboard-scores.js';
import { getCoverPath, getTrackMetadata } from '../lib/track-utils.js';
import { groupTrackIdsByGenre } from '../services/tracks-loader.js';
import { gameState } from '../game/state.js';
import {
    playAnswerRevealAppear,
    playAnswerRevealDismiss,
    setAnswerRevealContent,
} from './answer-reveal.js';
import { isScoreKeyEnabled, isScoreKeyUnlocked } from './vignettes-unlock.js';
import { getAchievementDefinitions } from '../achievements/loader.js';
import { getConditionProgress } from '../achievements/evaluator.js';
import {
    getAchievementUnlockDate,
    isAchievementUnlocked,
} from '../achievements/personal.js';
import { getGlobalTrophiesForDisplay } from '../achievements/global.js';

export { returnBestScores } from '../lib/leaderboard-scores.js';

let foundTrackRevealDismissArmed = false;

function buildScoresList($, scores) {
    const scoresList = $('<ul class="leaderboard__list"></ul>');
    scoresList.append(
        $('<li class="leaderboard__item"><span class="leaderboard__value--head leaderboard__value--name">Joueur</span><span class="leaderboard__value--head leaderboard__value--tracks">Nombre de morceaux</span><span class="leaderboard__value--head leaderboard__value--points">Score</span></li>')
    );
    for (const currentScore in scores) {
        const [name, tracks, points] = scores[currentScore];
        const scoresItem = $('<li class="leaderboard__item"></li>');
        scoresItem.append($('<span class="leaderboard__value leaderboard__value--name">' + name + '</span>'));
        scoresItem.append($('<span class="leaderboard__value leaderboard__value--tracks">' + tracks + '</span>'));
        scoresItem.append($('<span class="leaderboard__value leaderboard__value--points">' + points + '</span>'));
        scoresList.append(scoresItem);
    }
    return scoresList;
}

export function buildLeaderboard($, object, title) {
    const modeBlocks = [];

    for (const group of SCORE_KEY_GROUPS) {
        const entries = [];
        for (const entry of group.keys) {
            const label = entry.key;
            // Show every currently offered mode (enabled), not only personally unlocked ones.
            if (!isScoreKeyEnabled(label)) {
                continue;
            }
            if (!object[label] || object[label].length == 0) {
                continue;
            }

            entries.push({
                difficultyLabel: entry.difficultyLabel,
                titleModifier: SCORE_KEYS.indexOf(label) + 1,
                scoresList: buildScoresList($, object[label]),
            });
        }
        if (entries.length === 0) {
            continue;
        }
        modeBlocks.push({
            modeLabel: group.modeLabel,
            entries: entries,
        });
    }

    if (modeBlocks.length === 0) {
        return;
    }

    $('.js-leaderboard-content').append('<span class="leaderboard__section_title">' + title + '</span>');
    for (const block of modeBlocks) {
        const hasDifficultyLadder = block.entries.some(function (entry) {
            return entry.difficultyLabel;
        });
        let modeTitleClass = 'leaderboard__mode_title panel_label';
        // if (!hasDifficultyLadder && block.entries[0]) {
            modeTitleClass +=
                ' leaderboard__title leaderboard__title--' + block.entries[0].titleModifier;
        // }
        $('.js-leaderboard-content').append(
            '<span class="' + modeTitleClass + '">' + block.modeLabel + '</span>'
        );
        for (const entry of block.entries) {
            if (entry.difficultyLabel) {
                $('.js-leaderboard-content').append(
                    '<span class="leaderboard__title panel_label">' +
                        entry.difficultyLabel +
                        '</span>'
                );
            }
            $('.js-leaderboard-content').append(entry.scoresList);
        }
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

export async function buildGlobalTrophies($) {
    const trophies = await getGlobalTrophiesForDisplay();
    const $container = $('.js-global-trophies-list');
    $container.empty();

    trophies.forEach(function (entry) {
        const definition = entry.definition;
        const holder = entry.holder;
        const $card = $('<div class="liked_track trophy_card"></div>');

        const $image = $('<div class="trophy__image"></div>');
        $image.append(
            $('<img>').attr('src', definition.image).attr('alt', '').attr('role', 'decoration')
        );

        const $details = $('<div class="liked_track__details trophy__details"></div>');
        const $content = $('<div class="liked_track__content"></div>');
        $content.append($('<div class="liked_track__name"></div>').text('🏆 ' + definition.name));
        $content.append(
            $('<div class="liked_track__description"></div>').text(definition.description)
        );
        $details.append($content);

        const $value = $('<div class="trophy__value"></div>');
        if (holder) {
            const $holder = $('<div class="trophy__holder"></div>');
            // $holder.append(
            //     $('<img class="trophy__holder_avatar">')
            //         .attr('src', 'assets/avatars/' + holder.initials + '.png')
            //         .attr('alt', holder.username)
            // );
            $holder.append($('<span class="trophy__holder_name"></span>').text(holder.username));
            $details.append($holder);
            $value.append($('<span></span>').text(holder.value));
            $value.append(document.createTextNode(' ' + definition.valueLabel));
        } else {
            $value.text('Aucun détenteur pour le moment');
        }
        $details.append($value);

        $card.append($image);
        $card.append($details);
        $container.append($card);
    });
}

export function buildAchievementsTab($) {
    const definitions = getAchievementDefinitions();
    const $container = $('.js-achievements-list');
    $container.empty();

    definitions.forEach(function (achievement) {
        const unlocked = isAchievementUnlocked(gameState.playerData, achievement.id);
        const $card = $('<div class="liked_track achievement_card"></div>');
        $card.toggleClass('achievement_card--locked', !unlocked);
        $card.toggleClass('achievement_card--unlocked', unlocked);

        const $image = $('<div class="trophy__image achievement_card__image"></div>');
        if (unlocked) {
            $image.append(
                $('<img>').attr('src', achievement.image).attr('alt', achievement.name)
            );
        } else {
            $image.append($('<div class="achievement_card__placeholder" aria-hidden="true"></div>'));
        }

        const $details = $('<div class="liked_track__details trophy__details"></div>');
        const $content = $('<div class="liked_track__content"></div>');
        $content.append($('<div class="liked_track__name"></div>').text(achievement.name));
        $content.append(
            $('<div class="liked_track__description"></div>').text(achievement.description)
        );
        $details.append($content);

        if (!unlocked && achievement.condition) {
            const progress = getConditionProgress(achievement.condition, gameState.playerData, {});
            if (progress) {
                const label = achievement.progressLabel || '';
                $details.append(
                    $('<div class="achievement_card__progress"></div>').text(
                        progress.current + ' / ' + progress.target + (label ? ' ' + label : '')
                    )
                );
            }
        }

        if (unlocked) {
            const unlockedAt = getAchievementUnlockDate(gameState.playerData, achievement.id);
            if (unlockedAt) {
                const date = new Date(unlockedAt);
                $details.append(
                    $('<div class="achievement_card__date"></div>').text(
                        'Obtenu le ' + date.toLocaleDateString('fr-FR')
                    )
                );
            }
        }

        $card.append($image);
        $card.append($details);
        $container.append($card);
    });
}

/** @deprecated Use buildGlobalTrophies */
export async function buildTrophies($) {
    await buildGlobalTrophies($);
}

export async function buildFoundTracks($) {
    const $container = $('.js-found-tracks-list');
    $container.empty();

    const foundTracks = gameState.playerData.foundTracksIds || [];
    $('.js-found-tracks-count').text(foundTracks.length);

    const genreGroups = await groupTrackIdsByGenre(foundTracks);

    genreGroups.forEach(function (group) {
        const $genre = $('<details class="found_tracks__genre"></details>');
        $genre.append(
            $('<summary class="found_tracks__genre_label"></summary>').append(
                group.label + ' (' + group.foundCount + '/' + group.totalTracks + ')'
            )
        );

        const $list = $('<ul class="found_tracks__list"></ul>');
        group.tracks.forEach(function (track) {
            const $item = $('<li class="found_tracks__item"></li>');

            if (track.found) {
                $item
                    .addClass('found_tracks__item--found js-found-track')
                    .attr('data-track-id', track.id)
                    .attr('data-track-title', track.title)
                    .attr('data-track-year', track.year || '')
                    .attr('role', 'button')
                    .attr('tabindex', '0')
                    .attr('aria-label', track.title)
                    .append($('<img>').attr('src', getCoverPath(track.id)).attr('alt', track.title));
            } else {
                $item
                    .addClass('found_tracks__item--locked')
                    .append($('<img>').attr('src', NOT_FOUND_COVER_PATH).attr('alt', ''));
            }

            $list.append($item);
        });

        $genre.append($list);
        $container.append($genre);
    });
}

function dismissFoundTrackReveal($) {
    if (!foundTrackRevealDismissArmed) {
        return;
    }

    foundTrackRevealDismissArmed = false;
    $(document).off('click.foundTrackReveal');
    playAnswerRevealDismiss($);
}

export function initFoundTracksReveal($) {
    $('body').on('click', '.js-found-track', function (event) {
        if (foundTrackRevealDismissArmed) {
            dismissFoundTrackReveal($);
            return;
        }

        event.stopPropagation();

        const $item = $(this);
        const trackId = $item.attr('data-track-id');
        const title = $item.attr('data-track-title') || '';
        const year = $item.attr('data-track-year') || '';

        setAnswerRevealContent($, {
            title: title,
            imagePath: getCoverPath(trackId),
            year: year,
        }).then(function () {
            playAnswerRevealAppear($, { effect: 'none' });

            setTimeout(function () {
                foundTrackRevealDismissArmed = true;
                $(document).on('click.foundTrackReveal', function () {
                    dismissFoundTrackReveal($);
                });
            }, 0);
        });
    });
}

/**
 * Hide stats columns / mode tables the player has not unlocked yet
 * (same gate as Classement via isScoreKeyUnlocked).
 */
export function syncStatsDifficultyColumns($) {
    for (const i in SCORE_KEYS) {
        const scoreKey = SCORE_KEYS[i];
        const unlocked = isScoreKeyUnlocked(scoreKey, gameState.playerData);
        $('.js-stats-col[data-score-key="' + scoreKey + '"]').toggleClass('is-hidden', !unlocked);
    }

    $('.stats_table').each(function () {
        const $table = $(this);
        const $cols = $table.find('.js-stats-col[data-score-key]');
        if ($cols.length === 0) {
            return;
        }
        const hasVisibleCol = $cols.filter(':not(.is-hidden)').length > 0;
        $table.toggleClass('is-hidden', !hasVisibleCol);
    });
}

export function updateStatsGamesPlayed($) {
    $('.js-games-played').each(function () {
        const level = $(this).attr('rel');
        $(this).text((gameState.playerData.games_played && gameState.playerData.games_played[level]) || 0);
    });
}

export function updateStatsCodexIdentified($) {
    const count = Array.isArray(gameState.playerData?.foundTracksIds)
        ? gameState.playerData.foundTracksIds.length
        : 0;
    $('.js-codex-identified-count').text(count);
}

export function updateStatsAnswers($) {
    $('.js-good-answers').each(function () {
        const level = $(this).attr('rel');
        $(this).text((gameState.playerData.good_answers && gameState.playerData.good_answers[level]) || 0);
    });
    $('.js-wrong-answers').each(function () {
        const level = $(this).attr('rel');
        $(this).text((gameState.playerData.wrong_answers && gameState.playerData.wrong_answers[level]) || 0);
    });
}

export function updateStatsBestScore($) {
    const bestScores = {};
    for (const i in SCORE_KEYS) {
        bestScores[SCORE_KEYS[i]] = 0;
    }

    for (const scoreItem in gameState.playerData.scores) {
        const currentData = gameState.playerData.scores[scoreItem];
        const currentDifficulty = migrateScoreKey(currentData[0]);
        const currentScore = currentData[2];
        if (!currentDifficulty || !(currentDifficulty in bestScores)) {
            continue;
        }
        bestScores[currentDifficulty] =
            bestScores[currentDifficulty] > currentScore ? bestScores[currentDifficulty] : currentScore;
    }

    $('.js-best-score').each(function () {
        const level = $(this).attr('rel');
        $(this).text(bestScores[level] || 0);
    });
}

export function openLeaderboard($) {
    $('.js-settings').removeClass('visible');
    $('.js-leaderboard').addClass('visible');
    $('.js-close-leaderboard').addClass('visible');
    $('.js-logout-button').addClass('hidden');
    $('.js-display-leaderboard').addClass('active');
    $('#wrapper').removeClass('game_ended');
}

export function closeLeaderboard($) {
    $('.js-settings').addClass('visible');
    $('.js-leaderboard').removeClass('visible');
    $('.js-close-leaderboard').removeClass('visible');
    $('.js-display-leaderboard').removeClass('active');
    $('.js-logout-button').removeClass('hidden');
    $('.js-leaderboard-content').empty();
    $('.js-favorites-content').empty();
}
