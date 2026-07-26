import { migrateScoreKey } from '../config.js';
import { getCumulativeBestScoresByInitials } from '../lib/leaderboard-scores.js';

const COMPARE_OPS = {
    '>=': function (left, right) {
        return left >= right;
    },
    '>': function (left, right) {
        return left > right;
    },
    '<=': function (left, right) {
        return left <= right;
    },
    '<': function (left, right) {
        return left < right;
    },
    '==': function (left, right) {
        return left === right;
    },
};

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

function getStatValue(stat, playerData, sessionContext) {
    const scoreKey = sessionContext?.scoreKey;

    switch (stat) {
        case 'foundTracksCount':
            return (playerData.foundTracksIds || []).length;
        case 'totalGamesPlayed':
            return sumStatMap(playerData.games_played);
        case 'vignettesGamesPlayed': {
            let total = 0;
            for (const key in playerData.games_played || {}) {
                if (key.indexOf('Vignettes_') === 0) {
                    total += playerData.games_played[key] || 0;
                }
            }
            return total;
        }
        case 'gamesPlayed':
            if (sessionContext?.condition?.scoreKey) {
                return (playerData.games_played && playerData.games_played[sessionContext.condition.scoreKey]) || 0;
            }
            return sumStatMap(playerData.games_played);
        case 'goodAnswers':
            if (sessionContext?.condition?.scoreKey) {
                return (playerData.good_answers && playerData.good_answers[sessionContext.condition.scoreKey]) || 0;
            }
            return sumStatMap(playerData.good_answers);
        case 'wrongAnswers':
            if (sessionContext?.condition?.scoreKey) {
                return (playerData.wrong_answers && playerData.wrong_answers[sessionContext.condition.scoreKey]) || 0;
            }
            return sumStatMap(playerData.wrong_answers);
        case 'answerRatio': {
            const minGames = sessionContext?.condition?.minGames || 1;
            const scopedScoreKey = sessionContext?.condition?.scoreKey;
            let good = 0;
            let wrong = 0;
            let games = 0;

            if (scopedScoreKey) {
                good = (playerData.good_answers && playerData.good_answers[scopedScoreKey]) || 0;
                wrong = (playerData.wrong_answers && playerData.wrong_answers[scopedScoreKey]) || 0;
                games = (playerData.games_played && playerData.games_played[scopedScoreKey]) || 0;
            } else {
                good = sumStatMap(playerData.good_answers);
                wrong = sumStatMap(playerData.wrong_answers);
                games = sumStatMap(playerData.games_played);
            }

            if (games < minGames || good + wrong === 0) {
                return 0;
            }
            return Math.ceil((good / (good + wrong)) * 100) || 0;
        }
        case 'likedTracksCount':
            return (playerData.likedTracks || []).length;
        case 'bestScore': {
            const targetKey = sessionContext?.condition?.scoreKey || scoreKey || 'Codex';
            let best = 0;
            for (const entry of playerData.scores || []) {
                const entryKey = migrateScoreKey(entry[0]);
                if (entryKey !== targetKey) {
                    continue;
                }
                best = Math.max(best, entry[2] || 0);
            }
            return best;
        }
        case 'sessionScore':
            return sessionContext?.sessionScore || 0;
        default:
            return 0;
    }
}

export function evaluateCondition(condition, playerData, sessionContext) {
    if (!condition || !condition.stat) {
        return false;
    }

    const compare = COMPARE_OPS[condition.op];
    if (!compare) {
        return false;
    }

    const context = {
        ...sessionContext,
        condition: condition,
    };
    const currentValue = getStatValue(condition.stat, playerData, context);
    return compare(currentValue, condition.value);
}

export function getConditionProgress(condition, playerData, sessionContext) {
    if (!condition || condition.value == null) {
        return null;
    }

    const context = {
        ...sessionContext,
        condition: condition,
    };
    const currentValue = getStatValue(condition.stat, playerData, context);
    return {
        current: currentValue,
        target: condition.value,
    };
}

export function getPlayerMetricValue(metric, player, options) {
    const allScores = options?.allScores;

    switch (metric.stat) {
        case 'games_played':
            return sumStatMap(player.games_played);
        case 'answerRatio': {
            const minGames = metric.minGames || 1;
            const totalGames = sumStatMap(player.games_played);
            if (totalGames < minGames) {
                return null;
            }
            const good = sumStatMap(player.good_answers);
            const wrong = sumStatMap(player.wrong_answers);
            if (good + wrong === 0) {
                return null;
            }
            return Math.ceil((good / (good + wrong)) * 100) || 0;
        }
        case 'likedTracks':
            return (player.likedTracks || []).length;
        case 'cumulativeBestScores': {
            if (!allScores) {
                return null;
            }
            const cumulative = getCumulativeBestScoresByInitials(allScores);
            return cumulative[player.initials] ?? null;
        }
        default:
            return null;
    }
}

export function compareMetricValues(left, right, order) {
    if (left == null && right == null) {
        return 0;
    }
    if (left == null) {
        return order === 'asc' ? -1 : 1;
    }
    if (right == null) {
        return order === 'asc' ? 1 : -1;
    }
    if (left < right) {
        return order === 'asc' ? -1 : 1;
    }
    if (left > right) {
        return order === 'asc' ? 1 : -1;
    }
    return 0;
}
