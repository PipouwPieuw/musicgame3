import {
    playAnswerRevealAppear,
    playAnswerRevealDismiss,
    setAnswerRevealContent,
} from '../ui/answer-reveal.js';

const ACHIEVEMENT_REVEAL_TAG = 'Succès débloqué';
const GLOBAL_TROPHY_REVEAL_TAG = 'Trophée obtenu';
/** Delay before click-to-dismiss is armed (covers flip appear + flip duration). */
const REVEAL_CLICK_ARM_MS = 800;
const REVEAL_DISMISS_MS = 350;
const REVEAL_CLICK_NS = 'achievementReveal';

function buildRevealTitle(item) {
    if (item.description) {
        return item.name + ' — ' + item.description;
    }
    return item.name;
}

function waitForClickToDismiss($) {
    return new Promise(function (resolve) {
        setTimeout(function () {
            $(document).one('click.' + REVEAL_CLICK_NS, function () {
                playAnswerRevealDismiss($);
                setTimeout(resolve, REVEAL_DISMISS_MS);
            });
        }, REVEAL_CLICK_ARM_MS);
    });
}

function playSingleReveal($, item) {
    const tag = item.type === 'globalTrophy' ? GLOBAL_TROPHY_REVEAL_TAG : ACHIEVEMENT_REVEAL_TAG;

    return setAnswerRevealContent($, {
        title: buildRevealTitle(item),
        imagePath: item.image,
        discovery: true,
        tag: tag,
    }).then(function () {
        playAnswerRevealAppear($, { effect: 'flip' });
        return waitForClickToDismiss($);
    });
}

export async function playRevealQueue($, items) {
    if (!items || items.length === 0) {
        return;
    }

    for (const item of items) {
        await playSingleReveal($, item);
    }
}

