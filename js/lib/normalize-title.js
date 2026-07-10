const TITLE_SUFFIX_PATTERNS = [
    /\s*-\s*remaster(ed)?(\s+\d{4})?$/i,
    /\s*-\s*radio\s+edit$/i,
    /\s*-\s*album\s+version$/i,
    /\s*-\s*single\s+version$/i,
    /\s*-\s*extended(\s+version)?$/i,
    /\s*-\s*live(\s+version)?$/i,
    /\s*-\s*acoustic(\s+version)?$/i,
];

const MODIFIED_LETTER_MAP = {
    æ: 'ae',
    œ: 'oe',
    ø: 'o',
    ł: 'l',
    đ: 'd',
    þ: 'th',
    ð: 'd',
};

export function sanitizeAnswer(str) {
    if (!str || typeof str !== 'string') {
        return '';
    }

    let sanitized = str
        .toLowerCase()
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .replace(/ß/g, 'ss');

    for (const [letter, replacement] of Object.entries(MODIFIED_LETTER_MAP)) {
        sanitized = sanitized.replaceAll(letter, replacement);
    }

    return sanitized.replace(/[^a-z0-9]/g, '');
}

export function normalizeTitle(str) {
    if (!str || typeof str !== 'string') {
        return '';
    }

    const stripped = str
        .replace(/\(.*?\)|\[.*?\]/g, '')
        .replace(/\b(feat\.?|ft\.?|featuring)\b.*/gi, '');

    return sanitizeAnswer(stripped);
}

function buildTitleCandidates(trackTitle) {
    const candidates = new Set([trackTitle]);

    for (const pattern of TITLE_SUFFIX_PATTERNS) {
        const stripped = trackTitle.replace(pattern, '').trim();
        if (stripped) {
            candidates.add(stripped);
        }
    }

    return [...candidates];
}

export function isTitleCorrect(input, track) {
    const normalizedInput = normalizeTitle(input);
    if (!normalizedInput || !Array.isArray(track.acceptedAnswers)) {
        return false;
    }

    const candidates = new Set();

    track.acceptedAnswers.forEach(function (answer) {
        buildTitleCandidates(answer).forEach(function (candidate) {
            candidates.add(candidate);
        });
    });

    return [...candidates].some((answer) => normalizeTitle(answer) === normalizedInput);
}
