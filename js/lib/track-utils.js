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

export function getCoverPath(trackId) {
    return `assets/covers/${trackId}.png`;
}

export function getTrackMetadata(tracks, trackId) {
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
        image: getCoverPath(trackId),
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
