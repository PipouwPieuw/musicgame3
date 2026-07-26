import { COVERS_MANIFEST_PATH } from '../config.js';

let coversManifest = {};

export function findTrackById(tracks, trackId) {
    return tracks.find(function (track) {
        return track.id === trackId;
    });
}

export function getPreviewPath(trackId) {
    return `assets/audio/${trackId}.ogg`;
}

async function previewExists(trackId) {
    const path = getPreviewPath(trackId);

    try {
        let response = await fetch(path, { method: 'HEAD' });

        if (response.ok) {
            return true;
        }

        if (response.status === 405 || response.status === 501) {
            response = await fetch(path, { method: 'GET', headers: { Range: 'bytes=0-0' } });
        }

        return response.ok;
    } catch (error) {
        return false;
    }
}

export async function filterPlayableTracks(tracks) {
    const playableChecks = await Promise.all(
        tracks.map(async function (track) {
            const hasPreview = await previewExists(track.id);
            return hasPreview ? track : null;
        })
    );

    return playableChecks.filter(function (track) {
        return track !== null;
    });
}

/**
 * Load assets/covers/manifest.json once. On failure, alternate covers fall back to base id.
 */
export async function loadCoversManifest() {
    try {
        const response = await fetch(COVERS_MANIFEST_PATH);
        if (!response.ok) {
            coversManifest = {};
            return coversManifest;
        }
        const data = await response.json();
        coversManifest = data && typeof data === 'object' ? data : {};
    } catch (error) {
        console.warn('Failed to load covers manifest; using base covers only.', error);
        coversManifest = {};
    }
    return coversManifest;
}

export function getCoverStemsForTrack(trackId) {
    const stems = coversManifest[trackId];
    if (Array.isArray(stems) && stems.length > 0) {
        return stems;
    }
    return [trackId];
}

/**
 * Pick a cover stem. When useAlternates is true, choose uniformly among ID-prefixed variants.
 */
export function pickCoverStem(trackId, useAlternates) {
    if (!useAlternates) {
        return trackId;
    }
    const stems = getCoverStemsForTrack(trackId);
    return stems[Math.floor(Math.random() * stems.length)];
}

export function getCoverPath(trackId, coverStem) {
    const stem = coverStem || trackId;
    return `assets/covers/${stem}.webp`;
}

export function getTrackMetadata(tracks, trackId, coverStem) {
    const track = findTrackById(tracks, trackId);

    if (!track) {
        return {
            name: '',
            subTitle: '',
            image: '',
        };
    }

    return {
        name: track.title,
        subTitle: track.subTitle,
        image: getCoverPath(trackId, coverStem),
    };
}

export function migrateLikedTracksToIds(likedTracks, tracks) {
    if (!Array.isArray(likedTracks) || likedTracks.length === 0) {
        return [];
    }

    const trackIds = new Set(tracks.map(function (track) {
        return track.id;
    }));
    const migrated = [];

    for (const entry of likedTracks) {
        if (typeof entry === 'string' && trackIds.has(entry)) {
            if (!migrated.includes(entry)) {
                migrated.push(entry);
            }
            continue;
        }

        if (typeof entry === 'number' && tracks[entry] && tracks[entry].id) {
            const id = tracks[entry].id;
            if (!migrated.includes(id)) {
                migrated.push(id);
            }
        }
    }

    return migrated;
}
