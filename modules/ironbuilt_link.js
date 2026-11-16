// IRONBUILT share links (https://ironbuilt.app/?s=CODE) resolve to the same
// text export a user would paste, via IRONBUILT's read-only roster API.
const ROSTER_JSON_URL = 'https://ironbuilt.app/api/roster-json';

export class IronbuiltFetchError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'IronbuiltFetchError';
        this.status = status;
    }
}

// Returns the share code when the whole input is a single IRONBUILT link, else null.
// A pasted list also ends with its share link, so anything more than the link is
// left to the parsers.
export function getIronbuiltShareCode(input) {
    const trimmed = String(input || '').trim();
    if (!trimmed || /\s/.test(trimmed)) return null;
    let url;
    try {
        url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    } catch {
        return null;
    }
    if (!/(^|\.)ironbuilt\.app$/i.test(url.hostname)) return null;
    const code = url.searchParams.get('s') || url.searchParams.get('code');
    return code && /^[A-Za-z0-9_-]+$/.test(code) ? code : null;
}

// Fetches the list text for a share code. Throws IronbuiltFetchError with a
// user-facing message on failure.
export async function fetchIronbuiltList(code, fetchImpl = fetch) {
    let res;
    try {
        res = await fetchImpl(`${ROSTER_JSON_URL}?code=${encodeURIComponent(code)}`, {
            headers: { Accept: 'application/json' }
        });
    } catch {
        throw new IronbuiltFetchError('Could not reach IRONBUILT. Check your connection and try again.', 0);
    }

    if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After'), 10);
        const when = retryAfter > 0 ? `in ${retryAfter} second${retryAfter === 1 ? '' : 's'}` : 'in a moment';
        throw new IronbuiltFetchError(`IRONBUILT is receiving too many requests. Try again ${when}.`, 429);
    }
    if (res.status === 404) {
        throw new IronbuiltFetchError('IRONBUILT could not find that share link. Check the link, or paste the list text instead.', 404);
    }
    if (!res.ok) {
        throw new IronbuiltFetchError(`IRONBUILT returned an error (${res.status}). Paste the list text instead.`, res.status);
    }

    let json;
    try {
        json = await res.json();
    } catch {
        json = null;
    }
    if (!json || typeof json.text !== 'string' || !json.text.trim()) {
        throw new IronbuiltFetchError('IRONBUILT returned no list for that link. Paste the list text instead.', res.status);
    }
    return json.text;
}
