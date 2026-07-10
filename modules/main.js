import { detectFormat, parseV11List, parseGwAppV11, parseWarOrganV11, parseNRWTCCompact, parseNRWTC, parseNRGW } from './parsers.js';
import { generateOutput, generateDiscordText, resolveFactionColors } from './renderers.js';
import { buildAbbreviationIndex } from './abbreviations.js';
import { downloadCardPng, generateCardPngDataUrl, estimateCardWidth, copyCardImageToClipboard } from './cardRenderer.js';
import { initializeUI, enableParseButton, setParseButtonError, getInputText, setUnabbreviatedOutput, setCompactedOutput, setDebugOutput, resetUI, updateCharCounts, copyTextToClipboard, setMarkdownPreviewOutput, getHideSubunitsState, setFactionColorDiagnostic, clearFactionColorDiagnostic, getCombineUnitsState, getNoBulletsState, getHidePointsState, getHideBracketsState, getMultilineHeaderState, getAbbreviateHeaderState, getAbbreviateUnitNamesState, getWargearShowModeState, getCustomAbbrs, setCopyPreviewButtonText } from './ui.js';

let parsedData = null;
let extendedPlainText = '';
let compactPlainText = '';
let detectedFormat = null;
// let wargearAbbrMap = null; // DEPRECATED
let skippableWargearMap = null;
let wargearAbbrDB = null; // dynamic abbreviations built from parsed data
let currentPreviewText = ''; // New global variable

