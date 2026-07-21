import { filterPlayableTracks } from '../lib/track-utils.js';
import { getTracksForCurrentMode } from '../game/setlist.js';
import { gameState, isImageAnswerMode } from '../game/state.js';
import { getCatalogGenres } from '../services/tracks-loader.js';

/** @type {Array<{ id: string, label: string, trackCount: number, playableCount: number, playableTrackIds: string[] }>} */
let genresWithCounts = [];

function getFoundTrackIdsSet() {
    return new Set(gameState.playerData?.foundTracksIds || []);
}

function getGenreDisplayCount(genre) {
    if (isImageAnswerMode()) {
        const foundIds = getFoundTrackIdsSet();

        return genre.playableTrackIds.filter(function (trackId) {
            return foundIds.has(trackId);
        }).length;
    }

    return genre.playableCount;
}

function getModalTotalForCurrentMode() {
    if (isImageAnswerMode()) {
        return getTracksForCurrentMode().length;
    }

    return gameState.tracks.length;
}

export function getActiveGenresPlayableCount() {
    return gameState.tracks.length;
}

function syncGenreListCounts($) {
    genresWithCounts.forEach(function (genre) {
        const $checkbox = $('.js-genre-checkbox[value="' + genre.id + '"]');
        $checkbox
            .closest('.genres_picker__item')
            .find('.genres_picker__count')
            .text('(' + getGenreDisplayCount(genre) + ')');
    });

    $('.js-genres-modal-total').text(getModalTotalForCurrentMode());
}

export function updateActiveTracksCount($) {
    $('.js-active-tracks-count').text(getTracksForCurrentMode().length);
    syncGenreListCounts($);
}

export function syncGenreCheckboxes($) {
    $('.js-genre-checkbox').each(function () {
        const genreId = $(this).val();
        $(this).prop('checked', gameState.activeGenres.includes(genreId));
    });
}

export function renderGenreList($) {
    const $list = $('.js-genres-list');
    $list.empty();

    genresWithCounts.forEach(function (genre) {
        const checkboxId = 'genre-' + genre.id;
        const $item = $('<li class="genres_picker__list_item"></li>');
        const $label = $('<label class="settings_difficulty__checkbox genres_picker__item"></label>').attr(
            'for',
            checkboxId
        );

        $label.append(
            $('<input type="checkbox" class="js-genre-checkbox" />')
                .attr('id', checkboxId)
                .attr('value', genre.id)
                .prop('checked', gameState.activeGenres.includes(genre.id))
        );
        $label.append(
            $('<span></span>').append(
                genre.label + ' ',
                $('<span class="genres_picker__count"></span>').text('(' + getGenreDisplayCount(genre) + ')')
            )
        );

        $item.append($label);
        $list.append($item);
    });
}

export function openGenresPicker($) {
    syncGenreCheckboxes($);
    updateActiveTracksCount($);

    const dialog = $('.js-genres-picker').get(0);
    if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
    }
}

export function closeGenresPicker($) {
    const dialog = $('.js-genres-picker').get(0);
    if (dialog && dialog.open) {
        dialog.close();
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
    updateActiveTracksCount($);

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

    $(document).on('change', '.js-genre-checkbox', async function () {
        const genreId = $(this).val();
        const isChecked = $(this).prop('checked');
        const previousGenres = [...gameState.activeGenres];
        const nextGenres = isChecked
            ? [...gameState.activeGenres, genreId]
            : gameState.activeGenres.filter(function (activeGenreId) {
                  return activeGenreId !== genreId;
              });

        if (nextGenres.length === 0) {
            $(this).prop('checked', true);
            return;
        }

        gameState.activeGenres = nextGenres;

        if (typeof onGenresChange === 'function') {
            try {
                await onGenresChange();
            } catch (error) {
                gameState.activeGenres = previousGenres;
                syncGenreCheckboxes($);
                if (typeof onTracksSettingsSync === 'function') {
                    onTracksSettingsSync();
                } else {
                    updateActiveTracksCount($);
                }
                return;
            }
        }

        syncGenreCheckboxes($);
    });
}
