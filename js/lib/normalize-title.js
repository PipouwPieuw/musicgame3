const TITLE_SUFFIX_PATTERNS = [
    /\s*-\s*remaster(ed)?(\s+\d{4})?$/i,
    /\s*-\s*radio\s+edit$/i,
    /\s*-\s*album\s+version$/i,
    /\s*-\s*single\s+version$/i,
    /\s*-\s*extended(\s+version)?$/i,
    /\s*-\s*live(\s+version)?$/i,
    /\s*-\s*acoustic(\s+version)?$/i,
];

export function normalizeTitle(str) {
    if (!str || typeof str !== 'string') {
        return '';
    }

    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\(.*?\)|\[.*?\]/g, '')
        .replace(/\b(feat\.?|ft\.?|featuring)\b.*/gi, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
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
    if (!normalizedInput) {
        return false;
    }

    const candidates = buildTitleCandidates(track.title);
    return candidates.some((title) => normalizeTitle(title) === normalizedInput);
}