async function init() {
    // Load skippable_wargear.json
    try {
        const version = window.APP_VERSION || '';
        const resp = await fetch('skippable_wargear.json' + (version ? `?v=${version}` : ''));
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
            const hideBrackets = getHideBracketsState();
            const abbreviateUnitNames = getAbbreviateUnitNamesState();

            if (selectedFormat === 'imageCodex' || selectedFormat === 'imageCodexAbbr') {
                const colorMode = document.querySelector('input[name="colorMode"]:checked')?.value || 'none';
                const colors = {
                    unit: document.getElementById('unitColor')?.value,
                    subunit: document.getElementById('subunitColor')?.value,
                    wargear: document.getElementById('wargearColor')?.value,
                    points: document.getElementById('pointsColor')?.value,
                    header: document.getElementById('headerColor')?.value,
                    attached: document.getElementById('attachedColor')?.value,
                    icon: document.getElementById('iconColor')?.value
                };
                downloadCardPng(parsedData, {
                    hideSubunits: hideSubunits,
                    wargearShowMode: getWargearShowModeState(),
                    hidePoints: hidePoints,
                    hideBrackets: hideBrackets,
                    combineIdenticalUnits: combineUnits,
                    useAbbreviations: selectedFormat === 'imageCodexAbbr',
                    wargearAbbrMap: wargearAbbrDB,
                    noBullets: noBullets,
                    colorMode: colorMode,
                    colors: colors,
                    abbreviateHeader: getAbbreviateHeaderState(),
                    abbreviateUnitNames: abbreviateUnitNames
                });
                return;
            }

            const opts = { forcePalette: true, multilineHeader: getMultilineHeaderState(), abbreviateHeader: getAbbreviateHeaderState(), wargearShowMode: getWargearShowModeState(), abbreviateUnitNames: abbreviateUnitNames, hideBrackets: hideBrackets };
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
        onCopyPreviewImage: async () => {
            if (!parsedData) return;
            const outputFormatSelect = document.getElementById('outputFormatSelect');
            const selectedFormat = outputFormatSelect ? outputFormatSelect.value : 'discordCompact';
            if (selectedFormat === 'imageCodex' || selectedFormat === 'imageCodexAbbr') {
                const colorMode = document.querySelector('input[name="colorMode"]:checked')?.value || 'none';
                const colors = {
                    unit: document.getElementById('unitColor')?.value,
                    subunit: document.getElementById('subunitColor')?.value,
                    wargear: document.getElementById('wargearColor')?.value,
                    points: document.getElementById('pointsColor')?.value,
                    header: document.getElementById('headerColor')?.value,
                    attached: document.getElementById('attachedColor')?.value,
                    icon: document.getElementById('iconColor')?.value
                };
                const imageOpts = {
                    hideSubunits: getHideSubunitsState(),
                    wargearShowMode: getWargearShowModeState(),
                    hidePoints: getHidePointsState(),
                    hideBrackets: getHideBracketsState(),
                    combineIdenticalUnits: getCombineUnitsState(),
                    useAbbreviations: selectedFormat === 'imageCodexAbbr',
                    wargearAbbrMap: wargearAbbrDB,
                    noBullets: getNoBulletsState(),
                    colorMode: colorMode,
                    colors: colors,
                    abbreviateHeader: getAbbreviateHeaderState(),
                    abbreviateUnitNames: getAbbreviateUnitNamesState()
                };
                try {
                    const btn = document.getElementById('copyPreviewImageButton');
                    if (btn) btn.textContent = 'Copying...';
                    await copyCardImageToClipboard(parsedData, imageOpts);
                    if (btn) btn.textContent = 'Copy Image to Clipboard';
                    const popup = document.getElementById('copyPopup');
                    if (popup) {
                        popup.classList.add('show');
                        setTimeout(() => { popup.classList.remove('show'); }, 2000);
                    }
                } catch (err) {
                    console.error('Failed to copy image:', err);
                    alert('Failed to copy image to clipboard. Please try again.');
                    const btn = document.getElementById('copyPreviewImageButton');
                    if (btn) btn.textContent = 'Copy Image to Clipboard';
                }
            }
        },
        onColorChange: () => {
            // Color changes should re-render all outputs when we have parsed data
            if (parsedData) {
                renderAllOutputsWithCurrentOptions();
            }
        },
    onHideSubunitsChange: () => renderAllOutputsWithCurrentOptions(),
    onCombineUnitsChange: () => renderAllOutputsWithCurrentOptions(),
    onNoBulletsChange: () => renderAllOutputsWithCurrentOptions(),
    onHidePointsChange: () => renderAllOutputsWithCurrentOptions(),
    onHideBracketsChange: () => renderAllOutputsWithCurrentOptions(),
        onMultilineHeaderChange: () => updatePreview(),
        onAbbreviateHeaderChange: () => renderAllOutputsWithCurrentOptions(),
        onWargearShowModeChange: () => renderAllOutputsWithCurrentOptions(),
        onAbbreviateUnitNamesChange: () => renderAllOutputsWithCurrentOptions()
    });

    enableParseButton();
}

