import { getLegacyProfile, removeLegacyProfile } from './local-storage.js';

async function requestJson(url, options) {
    const response = await fetch(url, options);

    if (!response.ok) {
        let message = 'Requête échouée';
        try {
            const payload = await response.json();
            if (payload.error) {
                message = payload.error;
            }
        } catch (_error) {
            // Ignore JSON parse errors on failed responses.
        }
        throw new Error(message);
    }

    return response.json();
}

function profileIsEmpty(profile) {
    const hasScores = Array.isArray(profile.scores) && profile.scores.length > 0;
    const hasLikes = Array.isArray(profile.likedTracks) && profile.likedTracks.length > 0;
    const hasGames = Object.values(profile.games_played || {}).some(function (value) {
        return value > 0;
    });
    const hasAnswers =
        Object.values(profile.good_answers || {}).some(function (value) {
            return value > 0;
        }) ||
        Object.values(profile.wrong_answers || {}).some(function (value) {
            return value > 0;
        });

    return !hasScores && !hasLikes && !hasGames && !hasAnswers;
}

function legacyProfileHasData(profile) {
    return !profileIsEmpty(profile);
}

async function fetchPlayerResponse(username) {
    return requestJson('/api/players/' + encodeURIComponent(username));
}

async function migrateLocalProfileIfNeeded(username, serverProfile, created) {
    if (!created) {
        return serverProfile;
    }

    const legacyProfile = getLegacyProfile(username);
    if (!legacyProfile || !legacyProfileHasData(legacyProfile)) {
        return serverProfile;
    }

    try {
        const payload = await requestJson('/api/players/' + encodeURIComponent(username), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(legacyProfile),
        });
        removeLegacyProfile(username);
        return payload.profile;
    } catch (error) {
        console.error('Failed to migrate local profile to server', error);
        return serverProfile;
    }
}

export async function getPlayerData(username) {
    if (!username) {
        return { id: null };
    }

    const { profile, created } = await fetchPlayerResponse(username);
    const migratedProfile = await migrateLocalProfileIfNeeded(username, profile, created);
    return migratedProfile;
}

export async function updateLikedTracks(username, likedTracks) {
    if (!username) {
        return;
    }

    await requestJson('/api/players/' + encodeURIComponent(username) + '/likes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ likedTracks }),
    });
}

export async function getScores(username) {
    const profile = await getPlayerData(username);
    if (profile.id == null) {
        return [];
    }
    return [{ scores: profile.scores || [] }];
}

export async function getAllScores() {
    const payload = await requestJson('/api/leaderboard');
    return payload.scores || [];
}

export async function getAllProfiles() {
    const payload = await requestJson('/api/leaderboard');
    return payload.profiles || [];
}

export async function savePlayerProfile(username, profile) {
    if (!username) {
        return;
    }

    await requestJson('/api/players/' + encodeURIComponent(username), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
    });
}

export async function updateScores(username, scores) {
    if (!username) {
        return;
    }

    const profile = await getPlayerData(username);
    profile.scores = scores;
    await savePlayerProfile(username, profile);
}

export async function updateGamesPlayed(username, gamesPlayed) {
    if (!username) {
        return;
    }

    const profile = await getPlayerData(username);
    profile.games_played = gamesPlayed;
    await savePlayerProfile(username, profile);
}

export async function updateAnswers(username, good, wrong) {
    if (!username) {
        return;
    }

    const profile = await getPlayerData(username);
    profile.good_answers = good;
    profile.wrong_answers = wrong;
    await savePlayerProfile(username, profile);
}
