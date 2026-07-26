import {
    MAX_STREAK_BONUS,
    MINSTREAK,
    POINTS_BASE_BY_DIFFICULTY,
    SPEED_BONUS_THRESHOLDS,
} from '../config.js';
import { shuffleArray } from '../lib/shuffle.js';
import { animateCorrectAnswer } from '../ui/answer-reveal.js';
import { getRoundDuration, getRoundRemainingRatio } from './audio-player.js';
import { gameState, getScoreKey, isCodexMode } from './state.js';

const soundRight = new Audio('assets/sounds/right.m4a');
soundRight.volume = 0.5;
const soundWrong = new Audio('assets/sounds/wrong.m4a');

export function getStreakBonus(streak) {
    if (streak < MINSTREAK) {
        return 0;
    }

    return Math.min(streak - MINSTREAK + 1, MAX_STREAK_BONUS);
}

export function getSpeedBonus(remainingRatio) {
    for (let i = 0; i < SPEED_BONUS_THRESHOLDS.length; i++) {
        const tier = SPEED_BONUS_THRESHOLDS[i];
        if (remainingRatio > tier.minRemainingRatio) {
            return tier.bonus;
        }
    }

    return 0;
}

/**
 * Integer points for one correct answer.
 * @param {{ difficultyLevel: number, streak: number, remainingRatio: number }} params
 */
export function computeAnswerPoints({ difficultyLevel, streak, remainingRatio }) {
    const base = POINTS_BASE_BY_DIFFICULTY[difficultyLevel] || POINTS_BASE_BY_DIFFICULTY[1];
    const streakBonus = getStreakBonus(streak);
    const isHotStreak = streakBonus >= MAX_STREAK_BONUS;
    const effectiveBase = isHotStreak ? base * 2 : base;
    const speedBonus = getSpeedBonus(remainingRatio);

    return {
        points: effectiveBase + streakBonus + speedBonus,
        base: base,
        effectiveBase: effectiveBase,
        streakBonus: streakBonus,
        speedBonus: speedBonus,
        isHotStreak: isHotStreak,
        remainingRatio: remainingRatio,
    };
}

/** DOM host for the speed bonus tooltip, aligned with the matching countdown marker. */
function getSpeedIncrementHost(remainingRatio) {
    const hostsByTier = [
        '.js-countdown-three-quarters',
        '.js-countdown-half',
        '.js-countdown-quarter',
    ];

    for (let i = 0; i < SPEED_BONUS_THRESHOLDS.length; i++) {
        if (remainingRatio > SPEED_BONUS_THRESHOLDS[i].minRemainingRatio) {
            return $(hostsByTier[i]);
        }
    }

    return $();
}

export function playSound(soundElem) {
    soundElem.currentTime = 0;
    soundElem.play();
}

export function playCorrectSound() {
    playSound(soundRight);
}

export function playWrongSound() {
    playSound(soundWrong);
}

export function resetStreak($) {
    gameState.streak = 0;
    gameState.streakBonus = 0;
    $('.js-streak-wrapper').removeClass('active');
    $('.js-streak').text('');
    syncBaseAndStreakCapUI($);
}

export function incrementStreak() {
    gameState.streak += 1;
    gameState.streakBonus = getStreakBonus(gameState.streak);
}

/** Current difficulty base (not doubled). */
export function getDifficultyBase() {
    return POINTS_BASE_BY_DIFFICULTY[gameState.difficultyLevel] || POINTS_BASE_BY_DIFFICULTY[1];
}

/**
 * Sync .js-base value and streak-cap classes on .js-base / .js-streak-wrapper.
 * Call on game start, when streak hits the cap, and when streak resets.
 */
export function syncBaseAndStreakCapUI($) {
    const base = getDifficultyBase();
    const isHotStreak = gameState.streakBonus >= MAX_STREAK_BONUS;
    const displayBase = isHotStreak ? base * 2 : base;

    $('.js-base').text(displayBase);
    $('.js-base-wrapper').attr('data-value', displayBase);
    $('.js-base-wrapper').toggleClass('is-capped', isHotStreak);
    $('.js-streak-wrapper').toggleClass('is-capped', isHotStreak);
}

