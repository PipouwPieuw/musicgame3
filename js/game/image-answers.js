import { DEFAULT_COVER_PATH, IMAGE_ANSWER_COUNT } from '../config.js';
import { shuffleArray } from '../lib/shuffle.js';
import { getCoverPath } from '../lib/track-utils.js';
import { gameState } from './state.js';

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

    return shuffleArray(choices);
}

export function renderImageChoices($, choices) {
    const $list = $('.js-answers');
    $list.empty();

    choices.forEach(function (choice, index) {
        const coverPath = getCoverPath(choice.trackId);
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
}

export function resetImageAnswers($) {
    const $list = $('.js-answers');
    $list.empty().removeClass('playing');
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
