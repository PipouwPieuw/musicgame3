import { DEFAULT_COVER_PATH } from '../config.js';
import { preloadImage } from '../lib/preload-image.js';

export async function setAnswerRevealContent($, { title, imagePath }) {
    $('.js-answer-reveal-text').text(title || '');

    const $coverReveal = $('.js-answer-reveal-image img');
    const resolvedPath = await preloadImage(imagePath || DEFAULT_COVER_PATH);
    $coverReveal.attr('src', resolvedPath);
}

export function playAnswerRevealAppear($) {
    $('.js-answer-reveal').addClass('toggled');
    setTimeout(function () {
        $('.js-answer-reveal-image').addClass('visible');
    }, 10);
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
}

export function playAnswerRevealDismiss($) {
    $('.js-answer-reveal-text-wrapper').removeClass('appear');
    setTimeout(function () {
        $('.js-answer-reveal-image').removeClass('visible');
    }, 200);
    setTimeout(function () {
        // $('.js-answer-reveal-star').removeClass('active');
        $('.js-answer-reveal').removeClass('toggled');
    }, 300);
}

export function animateCorrectAnswer($) {
    playAnswerRevealAppear($);
    setTimeout(function () {
        playAnswerRevealDismiss($);
    }, 1500);
}
