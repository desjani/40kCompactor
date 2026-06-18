import { detectFormat, parseV11List, parseGwAppV11 } from './parsers.js';
import { generateOutput, generateDiscordText, resolveFactionColors, buildFactionColorMap } from './renderers.js';
import { buildAbbreviationIndex } from './abbreviations.js';
import { downloadCardPng } from './cardRenderer.js';
import { initializeUI, enableParseButton, setParseButtonError, getInputText, setUnabbreviatedOutput, setCompactedOutput, setDebugOutput, resetUI, updateCharCounts, copyTextToClipboard, setMarkdownPreviewOutput, getHideSubunitsState, setFactionColorDiagnostic, clearFactionColorDiagnostic, getCombineUnitsState, getNoBulletsState, getHidePointsState, getMultilineHeaderState, getAbbreviateHeaderState, getShowMandatoryWargearState, getCustomAbbrs } from './ui.js';

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
        onCopyPreview: () => {
            if (!parsedData) return;
            const outputFormatSelect = document.getElementById('outputFormatSelect');
            const selectedFormat = outputFormatSelect ? outputFormatSelect.value : 'discordCompact';
            const hideSubunits = getHideSubunitsState();
            const combineUnits = getCombineUnitsState();
            const noBullets = getNoBulletsState();
            const hidePoints = getHidePointsState();
            const opts = { forcePalette: true, multilineHeader: getMultilineHeaderState(), abbreviateHeader: getAbbreviateHeaderState(), showMandatoryWargear: getShowMandatoryWargearState() };
            let text = '';
            switch (selectedFormat) {
                case 'discordCompact':
                    text = generateDiscordText(parsedData, false, true, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints); break;
                case 'discordExtended':
                    text = generateDiscordText(parsedData, false, false, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints); break;
                case 'plainText':
                    text = generateDiscordText(parsedData, true, true, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints); break;
                case 'plainTextExtended':
                    text = generateDiscordText(parsedData, true, false, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints); break;
                default:
                    text = generateDiscordText(parsedData, false, true, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints);
            }
            copyTextToClipboard(text);
        },
        onColorChange: () => {
            // Color changes should re-render all outputs when we have parsed data
            if (parsedData) {
                renderAllOutputsWithCurrentOptions();
            }
        },
        onExportImage: () => {
            if (!parsedData) return;
            downloadCardPng(parsedData, {
                hideSubunits: getHideSubunitsState(),
                showMandatoryWargear: getShowMandatoryWargearState(),
                hidePoints: getHidePointsState()
            });
        },
        onExportImageAbbr: () => {
            if (!parsedData) return;
            downloadCardPng(parsedData, {
                hideSubunits: getHideSubunitsState(),
                showMandatoryWargear: getShowMandatoryWargearState(),
                hidePoints: getHidePointsState(),
                useAbbreviations: true,
                wargearAbbrMap: wargearAbbrDB
            });
        },
    onHideSubunitsChange: () => renderAllOutputsWithCurrentOptions(),
    onCombineUnitsChange: () => renderAllOutputsWithCurrentOptions(),
    onNoBulletsChange: () => renderAllOutputsWithCurrentOptions(),
    onHidePointsChange: () => renderAllOutputsWithCurrentOptions(),
        onMultilineHeaderChange: () => updatePreview(),
        onAbbreviateHeaderChange: () => renderAllOutputsWithCurrentOptions(),
        onShowMandatoryWargearChange: () => renderAllOutputsWithCurrentOptions()
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
        const factionMap = buildFactionColorMap(skippableWargearMap || {});
        const fk = (parsedData.metadata && parsedData.metadata.faction) || null;
        const normalizeKey = (s) => {
            if (!s) return null;
            try { return s.toString().normalize('NFD').replace(/\p{M}/gu, '').replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[^\w\s'\-]/g, '').toLowerCase().trim(); } catch (e) { return s.toString().toLowerCase(); }
        };
        const nfk = normalizeKey(fk);
        const fm = fk ? (factionMap[fk] || factionMap[fk.toString().toLowerCase()] || (nfk && factionMap[nfk])) : null;
        if (!fm) {
            setFactionColorDiagnostic('No faction mapping found for parsed faction');
            return;
        }
        setFactionColorDiagnostic('');
    } catch (e) {
        console.warn('Failed to update faction diagnostic', e);
    }
}