if (document.readyState !== 'loading') {
    init();
} else {
    document.addEventListener('DOMContentLoaded', init);
}


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
        const fm = resolveFactionColors(parsedData, skippableWargearMap || {});
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
        GW_APP_V11: parseGwAppV11,
        WAR_ORGAN_V11: parseWarOrganV11,
        NR_WTC_COMPACT: parseNRWTCCompact,
        NR_WTC: parseNRWTC,
        NR_GW: parseNRGW
    }[format];
    if (!parser) {
        console.error("Unsupported list format.");
        setUnabbreviatedOutput('<p style="color: var(--color-danger);">Unsupported list format. Please use the 11th Edition GW App or War Organ list format.</p>');
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

async function updatePreview() {
    if (!parsedData) return;

    const outputFormatSelect = document.getElementById('outputFormatSelect');
    const selectedFormat = outputFormatSelect ? outputFormatSelect.value : 'discordCompact'; // Default to discordCompact
    const hideSubunits = getHideSubunitsState();
    const combineUnits = getCombineUnitsState();
    const noBullets = getNoBulletsState();
    const hidePoints = getHidePointsState();
    const hideBrackets = getHideBracketsState();
    const abbreviateUnitNames = getAbbreviateUnitNamesState();
    console.log('UI: hideSubunits value in updatePreview', hideSubunits, 'selectedFormat', selectedFormat);

    const opts = { multilineHeader: getMultilineHeaderState(), abbreviateHeader: getAbbreviateHeaderState(), wargearShowMode: getWargearShowModeState(), abbreviateUnitNames: abbreviateUnitNames, hideBrackets: hideBrackets };

    if (selectedFormat === 'imageCodex' || selectedFormat === 'imageCodexAbbr') {
        setCopyPreviewButtonText('Download Image');
        const markdownPreviewOutput = document.getElementById('markdownPreviewOutput');
        if (markdownPreviewOutput) {
            markdownPreviewOutput.innerHTML = '<div style="color: var(--color-text-secondary); text-align: center; padding: 2rem;">Generating preview image...</div>';
        }
        try {
            const colorMode = document.querySelector('input[name="colorMode"]:checked')?.value || 'none';
            const colors = {
                unit: document.getElementById('unitColor')?.value,
                subunit: document.getElementById('subunitColor')?.value,
                wargear: document.getElementById('wargearColor')?.value,
                points: document.getElementById('pointsColor')?.value,
                header: document.getElementById('headerColor')?.value,
                attached: document.getElementById('attachedColor')?.value,
                icon: document.getElementById('iconColor')?.value
            };
            const imageOpts = {
                hideSubunits,
                wargearShowMode: getWargearShowModeState(),
                hidePoints,
                hideBrackets,
                combineIdenticalUnits: combineUnits,
                useAbbreviations: selectedFormat === 'imageCodexAbbr',
                wargearAbbrMap: wargearAbbrDB,
                noBullets,
                colorMode,
                colors,
                abbreviateHeader: getAbbreviateHeaderState(),
                abbreviateUnitNames: abbreviateUnitNames
            };
            const dataUrl = await generateCardPngDataUrl(parsedData, imageOpts);
            if (markdownPreviewOutput && (outputFormatSelect.value === 'imageCodex' || outputFormatSelect.value === 'imageCodexAbbr')) {
                const cardWidth = estimateCardWidth(parsedData, imageOpts);
                markdownPreviewOutput.innerHTML = `<img src="${dataUrl}" style="width: ${cardWidth}px; max-width: none; display: block; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" />`;
            }
        } catch (err) {
            console.error('Failed to generate preview image:', err);
            if (markdownPreviewOutput) {
                markdownPreviewOutput.innerHTML = '<div style="color: red; text-align: center; padding: 2rem;">Failed to render preview.</div>';
            }
        }
        currentPreviewText = '';
        updateCharCounts(getInputText(), extendedPlainText, compactPlainText, '', detectedFormat);
        return;
    }

    setCopyPreviewButtonText('Copy Preview to Clipboard');

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
    const hideBrackets = getHideBracketsState();

    // Full text (extended)
    // Important: Full Text must NOT be affected by toggles. Always show full structure.
    const extendedOutput = generateOutput(parsedData, false, wargearAbbrDB, /*hideSubunits*/ false, skippableWargearMap, /*applyHeaderColor*/ false, /*combine*/ false, false, false, getAbbreviateHeaderState(), true, undefined, getAbbreviateUnitNamesState(), hideBrackets);
    setUnabbreviatedOutput(extendedOutput.html);
    extendedPlainText = extendedOutput.plainText;

    // Compact HTML
    const compactOutput = generateOutput(parsedData, true, wargearAbbrDB, hideSubunits, skippableWargearMap, true, combineUnits, noBullets, hidePoints, getAbbreviateHeaderState(), false, getWargearShowModeState(), getAbbreviateUnitNamesState(), hideBrackets);
    setCompactedOutput(compactOutput.html);
    compactPlainText = compactOutput.plainText;

    // Preview text
    updatePreview();
    // Diagnostics dependent on color/faction modes
    updateFactionDiagnostic();
}
