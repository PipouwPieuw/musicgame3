const TRACKS_URL = 'data/tracks.json';
export const DEFAULT_GENRE = 'shows2000';

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
}

function parseGenreCatalog(data) {
    if (!Array.isArray(data.tracks) || data.tracks.length === 0) {
        throw new Error('Le catalogue de morceaux doit contenir un tableau "tracks" non vide.');
    }

    const catalog = {};

    data.tracks.forEach(function (entry, entryIndex) {
        if (!entry || typeof entry !== 'object') {
            throw new Error(`Invalid genre group at index ${entryIndex}: expected an object`);
        }

        Object.entries(entry).forEach(function ([genreId, tracks]) {
            if (catalog[genreId]) {
                throw new Error(`Genre dupliqué dans le catalogue : "${genreId}".`);
            }

            if (!Array.isArray(tracks) || tracks.length === 0) {
                throw new Error(`Le genre "${genreId}" doit contenir un tableau de morceaux non vide.`);
            }

            tracks.forEach(function (track, trackIndex) {
                validateTrack(track, trackIndex, genreId);
            });

            catalog[genreId] = tracks;
        });
    });

    if (Object.keys(catalog).length === 0) {
        throw new Error('Le catalogue de morceaux ne contient aucun genre.');
    }

    return catalog;
}

async function fetchCatalog() {
    if (cachedCatalog) {
        return cachedCatalog;
    }

    let response;

    try {
        response = await fetch(TRACKS_URL);
    } catch (error) {
        throw new Error('Impossible de charger le catalogue de morceaux. Vérifiez que le serveur local est démarré.', {
            cause: error,
        });
    }

    if (!response.ok) {
        throw new Error(`Impossible de charger le catalogue de morceaux (${response.status}).`);
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error('Le fichier de morceaux est invalide (JSON mal formé).', { cause: error });
    }

    cachedCatalog = parseGenreCatalog(data);

    return cachedCatalog;
}

export async function loadTracks(genre = DEFAULT_GENRE) {
    const catalog = await fetchCatalog();

    if (!catalog[genre]) {
        const availableGenres = Object.keys(catalog).join(', ');
        throw new Error(`Genre inconnu : "${genre}". Genres disponibles : ${availableGenres}.`);
    }

    return catalog[genre];
}

export async function getAvailableGenres() {
    const catalog = await fetchCatalog();
    return Object.keys(catalog);
}
