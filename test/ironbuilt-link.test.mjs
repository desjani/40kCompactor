import { test } from 'node:test';
import assert from 'node:assert';
import { getIronbuiltShareCode, fetchIronbuiltList, IronbuiltFetchError } from '../modules/ironbuilt_link.js';
import { readSample } from './helpers.mjs';

const fakeResponse = (status, body, headers = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name] ?? null },
    json: async () => body
});

test('IRONBUILT link: share code is read from a link pasted on its own', () => {
    assert.strictEqual(getIronbuiltShareCode('https://ironbuilt.app/?s=aP4LzTp6'), 'aP4LzTp6');
    assert.strictEqual(getIronbuiltShareCode('  https://ironbuilt.app/?s=aP4LzTp6\n'), 'aP4LzTp6');
    assert.strictEqual(getIronbuiltShareCode('ironbuilt.app/?s=aP4LzTp6'), 'aP4LzTp6');
    assert.strictEqual(getIronbuiltShareCode('https://www.ironbuilt.app/?s=aP4LzTp6'), 'aP4LzTp6');
    assert.strictEqual(getIronbuiltShareCode('https://ironbuilt.app/api/roster-json?code=fYaYnVRQ'), 'fYaYnVRQ');
});

test('IRONBUILT link: anything other than a lone IRONBUILT share link is left to the parsers', () => {
    assert.strictEqual(getIronbuiltShareCode(readSample('Ironbuilt-Sample-WE.txt').join('\n')), null);
    assert.strictEqual(getIronbuiltShareCode('https://ironbuilt.app/'), null);
    assert.strictEqual(getIronbuiltShareCode('https://example.com/?s=aP4LzTp6'), null);
    assert.strictEqual(getIronbuiltShareCode('https://notironbuilt.app/?s=aP4LzTp6'), null);
    assert.strictEqual(getIronbuiltShareCode(''), null);
});

test('IRONBUILT link: fetch returns the roster text field', async () => {
    let requested = '';
    const text = await fetchIronbuiltList('aP4LzTp6', async (url) => {
        requested = url;
        return fakeResponse(200, { schemaVersion: 1, text: 'list text' });
    });
    assert.strictEqual(requested, 'https://ironbuilt.app/api/roster-json?code=aP4LzTp6');
    assert.strictEqual(text, 'list text');
});

test('IRONBUILT link: rate limiting, missing shares and network failures raise readable errors', async () => {
    await assert.rejects(
        fetchIronbuiltList('x', async () => fakeResponse(429, { error: 'rate_limited' }, { 'Retry-After': '30' })),
        (e) => e instanceof IronbuiltFetchError && e.status === 429 && /in 30 seconds/.test(e.message)
    );
    await assert.rejects(
        fetchIronbuiltList('x', async () => fakeResponse(429, {})),
        (e) => e.status === 429 && /in a moment/.test(e.message)
    );
    await assert.rejects(
        fetchIronbuiltList('x', async () => fakeResponse(404, { error: 'share_not_found' })),
        (e) => e.status === 404 && /could not find/.test(e.message)
    );
    await assert.rejects(
        fetchIronbuiltList('x', async () => fakeResponse(200, { roster: {} })),
        (e) => /no list/.test(e.message)
    );
    await assert.rejects(
        fetchIronbuiltList('x', async () => { throw new TypeError('Failed to fetch'); }),
        (e) => e.status === 0 && /Could not reach/.test(e.message)
    );
});