export function recordGoodAnswer() {
    const scoreKey = getScoreKey();
    if (!(scoreKey in gameState.playerData.good_answers) || gameState.playerData.good_answers[scoreKey] == null) {
        gameState.playerData.good_answers[scoreKey] = 0;
    }
    gameState.playerData.good_answers[scoreKey] += 1;
}

export function recordWrongAnswer() {
    const scoreKey = getScoreKey();
    if (!(scoreKey in gameState.playerData.wrong_answers) || gameState.playerData.wrong_answers[scoreKey] == null) {
        gameState.playerData.wrong_answers[scoreKey] = 0;
    }
    gameState.playerData.wrong_answers[scoreKey] += 1;
}

export function applyCorrectAnswer($, remainingRatio) {
    animateCorrectAnswer($);

    // Codex is discovery-only: no answer stats, points, streak, or score HUD.
    if (isCodexMode()) {
        return;
    }

    const ratio = typeof remainingRatio === 'number' ? remainingRatio : getRoundRemainingRatio();

    recordGoodAnswer();
    incrementStreak();

    const breakdown = computeAnswerPoints({
        difficultyLevel: gameState.difficultyLevel,
        streak: gameState.streak,
        remainingRatio: ratio,
    });

    gameState.score += breakdown.points;

    if (breakdown.streakBonus > 0) {
        $('.js-streak-wrapper').addClass('active');
    }
    $('.js-streak').text(breakdown.streakBonus > 0 ? breakdown.streakBonus : '');
    syncBaseAndStreakCapUI($);
    updateScoreUI($, breakdown);
}

export function applyWrongAnswer($) {
    playWrongSound();

    if (isCodexMode()) {
        return;
    }

    gameState.sessionWrongCount += 1;
    recordWrongAnswer();
    resetStreak($);
}

export function updateScoreUI($, breakdown = null) {
    $('.js-score').text(gameState.score);

    if (!breakdown || !(breakdown.points > 0)) {
        return;
    }

    const $scoreMain = $('.js-base-wrapper');
    if ($scoreMain.length) {
        $scoreMain.append($('<span class="score_increment score_increment--base">+' + breakdown.effectiveBase + '</span>'));
    }

    if (breakdown.streakBonus > 0) {
        $('.js-streak-wrapper').append(
            $('<span class="score_increment score_increment--streak">+' + breakdown.streakBonus + '</span>')
        );
    }

    if (breakdown.speedBonus > 0) {
        const $speedHost = getSpeedIncrementHost(breakdown.remainingRatio);
        if ($speedHost.length) {
            $speedHost.append($('<span class="score_increment score_increment--speed">+' + breakdown.speedBonus + '</span>'));
        }
    }

    setTimeout(function () {
        $('.score_increment').addClass('animate');
    }, 10);
    setTimeout(function () {
        $('.score_increment').addClass('fade');
    }, 910);
    setTimeout(function () {
        $('.score_increment').remove();
    }, 1010);
}

export function updateTrackNumberUI($) {
    $('.js-track-number').text(gameState.playedTracks);
}

export function resetCountdownBar($, value = '100%') {
    $('.js-countdown-bar').css('width', value);
    $('.js-countdown-bar').attr('data-timer', getRoundDuration());
    $('.js-countdown').text(0);
}

export function setPlaybackRate() {
    let rate = 1;
    const percent = gameState.playedTracks <= 1 ? 0 : Math.floor(((gameState.playedTracks - 1) / gameState.tracksByGame) * 100);
    const rand = Math.floor(Math.random() * 100 + 1);

    if (rand <= percent) {
        gameState.modifierRates = shuffleArray(gameState.modifierRates);
        rate = gameState.modifierRates[0];
    }

    return rate;
}

export function getAudioElements($) {
    return {
        audioPlayer: document.getElementById('audio_player'),
        audioPlayerHardcore: document.getElementById('audio_player_hardcore'),
        jsAudioPlayer: $('.js-audio-player'),
        jsAudioPlayerHardcore: $('.js-audio-player-hardcore'),
    };
}
