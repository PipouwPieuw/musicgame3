import { getAllProfiles, getAllScores } from '../services/player-api.js';
import { getGlobalTrophyDefinitions } from './loader.js';
import { compareMetricValues, getPlayerMetricValue } from './evaluator.js';

function sumStatMap(map) {
    let total = 0;
    if (!map) {
        return total;
    }
    for (const key in map) {
        total += map[key] || 0;
    }
    return total;
}

function resolveHolder(players, metric, allScores) {
    const ranked = [];

    for (const player of players) {
        const value = getPlayerMetricValue(metric, player, { allScores });
        if (value == null) {
            continue;
        }
        ranked.push({
            initials: player.initials,
            username: player.username,
            value: value,
        });
    }

    if (ranked.length === 0) {
        return null;
    }

    ranked.sort(function (a, b) {
        return compareMetricValues(a.value, b.value, metric.order || 'desc');
    });

    return ranked[0];
}

export async function computeGlobalTrophyHolders() {
    const definitions = getGlobalTrophyDefinitions();
    const [players, allScores] = await Promise.all([getAllProfiles(), getAllScores()]);
    const holders = {};

    for (const trophy of definitions) {
        const holder = resolveHolder(players, trophy.metric, allScores);
        holders[trophy.id] = holder
            ? {
                  trophyId: trophy.id,
                  initials: holder.initials,
                  username: holder.username,
                  value: holder.value,
              }
            : null;
    }

    return holders;
}

export function getHeldGlobalTrophyIdsForPlayer(holders, username) {
    const held = [];
    for (const trophyId in holders) {
        const holder = holders[trophyId];
        if (holder && holder.username === username) {
            held.push(trophyId);
        }
    }
    return held;
}

export async function checkGlobalTrophyChanges(playerData, username) {
    const definitions = getGlobalTrophyDefinitions();
    const holders = await computeGlobalTrophyHolders();
    const currentlyHeld = getHeldGlobalTrophyIdsForPlayer(holders, username);
    const previouslyHeld = playerData.lastHeldGlobalTrophies || [];
    const totalGames = sumStatMap(playerData.games_played);

    // Existing players: baseline on first check after deploy (no notification spam).
    if (previouslyHeld.length === 0 && totalGames > 1) {
        playerData.lastHeldGlobalTrophies = currentlyHeld;
        return [];
    }

    const previousSet = new Set(previouslyHeld);
    const notifications = [];

    for (const trophyId of currentlyHeld) {
        if (previousSet.has(trophyId)) {
            continue;
        }

        const definition = definitions.find(function (entry) {
            return entry.id === trophyId;
        });
        if (!definition) {
            continue;
        }

        notifications.push({
            type: 'globalTrophy',
            id: trophyId,
            name: definition.name,
            description: definition.description,
            image: definition.image,
        });
    }

    playerData.lastHeldGlobalTrophies = currentlyHeld;
    return notifications;
}

export async function getGlobalTrophiesForDisplay() {
    const definitions = getGlobalTrophyDefinitions();
    const holders = await computeGlobalTrophyHolders();

    return definitions.map(function (definition) {
        const holder = holders[definition.id];
        return {
            definition: definition,
            holder: holder,
        };
    });
}
