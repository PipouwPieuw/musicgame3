import { LEADERBOARD_SCORE_KEYS, DEFAULTTRACKSBYGAME, migrateScoresList } from '../config.js';

export function returnBestScores(allScores, leaderboard, leaderboardCustom) {
    for (const element in allScores) {
        // Scores from /api/leaderboard are already normalized; migrateScoresList
        // still remaps any leftover legacy keys without touching new Difficile.
        const scores = migrateScoresList(allScores[element].scores);
        if (scores == null || !scores.length) {
            continue;
        }
        const name = allScores[element].name;
        const initials = allScores[element].initials;
        for (const currentScore in scores) {
            const [difficulty, tracks, points] = scores[currentScore];
            if (!(difficulty in leaderboard) || !(difficulty in leaderboardCustom)) {
                continue;
            }
            if (tracks != DEFAULTTRACKSBYGAME) {
                if (!(name in leaderboardCustom[difficulty])) {
                    leaderboardCustom[difficulty][name] = [name, tracks, points, initials];
                } else if (leaderboardCustom[difficulty][name][2] < points) {
                    leaderboardCustom[difficulty][name] = [name, tracks, points, initials];
                }
            } else {
                if (!(name in leaderboard[difficulty])) {
                    leaderboard[difficulty][name] = [name, tracks, points, initials];
                } else if (leaderboard[difficulty][name][2] < points) {
                    leaderboard[difficulty][name] = [name, tracks, points, initials];
                }
            }
        }
    }

    for (let i = 0; i < LEADERBOARD_SCORE_KEYS.length; i++) {
        const key = LEADERBOARD_SCORE_KEYS[i];
        const difficultyTableCustom = [];
        for (const playerName in leaderboardCustom[key]) {
            difficultyTableCustom.push(leaderboardCustom[key][playerName]);
        }
        difficultyTableCustom.sort((a, b) => (a[2] < b[2] ? 1 : b[2] < a[2] ? -1 : 0));
        leaderboardCustom[key] = difficultyTableCustom;

        const difficultyTable = [];
        for (const playerName in leaderboard[key]) {
            difficultyTable.push(leaderboard[key][playerName]);
        }
        difficultyTable.sort((a, b) => (a[2] < b[2] ? 1 : b[2] < a[2] ? -1 : 0));
        leaderboard[key] = difficultyTable;
    }

    return [leaderboard, leaderboardCustom];
}

export function getCumulativeBestScoresByInitials(allScores) {
    const leaderboard = {};
    const leaderboardCustom = {};
    for (let i = 0; i < LEADERBOARD_SCORE_KEYS.length; i++) {
        leaderboard[LEADERBOARD_SCORE_KEYS[i]] = {};
        leaderboardCustom[LEADERBOARD_SCORE_KEYS[i]] = {};
    }

    const [leaderboardResult] = returnBestScores(allScores, leaderboard, leaderboardCustom);
    const totalScores = {};

    for (const i in leaderboardResult) {
        for (const j in leaderboardResult[i]) {
            const initials = leaderboardResult[i][j][3];
            const points = leaderboardResult[i][j][2];
            if (!(initials in totalScores)) {
                totalScores[initials] = points;
            } else {
                totalScores[initials] += points;
            }
        }
    }

    return totalScores;
}
