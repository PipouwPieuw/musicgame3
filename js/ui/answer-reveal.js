import { DEFAULT_COVER_PATH, NOT_FOUND_COVER_PATH } from '../config.js';
import { preloadImage } from '../lib/preload-image.js';
import { gameState, isClassicMode } from '../game/state.js';

/** Delay before the cover scales in. */
const REVEAL_IMAGE_VISIBLE_MS = 10;
/** Delay before the title text expands. */
const REVEAL_TEXT_APPEAR_MS = 150;
/** When shine / coin-flip starts (after appear). */
const REVEAL_EFFECT_START_MS = 500;
const FLIP_REVEAL_EFFECT_START_MS = 300;
/** Shine / flip effect length. */
const REVEAL_EFFECT_DURATION_MS = 500;
/** Auto-dismiss after correct-answer reveal. */
const REVEAL_AUTO_DISMISS_MS = 1500;

function getRevealEls($) {
    return {
        $cover: $('.js-answer-reveal-cover'),
        $flip: $('.js-answer-reveal-flip'),
        $coverImg: $('.js-answer-reveal-cover-img'),
        $front: $('.js-answer-reveal-front'),
        $back: $('.js-answer-reveal-back'),
    };
}

function getActiveRevealImage($) {
    return $('.js-answer-reveal-cover.is-active, .js-answer-reveal-flip.is-active');
}

/**
 * Activate either the plain cover or the coin flip element.
 * @param {'cover' | 'flip'} mode
 */
function setRevealMode($, mode) {
    const { $cover, $flip } = getRevealEls($);
    $cover.toggleClass('is-active', mode === 'cover').removeClass('visible shine');
    $flip.toggleClass('is-active', mode === 'flip').removeClass('visible is-flipped');
}

export async function setAnswerRevealContent($, { title, imagePath, discovery = false }) {
    $('.js-answer-reveal-text').text(title || '');

    const { $coverImg, $front, $back } = getRevealEls($);
    setRevealMode($, discovery ? 'flip' : 'cover');

    if (discovery) {
        const [coverPath, mysteryPath] = await Promise.all([
            preloadImage(imagePath || DEFAULT_COVER_PATH),
            preloadImage(NOT_FOUND_COVER_PATH),
        ]);
        $front.attr('src', coverPath);
        $back.attr('src', mysteryPath);
        return;
    }

    const coverPath = await preloadImage(imagePath || DEFAULT_COVER_PATH);
    $coverImg.attr('src', coverPath);
}

/**
 * @param {'shine' | 'flip' | 'none'} effect
 */
export function playAnswerRevealAppear($, { effect = 'shine' } = {}) {
    let $image = getActiveRevealImage($);
    if (!$image.length) {
        setRevealMode($, effect === 'flip' ? 'flip' : 'cover');
        $image = getActiveRevealImage($);
    }

    $('.js-answer-reveal').addClass('toggled');
    setTimeout(function () {
        $image.addClass('visible');
    }, REVEAL_IMAGE_VISIBLE_MS);
    setTimeout(function () {
        // $('.js-answer-reveal-star').addClass('active');
        $('.js-answer-reveal-text-wrapper').addClass('appear');
    }, REVEAL_TEXT_APPEAR_MS);

    if (effect === 'none') {
        return;
    }

    if (effect === 'flip') {
        setTimeout(function () {
            $image.addClass('is-flipped');
        }, FLIP_REVEAL_EFFECT_START_MS);        
        setTimeout(function () {
            $('.js-answer-reveal-star').addClass('active');
        }, FLIP_REVEAL_EFFECT_START_MS * 2);
        return;
    }

    // effect === 'shine'
    setTimeout(function () {
        $image.addClass('shine');
    }, REVEAL_EFFECT_START_MS);
    setTimeout(function () {
        $image.removeClass('shine');
    }, REVEAL_EFFECT_START_MS + REVEAL_EFFECT_DURATION_MS);
}

export function playAnswerRevealDismiss($) {
    $('.js-answer-reveal-text-wrapper').removeClass('appear');
    setTimeout(function () {
        getActiveRevealImage($).removeClass('visible');
    }, 200);
    setTimeout(function () {
        // $('.js-answer-reveal-star').removeClass('active');
        $('.js-answer-reveal').removeClass('toggled');
        $('.js-answer-reveal-cover').removeClass('shine is-active');
        $('.js-answer-reveal-flip').removeClass('is-flipped is-active');
        $('.js-answer-reveal-star').removeClass('active');
    }, 300);
}

export function isTrackDiscovery(trackId) {
    return (
        isClassicMode() &&
        !(gameState.playerData.foundTracksIds || []).includes(trackId)
    );
}

export function animateCorrectAnswer($) {
    const effect = isTrackDiscovery(gameState.currentTrackId) ? 'flip' : 'shine';
    playAnswerRevealAppear($, { effect });
    setTimeout(function () {
        playAnswerRevealDismiss($);
    }, REVEAL_AUTO_DISMISS_MS);
}
