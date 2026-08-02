import { ACHIEVEMENTS_ENABLED } from '../config.js';
import { savePlayerProfile } from '../services/player-api.js';
import { gameState } from '../game/state.js';
import { checkGlobalTrophyChanges } from './global.js';
import { checkPersonalAchievements } from './personal.js';
import { playRevealQueue } from './reveal.js';

export async function processPostGameAchievements($, sessionContext) {
    if (!ACHIEVEMENTS_ENABLED) {
        return;
    }
    if (!gameState.username || !gameState.playerData) {
        return;
    }

    const previousHeld = (gameState.playerData.lastHeldGlobalTrophies || []).slice();
    const personalUnlocks = checkPersonalAchievements(gameState.playerData, sessionContext);
    const globalNotifications = await checkGlobalTrophyChanges(gameState.playerData, gameState.username);
    const revealItems = personalUnlocks.concat(globalNotifications);
    const heldChanged =
        previousHeld.length !== (gameState.playerData.lastHeldGlobalTrophies || []).length ||
        previousHeld.some(function (id, index) {
            return id !== gameState.playerData.lastHeldGlobalTrophies[index];
        });

    if (personalUnlocks.length === 0 && globalNotifications.length === 0 && !heldChanged) {
        return;
    }

    try {
        await savePlayerProfile(gameState.username, gameState.playerData);
    } catch (error) {
        console.error('Failed to save achievement progress', error);
    }

    await playRevealQueue($, revealItems);
}
