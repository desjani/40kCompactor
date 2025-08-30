
// --- UI Elements ---
const inputText = document.getElementById('inputText');
const unabbreviatedOutput = document.getElementById('unabbreviatedOutput');
const compactedOutput = document.getElementById('compactedOutput');
const debugOutput = document.getElementById('debugOutput');
const parseButton = document.getElementById('parseButton');
const resetButton = document.getElementById('resetButton');
const toggleDebugButton = document.getElementById('toggleDebugButton');
const copyExtendedButton = document.getElementById('copyExtendedButton');
const copyCompactButton = document.getElementById('copyCompactButton');
const copyExtendedDiscordButton = document.getElementById('copyExtendedDiscordButton');
const copyPlainDiscordButton = document.getElementById('copyPlainDiscordButton');
const customColorPickers = document.getElementById('customColorPickers');
const inputCharCount = document.getElementById('inputCharCount');
const extendedCharCount = document.getElementById('extendedCharCount');
const compactCharCount = document.getElementById('compactCharCount');
const copyPopup = document.getElementById('copyPopup');

// --- UI Initialization ---
export function initializeUI(callbacks) {
    parseButton.disabled = true;
    parseButton.textContent = 'Loading DB...';

    document.querySelectorAll('input[name="colorMode"], #unitColor, #subunitColor, #pointsColor').forEach(el => {
        el.addEventListener('change', (e) => {
            if (e.target.name === 'colorMode') {
                customColorPickers.style.display = e.target.value === 'custom' ? 'block' : 'none';
            }
            if (callbacks.onColorChange) {
                callbacks.onColorChange();
            }
        });
    });

    parseButton.addEventListener('click', callbacks.onParse);
    resetButton.addEventListener('click', callbacks.onReset);
    toggleDebugButton.addEventListener('click', toggleDebug);
    copyExtendedButton.addEventListener('click', callbacks.onCopyExtended);
    copyCompactButton.addEventListener('click', callbacks.onCopyCompact);
    copyExtendedDiscordButton.addEventListener('click', callbacks.onCopyExtendedDiscord);
    copyPlainDiscordButton.addEventListener('click', callbacks.onCopyPlainDiscord);
}

export function enableParseButton() {
    parseButton.disabled = false;
    parseButton.textContent = 'Compact this list';
}

export function setParseButtonError() {
    parseButton.textContent = 'Error: DB Load Failed';
}

export function getInputText() {
    return inputText.value;
}

export function setUnabbreviatedOutput(html) {
    unabbreviatedOutput.innerHTML = html;
}

export function setCompactedOutput(html) {
    compactedOutput.innerHTML = html;
}

export function setDebugOutput(text) {
    if (debugOutput) {
        const resultEntry = document.createElement('pre');
        resultEntry.style.whiteSpace = 'pre-wrap';
        resultEntry.style.wordBreak = 'break-all';
        resultEntry.textContent = text;
        debugOutput.innerHTML = ''; // Clear previous content
        debugOutput.appendChild(resultEntry);
    }
}

export function resetUI() {
    inputText.value = '';
    unabbreviatedOutput.innerHTML = '';
    compactedOutput.innerHTML = '';
    if (debugOutput) {
        debugOutput.innerHTML = '';
    }
    updateCharCounts('', '', '');
    inputText.focus();
}

function toggleDebug() {
    const debugContainer = document.getElementById('debugContainer');
    if (debugContainer.style.display === 'none') {
        debugContainer.style.display = 'flex';
        toggleDebugButton.textContent = 'Hide Debug Log';
    } else {
        debugContainer.style.display = 'none';
        toggleDebugButton.textContent = 'Show Debug Log';
    }
}

export function updateCharCounts(original, extended, compact) {
    const originalSize = original.length;
    const extendedSize = extended.trim().length;
    const compactSize = compact.trim().length;

    inputCharCount.textContent = `Characters: ${originalSize}`;

    if (originalSize > 0) {
        const extendedRatioPercent = ((extendedSize / originalSize) * 100).toFixed(1);
        extendedCharCount.innerHTML = `Characters: ${extendedSize} | ${extendedRatioPercent}%`;

        const compactRatioPercent = ((compactSize / originalSize) * 100).toFixed(1);
        compactCharCount.innerHTML = `Characters: ${compactSize} | ${compactRatioPercent}%`;
    } else {
        extendedCharCount.innerHTML = '';
        compactCharCount.innerHTML = '';
    }
}

export async function copyTextToClipboard(text) {
    if (!text) return;
    if (!navigator.clipboard) {
        console.error('Clipboard API not available');
        return;
    }
    try {
        await navigator.clipboard.writeText(text);
        copyPopup.classList.add('show');
        setTimeout(() => { copyPopup.classList.remove('show'); }, 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
}
