import { detectFormat, parseGwApp, parseWtcCompact, parseWtc, parseNrGw, parseNrNr, parseLf } from './parsers.js';
import { generateOutput, generateDiscordText, resolveFactionColors, buildFactionColorMap } from './renderers.js';
import { buildAbbreviationIndex } from './abbreviations.js';
import { initializeUI, enableParseButton, setParseButtonError, getInputText, setUnabbreviatedOutput, setCompactedOutput, setDebugOutput, resetUI, updateCharCounts, copyTextToClipboard, setMarkdownPreviewOutput, getHideSubunitsState, setFactionColorDiagnostic, clearFactionColorDiagnostic } from './ui.js';

let parsedData = null;
let extendedPlainText = '';
let compactPlainText = '';
let detectedFormat = null;
// let wargearAbbrMap = null; // DEPRECATED
let skippableWargearMap = null;
let wargearAbbrDB = null; // dynamic abbreviations built from parsed data
let currentPreviewText = ''; // New global variable

document.addEventListener('DOMContentLoaded', async () => {
    // Load skippable_wargear.json
    try {
        const resp = await fetch('skippable_wargear.json');
        skippableWargearMap = await resp.json();
        console.log('Loaded skippableWargearMap:', skippableWargearMap);
    } catch (e) {
        console.error('Failed to load skippable_wargear.json', e);
        skippableWargearMap = {};
    }
    // No external abbreviation DB - will build indexes dynamically after parsing
    wargearAbbrDB = { __flat_abbr: {} };

    initializeUI({
        onParse: handleParse,
        onReset: handleReset,
        onDebugError: (msg) => {
            try { setDebugOutput(`Autoparse error: ${msg}`); } catch (e) { console.error('Failed to set debug error', e); }
        },
    onCopyExtended: () => copyTextToClipboard(extendedPlainText.trim()),
        onOutputFormatChange: () => updatePreview(),
        onCopyPreview: () => copyTextToClipboard(currentPreviewText),
        onColorChange: () => {
            if (parsedData) {
                const hideSubunits = getHideSubunitsState();
                const compactOutput = generateOutput(parsedData, true, wargearAbbrDB, hideSubunits, skippableWargearMap, true);
                setCompactedOutput(compactOutput.html);
                compactPlainText = compactOutput.plainText;
                // Also update the markdown preview on color change
                updatePreview();
                updateFactionDiagnostic();
            }
        },
        onHideSubunitsChange: () => updatePreview(),
        onMultilineHeaderChange: () => updatePreview()
    });

    enableParseButton();
});

