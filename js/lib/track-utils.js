export function findTrackById(tracks, trackId) {
    return tracks.find(function (track) {
        return track.id === trackId;
    });
}

export function getPreviewPath(trackId) {
    return `assets/previews/${trackId}.m4a`;
}

export function getCoverPath(trackId) {
    return `assets/covers/${trackId}.jpg`;
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
        image: track.cover || getCoverPath(trackId),
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
