export const DEFAULT_GENRE = 'shows2000';
const GENRE_FILES = {
    shows2000: 'data/genres/shows2000.json',
    shows2010: 'data/genres/shows2010.json',
    shows1990: 'data/genres/shows1990.json',
    // shows1980: 'data/genres/shows1980.json',
    animes: 'data/genres/animes.json',
    // cartoons: 'data/genres/cartoons.json',
};

let cachedCatalog = null;

function validateTrack(track, index, genreId) {
    const context = `genre "${genreId}", index ${index}`;

    if (!track || typeof track !== 'object') {
        throw new Error(`Invalid track at ${context}: expected an object`);
    }

    if (typeof track.title !== 'string' || !track.title.trim()) {
        throw new Error(`Invalid track at ${context}: "title" must be a non-empty string`);
    }

    if (track.subTitle != null && typeof track.subTitle !== 'string') {
        throw new Error(`Invalid track at ${context}: "subTitle" must be a string when provided`);
    }

    if (track.year != null && typeof track.year !== 'string') {
        throw new Error(`Invalid track at ${context}: "year" must be a string when provided`);
    }

    if (track.cover != null && typeof track.cover !== 'string') {
        throw new Error(`Invalid track at ${context}: "cover" must be a string when provided`);
    }

    if (typeof track.id !== 'string' || !track.id.trim()) {
        throw new Error(`Invalid track at ${context}: "id" must be a non-empty string`);
    }

    if (!Array.isArray(track.acceptedAnswers) || track.acceptedAnswers.length === 0) {
        throw new Error(`Invalid track at ${context}: "acceptedAnswers" must be a non-empty array`);
    }

    track.acceptedAnswers.forEach(function (answer, answerIndex) {
        if (typeof answer !== 'string' || !answer.trim()) {
            throw new Error(
                `Invalid track at ${context}: "acceptedAnswers[${answerIndex}]" must be a non-empty string`
            );
        }
    });
}

function validateGenrePayload(genreId, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(
            `Le genre "${genreId}" doit être un objet contenant "label" et "tracks".`
        );
    }

    if (typeof payload.label !== 'string' || !payload.label.trim()) {
        throw new Error(`Le genre "${genreId}" doit avoir un "label" non vide.`);
    }

    if (!Array.isArray(payload.tracks) || payload.tracks.length === 0) {
        throw new Error(`Le genre "${genreId}" doit contenir un tableau de morceaux non vide.`);
    }

    payload.tracks.forEach(function (track, trackIndex) {
        validateTrack(track, trackIndex, genreId);
    });
}

async function fetchGenre(genreId, genreUrl) {
    let response;

    try {
        response = await fetch(genreUrl);
    } catch (error) {
        throw new Error(`Impossible de charger le genre "${genreId}". Vérifiez que le serveur local est démarré.`, {
            cause: error,
        });
    }

    if (!response.ok) {
        throw new Error(`Impossible de charger le genre "${genreId}" (${response.status}).`);
    }

    let payload;

    try {
        payload = await response.json();
    } catch (error) {
        throw new Error(`Le fichier du genre "${genreId}" est invalide (JSON mal formé).`, { cause: error });
    }

    validateGenrePayload(genreId, payload);

    return {
        label: payload.label.trim(),
        tracks: payload.tracks,
    };
}

async function fetchCatalog() {
    if (cachedCatalog) {
        return cachedCatalog;
    }

    const catalog = {};
    const genreEntries = Object.entries(GENRE_FILES);

    if (genreEntries.length === 0) {
        throw new Error('Le catalogue de morceaux ne contient aucun genre.');
    }

    const genres = await Promise.all(
        genreEntries.map(async function ([genreId, genreUrl]) {
            const genre = await fetchGenre(genreId, genreUrl);
            return [genreId, genre];
        })
    );

    genres.forEach(function ([genreId, genre]) {
        catalog[genreId] = genre;
    });

    cachedCatalog = catalog;

    return cachedCatalog;
}

export async function loadTracksFromGenres(genreIds) {
    if (!Array.isArray(genreIds) || genreIds.length === 0) {
        throw new Error('Au moins un genre doit être sélectionné.');
    }

    const catalog = await fetchCatalog();
    const availableGenres = Object.keys(catalog).join(', ');
    const tracks = [];

    for (const genreId of Object.keys(GENRE_FILES)) {
        if (!genreIds.includes(genreId)) {
            continue;
        }

        if (!catalog[genreId]) {
            throw new Error(`Genre inconnu : "${genreId}". Genres disponibles : ${availableGenres}.`);
        }

        tracks.push(...catalog[genreId].tracks);
    }

    const unknownGenres = genreIds.filter(function (genreId) {
        return !catalog[genreId];
    });

    if (unknownGenres.length > 0) {
        throw new Error(
            `Genre inconnu : "${unknownGenres.join('", "')}". Genres disponibles : ${availableGenres}.`
        );
    }

    if (tracks.length === 0) {
        throw new Error('Aucun morceau trouvé pour les genres sélectionnés.');
    }

    return tracks;
}

export function getAvailableGenreIds() {
    return Object.keys(GENRE_FILES);
}

export async function loadTracks(genre = DEFAULT_GENRE) {
    return loadTracksFromGenres([genre]);
}

export async function getCatalogGenres() {
    const catalog = await fetchCatalog();

    return Object.keys(GENRE_FILES).map(function (genreId) {
        const genre = catalog[genreId];

        return {
            id: genreId,
            label: genre.label,
            trackCount: genre.tracks.length,
            tracks: genre.tracks,
        };
    });
}

export async function getGenreLabel(genre = DEFAULT_GENRE) {
    const catalog = await fetchCatalog();

    if (!catalog[genre]) {
        const availableGenres = Object.keys(catalog).join(', ');
        throw new Error(`Genre inconnu : "${genre}". Genres disponibles : ${availableGenres}.`);
    }

    return catalog[genre].label;
}

export async function getAvailableGenres() {
    const catalog = await fetchCatalog();

    return Object.entries(catalog).map(function ([id, genre]) {
        return {
            id: id,
            label: genre.label,
        };
    });
}

function getStartYear(year) {
    if (typeof year !== 'string') {
        return Number.POSITIVE_INFINITY;
    }

    const match = year.match(/\d{4}/);
    return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

export async function groupTrackIdsByGenre(trackIds) {
    const catalog = await fetchCatalog();
    const foundIds = new Set(trackIds || []);

    return Object.entries(catalog)
        .map(function ([id, genre]) {
            const tracks = genre.tracks
                .map(function (track) {
                    return {
                        id: track.id,
                        title: track.title,
                        year: track.year,
                        found: foundIds.has(track.id),
                    };
                })
                .sort(function (a, b) {
                    const yearDiff = getStartYear(a.year) - getStartYear(b.year);
                    if (yearDiff !== 0) {
                        return yearDiff;
                    }
                    return a.title.localeCompare(b.title);
                });

            return {
                id: id,
                label: genre.label,
                totalTracks: tracks.length,
                foundCount: tracks.filter(function (track) {
                    return track.found;
                }).length,
                tracks: tracks,
            };
        })
        .filter(function (group) {
            return group.foundCount > 0;
        });
}
