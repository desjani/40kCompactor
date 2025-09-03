import { loadAbbreviationRules, generateAbbreviations } from './abbreviations.js';
import { detectFormat, parseGwApp, parseWtcCompact } from './parsers.js';
import { generateOutput, generateDiscordText } from './renderers.js';
import { initializeUI, enableParseButton, setParseButtonError, getInputText, setUnabbreviatedOutput, setCompactedOutput, setDebugOutput, resetUI, updateCharCounts, copyTextToClipboard, setMarkdownPreviewOutput } from './ui.js';

let parsedData = null;
let extendedPlainText = '';
let compactPlainText = '';
let wargearAbbrMap = null;
let currentPreviewText = ''; // New global variable

document.addEventListener('DOMContentLoaded', async () => {
    initializeUI({
        onParse: handleParse,
        onReset: handleReset,
        onCopyExtended: () => copyTextToClipboard(extendedPlainText.trim()),
        onOutputFormatChange: () => updatePreview(),
        onCopyPreview: () => copyTextToClipboard(currentPreviewText),
        onColorChange: () => {
            if (parsedData) {
                const compactOutput = generateOutput(parsedData, true, wargearAbbrMap);
                setCompactedOutput(compactOutput.html);
                compactPlainText = compactOutput.plainText;
                // Also update the markdown preview on color change
                updatePreview();
                
                
            }
        }
    });

    const dbLoaded = await loadAbbreviationRules();
    if (dbLoaded) {
        enableParseButton();
    } else {
        setParseButtonError();
    }
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

    wargearAbbrMap = generateAbbreviations(result);
    setDebugOutput(JSON.stringify(result, null, 2) + '\n\n' + JSON.stringify(Array.from(wargearAbbrMap.entries()), null, 2));


    parsedData = result;
    const extendedOutput = generateOutput(result, false, wargearAbbrMap);
    setUnabbreviatedOutput(extendedOutput.html);
    extendedPlainText = extendedOutput.plainText;
    const compactOutput = generateOutput(result, true, wargearAbbrMap);
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
    wargearAbbrMap = null;
}

function updatePreview() {
    if (!parsedData) return;

    const outputFormatSelect = document.getElementById('outputFormatSelect');
    const selectedFormat = outputFormatSelect ? outputFormatSelect.value : 'discordCompact'; // Default to discordCompact

    let previewText = '';
    let useAbbreviations = true;
    let plain = false;

    switch (selectedFormat) {
        case 'discordCompact':
            useAbbreviations = true;
            plain = false;
            break;
        case 'discordExtended':
            useAbbreviations = false;
            plain = false;
            break;
        case 'plainText':
            useAbbreviations = true; // Abbreviations are used for plain text output
            plain = true;
            break;
    }

    previewText = generateDiscordText(parsedData, plain, useAbbreviations, wargearAbbrMap);
    setMarkdownPreviewOutput(previewText);
    currentPreviewText = previewText; // Store for copying
    updateCharCounts(getInputText(), extendedPlainText, compactPlainText, currentPreviewText);
}