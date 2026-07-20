import { getAchievementDefinitions } from './loader.js';
import { evaluateCondition } from './evaluator.js';

function getUnlockedIds(playerData) {
    return new Set((playerData.unlockedAchievements || []).map(function (entry) {
        return entry.id;
    }));
}

export function checkPersonalAchievements(playerData, sessionContext) {
    const definitions = getAchievementDefinitions();
    const unlockedIds = getUnlockedIds(playerData);
    const newlyUnlocked = [];

    for (const achievement of definitions) {
        if (unlockedIds.has(achievement.id)) {
            continue;
        }
        if (!evaluateCondition(achievement.condition, playerData, sessionContext)) {
            continue;
        }

        const unlockEntry = {
            id: achievement.id,
            unlockedAt: new Date().toISOString(),
        };
        playerData.unlockedAchievements = playerData.unlockedAchievements || [];
        playerData.unlockedAchievements.push(unlockEntry);
        unlockedIds.add(achievement.id);
        newlyUnlocked.push({
            type: 'achievement',
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            image: achievement.image,
        });
    }

    return newlyUnlocked;
}

export function isAchievementUnlocked(playerData, achievementId) {
    return getUnlockedIds(playerData).has(achievementId);
}

export function getAchievementUnlockDate(playerData, achievementId) {
    const entry = (playerData.unlockedAchievements || []).find(function (item) {
        return item.id === achievementId;
    });
    return entry ? entry.unlockedAt : null;
}