function updateFactionDiagnostic() {
    try {
        if (typeof document === 'undefined') return;
        const modeEl = document.querySelector('input[name="colorMode"]:checked');
        const mode = modeEl ? modeEl.value : 'none';
        if (mode !== 'faction') {
            clearFactionColorDiagnostic();
            return;
        }
        if (!parsedData) {
            clearFactionColorDiagnostic();
            return;
        }
        // Long-term: call the exported buildFactionColorMap directly so bundlers
        // include the symbol and we don't rely on fragile global fallbacks.
        const factionMap = buildFactionColorMap(skippableWargearMap || {});
        const fk = (parsedData.SUMMARY && (parsedData.SUMMARY.FACTION_KEY || parsedData.SUMMARY.FACTION_KEYWORD || parsedData.SUMMARY.DISPLAY_FACTION)) || null;
        const normalizeKey = (s) => {
            if (!s) return null;
            try { return s.toString().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[^\w\s'\-]/g, '').toLowerCase().trim(); } catch (e) { return s.toString().toLowerCase(); }
        };
        const nfk = normalizeKey(fk);
        const fm = fk ? (factionMap[fk] || factionMap[fk.toString().toLowerCase()] || (nfk && factionMap[nfk])) : null;
        if (!fm) {
            setFactionColorDiagnostic('No faction mapping found for parsed FACTION_KEYWORD/DISPLAY_FACTION');
            return;
        }
    // Diagnostic legend intentionally suppressed to avoid cluttering the UI.
    // Keep the diagnostic element present but leave it empty.
    setFactionColorDiagnostic('');
    } catch (e) {
        // swallow errors in diagnostic to avoid breaking UI
        console.warn('Failed to update faction diagnostic', e);
    }
}

function handleParse() {
    setDebugOutput(''); // Clear debug output
    const text = getInputText();
    const lines = text.split('\n');

    const format = detectFormat(lines);
    const parser = {
        GW_APP: parseGwApp,
        WTC: parseWtc,
        WTC_COMPACT: parseWtcCompact,
        NR_GW: parseNrGw,
    NRNR: parseNrNr,
    LF: parseLf
    }[format];

    if (!parser) {
        console.error("Unsupported list format.");
        setUnabbreviatedOutput('<p style="color: var(--color-danger);">Unsupported list format. Please use GW App, New Recruit (WTC-Compact, GW, or NR formats), or ListForge (Detailed).</p>');
        setCompactedOutput('');
        setMarkdownPreviewOutput(''); // Clear new output box
        return;
    }

    const result = parser(lines);

    // Debug: log raw parser output to console for inspection
    if (typeof window !== 'undefined') {
        window.LAST_RAW_PARSER_OUTPUT = result;
        // Safely stringify parser output for logging by removing circular _parent refs
        const safeStringify = (obj) => JSON.stringify(obj, (k, v) => (k === '_parent' ? undefined : v));
        try {
            console.log('[DEBUG] Raw parser output:', safeStringify(result));
        } catch (e) {
            // Fallback to logging the object directly if stringify still fails
            console.log('[DEBUG] Raw parser output (object):', result, 'stringifyError:', e);
        }
    }

    // Use the same safe serializer for UI debug output to avoid circular reference errors
    let prettyDebug = '';
    try {
        prettyDebug = JSON.stringify(result, (k, v) => (k === '_parent' ? undefined : v), 2);
    } catch (e) {
        prettyDebug = String(result);
    }
    setDebugOutput(prettyDebug);

    parsedData = result;
    // remember the detected format for the UI so we can show an indicator next to counts
    detectedFormat = format;
    // Build dynamic abbreviation index from parsed data
    try {
        wargearAbbrDB = buildAbbreviationIndex(result);
    } catch (e) {
        console.warn('Failed to build dynamic abbreviation index', e);
        wargearAbbrDB = { __flat_abbr: {} };
    }
    const hideSubunits = getHideSubunitsState();
    const extendedOutput = generateOutput(result, false, wargearAbbrDB, hideSubunits, skippableWargearMap, false);
    setUnabbreviatedOutput(extendedOutput.html);
    extendedPlainText = extendedOutput.plainText;
    const compactOutput = generateOutput(result, true, wargearAbbrDB, hideSubunits, skippableWargearMap, true);
    setCompactedOutput(compactOutput.html);
    compactPlainText = compactOutput.plainText;

    // Generate and set Discord Compact Preview
    updatePreview();
    // update character counts with format label
    updateCharCounts(getInputText(), extendedPlainText, compactPlainText, currentPreviewText, detectedFormat);
}

function handleReset() {
    resetUI();
    parsedData = null;
    extendedPlainText = '';
    compactPlainText = '';
    detectedFormat = null;
    // wargearAbbrMap = null;
}

function updatePreview() {
    if (!parsedData) return;

    const outputFormatSelect = document.getElementById('outputFormatSelect');
    const selectedFormat = outputFormatSelect ? outputFormatSelect.value : 'discordCompact'; // Default to discordCompact
    const hideSubunits = getHideSubunitsState();
    console.log('UI: hideSubunits value in updatePreview', hideSubunits, 'selectedFormat', selectedFormat);

    let previewText = '';
    switch (selectedFormat) {
        case 'discordCompact':
            previewText = generateDiscordText(parsedData, false, true, wargearAbbrDB, hideSubunits, skippableWargearMap);
            break;
        case 'discordExtended':
            previewText = generateDiscordText(parsedData, false, false, wargearAbbrDB, hideSubunits, skippableWargearMap);
            break;
        case 'plainText':
            previewText = generateDiscordText(parsedData, true, true, wargearAbbrDB, hideSubunits, skippableWargearMap);
            break;
        case 'plainTextExtended':
            // plainTextExtended uses the same logic as Discord plain but with plain=true
            previewText = generateDiscordText(parsedData, true, false, wargearAbbrDB, hideSubunits, skippableWargearMap);
            break;
        default:
            previewText = generateDiscordText(parsedData, false, true, wargearAbbrDB, hideSubunits, skippableWargearMap);
    }
    setMarkdownPreviewOutput(previewText);
    currentPreviewText = previewText; // Store for copying
    updateCharCounts(getInputText(), extendedPlainText, compactPlainText, currentPreviewText, detectedFormat);
}
