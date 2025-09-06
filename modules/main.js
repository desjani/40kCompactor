import { detectFormat, parseGwApp, parseWtcCompact } from './parsers.js';
import { generateOutput, generateDiscordText } from './renderers.js';
import { buildAbbreviationIndex } from './abbreviations.js';
import { initializeUI, enableParseButton, setParseButtonError, getInputText, setUnabbreviatedOutput, setCompactedOutput, setDebugOutput, resetUI, updateCharCounts, copyTextToClipboard, setMarkdownPreviewOutput, getHideSubunitsState } from './ui.js';

let parsedData = null;
let extendedPlainText = '';
let compactPlainText = '';
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
        onCopyExtended: () => copyTextToClipboard(extendedPlainText.trim()),
        onOutputFormatChange: () => updatePreview(),
        onCopyPreview: () => copyTextToClipboard(currentPreviewText),
        onColorChange: () => {
            if (parsedData) {
                const hideSubunits = getHideSubunitsState();
                const compactOutput = generateOutput(parsedData, true, wargearAbbrDB, hideSubunits, skippableWargearMap);
                setCompactedOutput(compactOutput.html);
                compactPlainText = compactOutput.plainText;
                // Also update the markdown preview on color change
                updatePreview();
            }
        },
        onHideSubunitsChange: () => updatePreview(),
        onMultilineHeaderChange: () => updatePreview()
    });

    enableParseButton();
});

function handleParse() {
    setDebugOutput(''); // Clear debug output
    const text = getInputText();
    const lines = text.split('\n');

    const format = detectFormat(lines);
    const parser = {
        GW_APP: parseGwApp,
        WTC_COMPACT: parseWtcCompact
    }[format];

    if (!parser) {
        console.error("Unsupported list format.");
        setUnabbreviatedOutput('<p style="color: var(--color-danger);">Unsupported list format. Please use GW App or WTC-Compact format.</p>');
        setCompactedOutput('');
        setMarkdownPreviewOutput(''); // Clear new output box
        return;
    }

    const result = parser(lines);

    // Debug: log raw parser output to console for inspection
    if (typeof window !== 'undefined') {
        window.LAST_RAW_PARSER_OUTPUT = result;
        console.log('[DEBUG] Raw parser output:', JSON.parse(JSON.stringify(result)));
    }

    setDebugOutput(JSON.stringify(result, null, 2));

    parsedData = result;
    // Build dynamic abbreviation index from parsed data
    try {
        wargearAbbrDB = buildAbbreviationIndex(result, skippableWargearMap);
    } catch (e) {
        console.warn('Failed to build dynamic abbreviation index', e);
        wargearAbbrDB = { __flat_abbr: {} };
    }
    const hideSubunits = getHideSubunitsState();
    const extendedOutput = generateOutput(result, false, wargearAbbrDB, hideSubunits, skippableWargearMap);
    setUnabbreviatedOutput(extendedOutput.html);
    extendedPlainText = extendedOutput.plainText;
    const compactOutput = generateOutput(result, true, wargearAbbrDB, hideSubunits, skippableWargearMap);
    setCompactedOutput(compactOutput.html);
    compactPlainText = compactOutput.plainText;

    // Generate and set Discord Compact Preview
    updatePreview();
}

function handleReset() {
    resetUI();
    parsedData = null;
    extendedPlainText = '';
    compactPlainText = '';
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
    updateCharCounts(getInputText(), extendedPlainText, compactPlainText, currentPreviewText);
}
