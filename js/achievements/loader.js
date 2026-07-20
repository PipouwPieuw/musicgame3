const ACHIEVEMENTS_URL = 'data/achievements.json';
const GLOBAL_TROPHIES_URL = 'data/global-trophies.json';

let cachedAchievements = null;
let cachedGlobalTrophies = null;

async function fetchDefinitions(url, label) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Impossible de charger ' + label + ' (' + response.status + ')');
    }
    return response.json();
}

export async function loadAchievementDefinitions() {
    if (cachedAchievements) {
        return cachedAchievements;
    }

    const payload = await fetchDefinitions(ACHIEVEMENTS_URL, 'les succès');
    cachedAchievements = Array.isArray(payload.achievements) ? payload.achievements : [];
    return cachedAchievements;
}

export async function loadGlobalTrophyDefinitions() {
    if (cachedGlobalTrophies) {
        return cachedGlobalTrophies;
    }

    const payload = await fetchDefinitions(GLOBAL_TROPHIES_URL, 'les trophées globaux');
    cachedGlobalTrophies = Array.isArray(payload.trophies) ? payload.trophies : [];
    return cachedGlobalTrophies;
}

export async function loadAllAchievementDefinitions() {
    const [achievements, globalTrophies] = await Promise.all([
        loadAchievementDefinitions(),
        loadGlobalTrophyDefinitions(),
    ]);
    return { achievements, globalTrophies };
}

export function getAchievementDefinitions() {
    return cachedAchievements || [];
}

export function getGlobalTrophyDefinitions() {
    return cachedGlobalTrophies || [];
}
