import {
    DEFAULT_COVER_PATH,
    IMAGE_ALTER_CLASSES,
    IMAGE_ANSWER_COUNT,
    IMAGE_GLITCH_CLASSES,
} from '../config.js';
import { preloadImages } from '../lib/preload-image.js';
import { shuffleArray } from '../lib/shuffle.js';
import { getCoverPath, pickCoverStem } from '../lib/track-utils.js';
import { gameState, usesAlternateCovers } from './state.js';

const HALF_FOLD_CLASS = 'list_answers__avatar--glitch-half-fold';
const ALTER_INVERT_CLASS = 'list_answers__avatar--alter-invert';
/** invert() bands that stay readable — mid-range (~0.5) washes covers to grey */
const ALTER_INVERT_LOW = { min: 0, max: 0.3 };
const ALTER_INVERT_HIGH = { min: 0.7, max: 0.8 };

/**
 * Build IMAGE_ANSWER_COUNT vignette choices for the playing track.
 * Prefers unlocked covers from the same genre; fills remaining slots from other genres.
 */
export function buildImageChoices(correctTrackId, tracks) {
    const choices = [{ trackId: correctTrackId, isCorrect: true }];
    const correctTrack = tracks.find(function (track) {
        return track.id === correctTrackId;
    });
    const correctGenreId = correctTrack && correctTrack.genreId;

    const distractors = tracks.filter(function (track) {
        return track.id !== correctTrackId;
    });

    const sameGenre = [];
    const otherGenre = [];

    distractors.forEach(function (track) {
        if (correctGenreId && track.genreId === correctGenreId) {
            sameGenre.push(track.id);
        } else {
            otherGenre.push(track.id);
        }
    });

    // Same-genre distractors first (shuffled), then other genres as fallback.
    const distractorIds = shuffleArray(sameGenre).concat(shuffleArray(otherGenre));

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

/**
 * Shared Glitched-mode chance gate + intensity (rises with progress).
 * @returns {{ intensity: number } | null}
 */
function rollGlitchedProgress() {
    if (gameState.difficultyLevel !== 4) {
        return null;
    }

    const halfGame = gameState.tracksByGame / 2;
    // Round 1 ≈ 10% (for 20 tracks), mid-game ≈ 100% — mirrors audio jump escalation.
    const chancePercent = Math.min(100, Math.floor((gameState.playedTracks / halfGame) * 100));

    if (Math.random() * 100 >= chancePercent) {
        return null;
    }

    const intensity =
        gameState.tracksByGame <= 1
            ? 1
            : Math.min(1, Math.max(0, gameState.playedTracks / (gameState.tracksByGame - 1)));

    return { intensity };
}

/**
 * Per-image roll for Glitched mode animated effects.
 * delay / speed desync identical effects so they don't animate in lockstep.
 * @returns {{ className: string, intensity: number, delay: string, speed: number, fold?: object } | null}
 */
function rollImageGlitch() {
    if (IMAGE_GLITCH_CLASSES.length === 0) {
        return null;
    }

    const progress = rollGlitchedProgress();
    if (!progress) {
        return null;
    }

    const className =
        IMAGE_GLITCH_CLASSES[Math.floor(Math.random() * IMAGE_GLITCH_CLASSES.length)];

    // Negative delay = start mid-cycle (desync without waiting). Speed ≈ ±20%.
    const delay = (-Math.random() * 1.4).toFixed(3) + 's';
    const speed = Number((0.85 + Math.random() * 0.35).toFixed(3));

    const result = {
        className,
        intensity: progress.intensity,
        delay,
        speed,
    };

    if (className === HALF_FOLD_CLASS) {
        // 8 variants: axis (H/V split) × side × mirror axis (scaleX vs scaleY)
        const mirrorHorizontal = Math.random() < 0.5;
        result.fold = {
            vert: Math.random() < 0.5 ? 1 : 0,
            side: Math.random() < 0.5 ? 1 : 0,
            sx: mirrorHorizontal ? -1 : 1,
            sy: mirrorHorizontal ? 1 : -1,
        };
    }

    return result;
}

/**
 * Per-image roll for a static cover alteration (one at a time).
 * Independent of the glitch roll — can stack with a glitch on the same avatar.
 * @returns {{ className: string, invertAmount?: number } | null}
 */
function rollImageAlter() {
    if (IMAGE_ALTER_CLASSES.length === 0) {
        return null;
    }

    const progress = rollGlitchedProgress();
    if (!progress) {
        return null;
    }

    const className =
        IMAGE_ALTER_CLASSES[Math.floor(Math.random() * IMAGE_ALTER_CLASSES.length)];

    const result = { className };

    if (className === ALTER_INVERT_CLASS) {
        // Skip mid-range (~0.5 greys out covers). High band likelier late-game.
        const highBandChance = 0.25 + 0.55 * progress.intensity;
        const band =
            Math.random() < highBandChance ? ALTER_INVERT_HIGH : ALTER_INVERT_LOW;
        // Within the band, bias toward the upper end as the game progresses.
        const power = Math.max(0.2, 1 - progress.intensity);
        const t = Math.pow(Math.random(), power);
        result.invertAmount = Number((band.min + t * (band.max - band.min)).toFixed(3));
    }

    return result;
}

function escapeCssUrl(path) {
    return String(path).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export async function renderImageChoices($, choices) {
    const $list = $('.js-answers');
    $list.empty().removeClass('is-ready');

    const coverPaths = choices.map(function (choice) {
        return getCoverPath(choice.trackId, choice.coverStem);
    });

    choices.forEach(function (choice, index) {
        const coverPath = coverPaths[index];
        const glitch = rollImageGlitch();
        const alter = rollImageAlter();

        const $item = $(
            '<li class="list_answers__item list_answers__item--avatar">' +
                '<button type="button" class="list_answers__avatar js-answer" data-index="' +
                index +
                '">' +
                '<img class="list_answers__img" src="' +
                coverPath +
                '" alt="Pochette mystère" />' +
                '</button>' +
                '</li>'
        );

        const $avatar = $item.find('.list_answers__avatar');

        if (glitch) {
            $avatar.addClass(glitch.className);
            const cssVars = {
                '--cover-url': 'url("' + escapeCssUrl(coverPath) + '")',
                '--glitch-intensity': String(glitch.intensity),
                '--glitch-delay': glitch.delay,
                '--glitch-speed': String(glitch.speed),
            };
            if (glitch.fold) {
                cssVars['--glitch-fold-vert'] = String(glitch.fold.vert);
                cssVars['--glitch-fold-side'] = String(glitch.fold.side);
                cssVars['--glitch-fold-sx'] = String(glitch.fold.sx);
                cssVars['--glitch-fold-sy'] = String(glitch.fold.sy);
            }
            $avatar.css(cssVars);
        }

        if (alter) {
            $avatar.addClass(alter.className);
            if (alter.invertAmount !== undefined) {
                $avatar.css('--alter-invert', String(alter.invertAmount));
            }
        }

        $item.find('img').on('error', function () {
            $(this).attr('src', DEFAULT_COVER_PATH);
            const $errAvatar = $(this).closest('.list_answers__avatar');
            if ($errAvatar.is('[class*="--glitch-"]')) {
                $errAvatar.css('--cover-url', 'url("' + DEFAULT_COVER_PATH + '")');
            }
        });

        $list.append($item);
    });

    const resolvedPaths = await preloadImages(coverPaths);

    $list.find('.list_answers__img').each(function (index) {
        const resolvedPath = resolvedPaths[index];
        if (resolvedPath && resolvedPath !== coverPaths[index]) {
            $(this).attr('src', resolvedPath);
            const $avatar = $(this).closest('.list_answers__avatar');
            if ($avatar.is('[class*="--glitch-"]')) {
                $avatar.css('--cover-url', 'url("' + resolvedPath + '")');
            }
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
