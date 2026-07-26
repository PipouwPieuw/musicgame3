import { DEFAULT_COVER_PATH, IMAGE_ANSWER_COUNT } from '../config.js';
import { preloadImages } from '../lib/preload-image.js';
import { shuffleArray } from '../lib/shuffle.js';
import { getCoverPath, pickCoverStem } from '../lib/track-utils.js';
import { usesAlternateCovers } from './state.js';

export function buildImageChoices(correctTrackId, tracks) {
    const choices = [{ trackId: correctTrackId, isCorrect: true }];
    const distractorIds = shuffleArray(
        tracks
            .map(function (track) {
                return track.id;
            })
            .filter(function (trackId) {
                return trackId !== correctTrackId;
            })
    );

    for (const trackId of distractorIds) {
        if (choices.length >= IMAGE_ANSWER_COUNT) {
            break;
        }
        choices.push({ trackId, isCorrect: false });
    }

    const useAlternates = usesAlternateCovers();

    return shuffleArray(choices).map(function (choice) {
        return {
            trackId: choice.trackId,
            isCorrect: choice.isCorrect,
            coverStem: pickCoverStem(choice.trackId, useAlternates),
        };
    });
}

export async function renderImageChoices($, choices) {
    const $list = $('.js-answers');
    $list.empty().removeClass('is-ready');

    const coverPaths = choices.map(function (choice) {
        return getCoverPath(choice.trackId, choice.coverStem);
    });

    choices.forEach(function (choice, index) {
        const coverPath = coverPaths[index];
        const $item = $(
            '<li class="list_answers__item list_answers__item--avatar">' +
                '<button type="button" class="list_answers__avatar js-answer" data-index="' +
                index +
                '">' +
                '<img class="list_answers__img" src="' +
                coverPath +
                '" alt="Pochette candidate" />' +
                '</button>' +
                '</li>'
        );

        $item.find('img').on('error', function () {
            $(this).attr('src', DEFAULT_COVER_PATH);
        });

        $list.append($item);
    });

    const resolvedPaths = await preloadImages(coverPaths);

    $list.find('.list_answers__img').each(function (index) {
        const resolvedPath = resolvedPaths[index];
        if (resolvedPath && resolvedPath !== coverPaths[index]) {
            $(this).attr('src', resolvedPath);
        }
    });

    $list.addClass('is-ready');
}

export function resetImageAnswers($) {
    const $list = $('.js-answers');
    $list.empty().removeClass('playing is-ready');
    $list.find('.js-answer').removeClass('correct incorrect');
}

export function enableImageAnswers($) {
    $('.js-answers').addClass('playing');
}

export function disableImageAnswers($) {
    $('.js-answers').removeClass('playing');
}

export function getImageAnswerButton($, index) {
    return $('.js-answers .js-answer[data-index="' + index + '"]');
}

/** Cover stem shown for the correct choice this round (for reveal sync). */
export function getCorrectChoiceCoverStem(choices) {
    if (!Array.isArray(choices)) {
        return null;
    }
    for (let i = 0; i < choices.length; i++) {
        if (choices[i] && choices[i].isCorrect) {
            return choices[i].coverStem || choices[i].trackId;
        }
    }
    return null;
}
