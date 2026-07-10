export const DEFAULT_GENRE = 'shows2000';
const GENRE_FILES = {
    shows2000: 'data/genres/shows2000.json',
    shows2010: 'data/genres/shows2010.json',
    shows1990: 'data/genres/shows1990.json',
    cartoons: 'data/genres/cartoons.json',
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

async function fetchGenreTracks(genreId, genreUrl) {
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

    let tracks;

    try {
        tracks = await response.json();
    } catch (error) {
        throw new Error(`Le fichier du genre "${genreId}" est invalide (JSON mal formé).`, { cause: error });
    }

    if (!Array.isArray(tracks) || tracks.length === 0) {
        throw new Error(`Le genre "${genreId}" doit contenir un tableau de morceaux non vide.`);
    }

    tracks.forEach(function (track, trackIndex) {
        validateTrack(track, trackIndex, genreId);
    });

    return tracks;
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

    const tracksByGenre = await Promise.all(
        genreEntries.map(async function ([genreId, genreUrl]) {
            const tracks = await fetchGenreTracks(genreId, genreUrl);
            return [genreId, tracks];
        })
    );

    tracksByGenre.forEach(function ([genreId, tracks]) {
        catalog[genreId] = tracks;
    });

    cachedCatalog = catalog;

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
