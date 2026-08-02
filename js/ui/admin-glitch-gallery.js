import {
    DEFAULT_COVER_PATH,
    IMAGE_ALTER_CLASSES,
    IMAGE_GLITCH_CLASSES,
} from '../config.js';
import { applyAvatarEffects } from '../game/image-answers.js';
import { gameState } from '../game/state.js';
import { canAccessTestFeatures } from '../lib/admin.js';
import { preloadImages } from '../lib/preload-image.js';
import { getCoverPath } from '../lib/track-utils.js';

const HALF_FOLD_CLASS = 'list_answers__avatar--glitch-half-fold';
const ALTER_INVERT_CLASS = 'list_answers__avatar--alter-invert';
/** Representative invert amount for gallery previews (high band). */
const GALLERY_INVERT_AMOUNT = 0.75;
const GALLERY_INTENSITY = 1;
const GALLERY_DELAY = '0s';
const GALLERY_SPEED = 1;

function shortEffectName(className) {
    const match = String(className || '').match(/--(?:glitch|alter)-(.+)$/);
    return match ? match[1] : className;
}

function getHalfFoldVariants() {
    const folds = [];
    [0, 1].forEach(function (vert) {
        [0, 1].forEach(function (side) {
            [true, false].forEach(function (mirrorHorizontal) {
                folds.push({
                    vert: vert,
                    side: side,
                    sx: mirrorHorizontal ? -1 : 1,
                    sy: mirrorHorizontal ? 1 : -1,
                });
            });
        });
    });
    return folds;
}

/** All glitch variants (half-fold expanded to its 8 fold combinations). */
function getGlitchVariants() {
    const variants = [];

    IMAGE_GLITCH_CLASSES.forEach(function (className) {
        if (className === HALF_FOLD_CLASS) {
            getHalfFoldVariants().forEach(function (fold, index) {
                variants.push({
                    className: className,
                    intensity: GALLERY_INTENSITY,
                    delay: GALLERY_DELAY,
                    speed: GALLERY_SPEED,
                    fold: fold,
                    label: 'half-fold-' + (index + 1),
                });
            });
            return;
        }

        variants.push({
            className: className,
            intensity: GALLERY_INTENSITY,
            delay: GALLERY_DELAY,
            speed: GALLERY_SPEED,
            label: shortEffectName(className),
        });
    });

    return variants;
}

function getAlterVariants() {
    return IMAGE_ALTER_CLASSES.map(function (className) {
        const alter = {
            className: className,
            label: shortEffectName(className),
        };
        if (className === ALTER_INVERT_CLASS) {
            alter.invertAmount = GALLERY_INVERT_AMOUNT;
        }
        return alter;
    });
}

function getSampleCoverPath() {
    const track = gameState.tracks && gameState.tracks[0];
    if (track && track.id) {
        return getCoverPath(track.id);
    }
    return DEFAULT_COVER_PATH;
}

function escapeAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function buildGallery($) {
    const $list = $('.js-glitch-gallery-list');
    $list.empty().removeClass('is-ready');

    const coverPath = getSampleCoverPath();
    const glitchVariants = getGlitchVariants();
    const alterVariants = getAlterVariants();

    function appendTile(glitch, alter, label) {
        const $item = $(
            '<li class="list_answers__item list_answers__item--avatar glitch_gallery__item">' +
                '<button type="button" class="list_answers__avatar" title="' +
                escapeAttr(label) +
                '" aria-label="' +
                escapeAttr(label) +
                '">' +
                '<img class="list_answers__img" src="' +
                escapeAttr(coverPath) +
                '" alt="" />' +
                '</button>' +
                '<span class="glitch_gallery__label">' +
                escapeAttr(label) +
                '</span>' +
                '</li>'
        );

        const $avatar = $item.find('.list_answers__avatar');
        applyAvatarEffects($avatar, coverPath, glitch, alter);

        $item.find('img').on('error', function () {
            $(this).attr('src', DEFAULT_COVER_PATH);
            const $errAvatar = $(this).closest('.list_answers__avatar');
            if ($errAvatar.is('[class*="--glitch-"]')) {
                $errAvatar.css('--cover-url', 'url("' + DEFAULT_COVER_PATH + '")');
            }
        });

        $list.append($item);
    }

    glitchVariants.forEach(function (glitch) {
        if (glitch.className === HALF_FOLD_CLASS) {
            // Half-fold: independent alter on base half × fold half.
            alterVariants.forEach(function (baseAlter) {
                alterVariants.forEach(function (foldAlter) {
                    const label =
                        glitch.label +
                        ' | base:' +
                        baseAlter.label +
                        ' / fold:' +
                        foldAlter.label;
                    appendTile(glitch, { base: baseAlter, fold: foldAlter }, label);
                });
            });
            return;
        }

        alterVariants.forEach(function (alter) {
            appendTile(glitch, alter, glitch.label + ' + ' + alter.label);
        });
    });

    const resolved = await preloadImages([coverPath]);
    const resolvedPath = resolved[0] || coverPath;
    if (resolvedPath !== coverPath) {
        $list.find('.list_answers__img').attr('src', resolvedPath);
        $list.find('.list_answers__avatar[class*="--glitch-"]').css(
            '--cover-url',
            'url("' + resolvedPath + '")'
        );
    }

    $list.addClass('is-ready');
}

export function closeAdminGlitchGallery($) {
    $('.js-glitch-gallery').removeClass('visible');
}

async function openAdminGlitchGallery($) {
    if (!canAccessTestFeatures()) {
        return;
    }

    const $gallery = $('.js-glitch-gallery');
    await buildGallery($);
    $gallery.addClass('visible');
}

export function initAdminGlitchGallery($) {
    $('.js-toggle-glitch-gallery').on('click', function () {
        if (!canAccessTestFeatures()) {
            return;
        }
        const $gallery = $('.js-glitch-gallery');
        if ($gallery.hasClass('visible')) {
            closeAdminGlitchGallery($);
            return;
        }
        openAdminGlitchGallery($).catch(function (error) {
            console.error('Failed to open glitch gallery', error);
        });
    });

    $('.js-close-glitch-gallery').on('click', function () {
        closeAdminGlitchGallery($);
    });
}
