import { filterPlayableTracks } from '../lib/track-utils.js';
import { isAdminAccount } from '../lib/admin.js';
import { gameState, isCodexMode } from '../game/state.js';
import { getCatalogGenres } from '../services/tracks-loader.js';

/** @type {Array<{ id: string, label: string, trackCount: number, playableCount: number, playableTrackIds: string[] }>} */
let genresWithCounts = [];

function getFoundTrackIdsSet() {
    return new Set(gameState.playerData?.foundTracksIds || []);
}

function getGenreUnfoundCount(genre) {
    if (isAdminAccount()) {
        return 0;
    }

    const foundIds = getFoundTrackIdsSet();

    return genre.playableTrackIds.filter(function (trackId) {
        return !foundIds.has(trackId);
    }).length;
}

function formatGenreUnfoundCount(genre) {
    return '(' + getGenreUnfoundCount(genre) + ' à trouver)';
}

function getActiveGenreLabel() {
    const activeGenreId = gameState.activeGenres[0];
    const activeGenre = genresWithCounts.find(function (genre) {
        return genre.id === activeGenreId;
    });

    return activeGenre ? activeGenre.label : '';
}

function syncGenreListCounts($) {
    genresWithCounts.forEach(function (genre) {
        const $radio = $('.js-genre-radio[value="' + genre.id + '"]');
        $radio
            .closest('.genres_picker__item')
            .find('.genres_picker__count')
            .text(formatGenreUnfoundCount(genre));
    });
}

function syncActiveGenreButton($) {
    const label = getActiveGenreLabel();
    const $button = $('.js-open-genres-picker');

    $('.js-active-genre-label').text(label);
    $button.attr('aria-label', label).attr('title', label);
}

export function syncGenreSettingsUI($) {
    syncActiveGenreButton($);
    syncGenreListCounts($);
}

export function syncGenreRadios($) {
    const activeGenreId = gameState.activeGenres[0];

    $('.js-genre-radio').each(function () {
        $(this).prop('checked', $(this).val() === activeGenreId);
    });
}

export function closeGenresPicker($) {
    const dialog = $('.js-genres-picker').get(0);
    if (dialog && dialog.open) {
        dialog.close();
    }
}

export function syncGenreSettingsVisibility($) {
    const $settingsGenres = $('.js-settings-genres');

    if (isCodexMode()) {
        $settingsGenres.removeClass('is-hidden');
    } else {
        $settingsGenres.addClass('is-hidden');
        closeGenresPicker($);
    }
}

export function renderGenreList($) {
    const $list = $('.js-genres-list');
    const activeGenreId = gameState.activeGenres[0];
    $list.empty();

    genresWithCounts.forEach(function (genre) {
        const radioId = 'genre-' + genre.id;
        const $item = $('<li class="genres_picker__list_item"></li>');
        const $label = $('<label class="settings_difficulty__checkbox genres_picker__item"></label>').attr(
            'for',
            radioId
        );

        $label.append(
            $('<input type="radio" class="js-genre-radio" name="activeGenre" />')
                .attr('id', radioId)
                .attr('value', genre.id)
                .prop('checked', genre.id === activeGenreId)
        );
        $label.append(
            $('<span></span>').append(
                genre.label + ' ',
                $('<span class="genres_picker__count"></span>').text(formatGenreUnfoundCount(genre))
            )
        );

        $item.append($label);
        $list.append($item);
    });
}

export function openGenresPicker($) {
    syncGenreRadios($);
    syncGenreSettingsUI($);

    const dialog = $('.js-genres-picker').get(0);
    if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
    }
}

async function computeGenresWithCounts() {
    const catalogGenres = await getCatalogGenres();
    const playableCounts = await Promise.all(
        catalogGenres.map(async function (genre) {
            const playableTracks = await filterPlayableTracks(genre.tracks);

            return {
                id: genre.id,
                label: genre.label,
                trackCount: genre.trackCount,
                playableCount: playableTracks.length,
                playableTrackIds: playableTracks.map(function (track) {
                    return track.id;
                }),
            };
        })
    );

    genresWithCounts = playableCounts;
}

/**
 * @param {JQueryStatic} $
 * @param {() => Promise<void>} onGenresChange
 * @param {() => void} [onTracksSettingsSync]
 */
export async function initGenreSelection($, onGenresChange, onTracksSettingsSync) {
    await computeGenresWithCounts();
    renderGenreList($);
    syncGenreSettingsVisibility($);
    syncGenreSettingsUI($);

    $('.js-open-genres-picker').on('click', function () {
        openGenresPicker($);
    });

    $('.js-close-genres-picker').on('click', function () {
        closeGenresPicker($);
    });

    $('.js-genres-picker').on('click', function (event) {
        if (event.target === this) {
            closeGenresPicker($);
        }
    });

    $(document).on('change', '.js-genre-radio', async function () {
        const genreId = $(this).val();
        const previousGenres = [...gameState.activeGenres];

        gameState.activeGenres = [genreId];

        if (typeof onGenresChange === 'function') {
            try {
                await onGenresChange();
            } catch (error) {
                gameState.activeGenres = previousGenres;
                syncGenreRadios($);
                if (typeof onTracksSettingsSync === 'function') {
                    onTracksSettingsSync();
                } else {
                    syncGenreSettingsUI($);
                }
                return;
            }
        }

        syncGenreRadios($);
        syncGenreSettingsUI($);
    });
}