function handleParse() {
    setDebugOutput('');
    const text = getInputText();
    const lines = text.split('\n');
    const format = detectFormat(lines);
    const parser = {
        V11_GENERIC: parseV11List,
        GW_APP_V11: parseGwAppV11
    }[format];
    if (!parser) {
        console.error("Unsupported list format.");
        setUnabbreviatedOutput('<p style="color: var(--color-danger);">Unsupported list format. Please use the 11th Edition GW App or Generic list format.</p>');
        setCompactedOutput('');
        setMarkdownPreviewOutput('');
        return;
    }

    const result = parser(lines, skippableWargearMap);
    if (typeof window !== 'undefined') {
        window.LAST_RAW_PARSER_OUTPUT = result;
        try {
            console.log('[DEBUG] Raw parser output:', JSON.stringify(result));
        } catch (e) {
            console.log('[DEBUG] Raw parser output (object):', result, 'error:', e);
        }
    }

    let prettyDebug = '';
    try {
        prettyDebug = JSON.stringify(result, null, 2);
    } catch (e) {
        prettyDebug = String(result);
    }
    setDebugOutput(prettyDebug);

    parsedData = result;
    detectedFormat = format;
    try {
        wargearAbbrDB = buildAbbreviationIndex(result, getCustomAbbrs());
    } catch (e) {
        console.warn('Failed to build dynamic abbreviation index', e);
        wargearAbbrDB = { __flat_abbr: {} };
    }
    renderAllOutputsWithCurrentOptions();
    updatePreview();
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
    const combineUnits = getCombineUnitsState();
    const noBullets = getNoBulletsState();
    const hidePoints = getHidePointsState();
    console.log('UI: hideSubunits value in updatePreview', hideSubunits, 'selectedFormat', selectedFormat);

    const opts = { multilineHeader: getMultilineHeaderState(), abbreviateHeader: getAbbreviateHeaderState(), showMandatoryWargear: getShowMandatoryWargearState() };

    let previewText = '';
    switch (selectedFormat) {
        case 'discordCompact':
            previewText = generateDiscordText(parsedData, false, true, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints);
            break;
        case 'discordExtended':
            previewText = generateDiscordText(parsedData, false, false, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints);
            break;
        case 'plainText':
            previewText = generateDiscordText(parsedData, true, true, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints);
            break;
        case 'plainTextExtended':
            // plainTextExtended uses the same logic as Discord plain but with plain=true
            previewText = generateDiscordText(parsedData, true, false, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints);
            break;
        default:
            previewText = generateDiscordText(parsedData, false, true, wargearAbbrDB, hideSubunits, skippableWargearMap, combineUnits, opts, noBullets, hidePoints);
    }
    setMarkdownPreviewOutput(previewText);
    currentPreviewText = previewText; // Store for copying
    updateCharCounts(getInputText(), extendedPlainText, compactPlainText, currentPreviewText, detectedFormat);
}

// Re-render both HTML outputs and the preview using current toggle states.
function renderAllOutputsWithCurrentOptions() {
    if (!parsedData) return;
    const hideSubunits = getHideSubunitsState();
    const combineUnits = getCombineUnitsState();
    const noBullets = getNoBulletsState();
    const hidePoints = getHidePointsState();

    // Full text (extended)
    // Important: Full Text must NOT be affected by toggles. Always show full structure.
    const extendedOutput = generateOutput(parsedData, false, wargearAbbrDB, /*hideSubunits*/ false, skippableWargearMap, /*applyHeaderColor*/ false, /*combine*/ false, false, false, getAbbreviateHeaderState(), true);
    setUnabbreviatedOutput(extendedOutput.html);
    extendedPlainText = extendedOutput.plainText;

    // Compact HTML
    const compactOutput = generateOutput(parsedData, true, wargearAbbrDB, hideSubunits, skippableWargearMap, true, combineUnits, noBullets, hidePoints, getAbbreviateHeaderState(), getShowMandatoryWargearState());
    setCompactedOutput(compactOutput.html);
    compactPlainText = compactOutput.plainText;

    // Preview text
    updatePreview();
    // Diagnostics dependent on color/faction modes
    updateFactionDiagnostic();
}
