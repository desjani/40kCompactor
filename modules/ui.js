// --- UI Elements ---
const _hasDocument = (typeof document !== 'undefined' && document && typeof document.getElementById === 'function');
const inputText = _hasDocument ? document.getElementById('inputText') : null;
const unabbreviatedOutput = _hasDocument ? document.getElementById('unabbreviatedOutput') : null;
const compactedOutput = _hasDocument ? document.getElementById('compactedOutput') : null;
const markdownPreviewOutput = _hasDocument ? document.getElementById('markdownPreviewOutput') : null; // New element
const debugOutput = _hasDocument ? document.getElementById('debugOutput') : null;
const parseButton = _hasDocument ? document.getElementById('parseButton') : null;
const resetButton = _hasDocument ? document.getElementById('resetButton') : null;
const toggleDebugButton = _hasDocument ? document.getElementById('toggleDebugButton') : null;
const copyExtendedButton = _hasDocument ? document.getElementById('copyExtendedButton') : null;
const outputFormatSelect = _hasDocument ? document.getElementById('outputFormatSelect') : null;
const copyPreviewButton = _hasDocument ? document.getElementById('copyPreviewButton') : null;
const customColorPickers = _hasDocument ? document.getElementById('customColorPickers') : null;
const inputCharCount = _hasDocument ? document.getElementById('inputCharCount') : null;
const extendedCharCount = _hasDocument ? document.getElementById('extendedCharCount') : null; // Corrected ID
const compactCharCount = _hasDocument ? document.getElementById('compactCharCount') : null;
const markdownPreviewCharCount = _hasDocument ? document.getElementById('markdownPreviewCharCount') : null; // New element
const copyPopup = _hasDocument ? document.getElementById('copyPopup') : null;

// Initialize ansi_up if available (guard for CLI tests)
let ansi_up = null;
try {
    if (typeof AnsiUp !== 'undefined') ansi_up = new AnsiUp();
} catch (e) {
    ansi_up = null;
}

export function getHideSubunitsState() {
    const hideSubunitsCheckbox = document.getElementById('hideSubunitsCheckbox');
    return hideSubunitsCheckbox ? hideSubunitsCheckbox.checked : false;
}

export function getMultilineHeaderState() { // New function
    const multilineHeaderCheckbox = document.getElementById('multilineHeaderCheckbox');
    return multilineHeaderCheckbox ? multilineHeaderCheckbox.checked : false;
}

// --- UI Initialization ---
export function initializeUI(callbacks) {
    if (parseButton) {
        parseButton.disabled = true;
        parseButton.textContent = 'Loading DB...';
    }

    document.querySelectorAll('input[name="colorMode"]').forEach(el => { // Modified to only target colorMode
        el.addEventListener('change', (e) => {
            if (e.target.name === 'colorMode') {
                if (customColorPickers) {
                    customColorPickers.style.display = e.target.value === 'custom' ? 'block' : 'none';
                }
            }
            if (callbacks.onColorChange) {
                callbacks.onColorChange();
            }
        });
    });

    // New event listeners for color pickers
    document.querySelectorAll('#unitColor, #subunitColor, #pointsColor, #headerColor, #wargearColor').forEach(el => {
        el.addEventListener('change', () => {
            if (callbacks.onColorChange) {
                callbacks.onColorChange();
            }
        });
    });

    if (parseButton) parseButton.addEventListener('click', callbacks.onParse);
    if (resetButton) resetButton.addEventListener('click', callbacks.onReset);
    if (toggleDebugButton) toggleDebugButton.addEventListener('click', toggleDebug);
    if (copyExtendedButton) copyExtendedButton.addEventListener('click', callbacks.onCopyExtended);
    if (outputFormatSelect) outputFormatSelect.addEventListener('change', callbacks.onOutputFormatChange);
    if (copyPreviewButton) copyPreviewButton.addEventListener('click', callbacks.onCopyPreview);
    
    const hideSubunitsCheckbox = document.getElementById('hideSubunitsCheckbox');
    if (hideSubunitsCheckbox) {
        hideSubunitsCheckbox.addEventListener('change', callbacks.onHideSubunitsChange);
    }

    const multilineHeaderCheckbox = document.getElementById('multilineHeaderCheckbox'); // New checkbox event listener
    if (multilineHeaderCheckbox) {
        multilineHeaderCheckbox.addEventListener('change', callbacks.onMultilineHeaderChange);
    }
}

export function enableParseButton() {
    if (parseButton) {
        parseButton.disabled = false;
        parseButton.textContent = 'Compact this list';
    }
}

export function setParseButtonError() {
    if (parseButton) {
        parseButton.textContent = 'Error: DB Load Failed';
    }
}

export function getInputText() {
    return inputText ? inputText.value : '';
}

export function setUnabbreviatedOutput(html) {
    if (unabbreviatedOutput) {
        unabbreviatedOutput.innerHTML = html;
    }
}

export function setCompactedOutput(html) {
    if (compactedOutput) {
        compactedOutput.innerHTML = html;
    }
}

export function setMarkdownPreviewOutput(markdownText) {
    if (markdownPreviewOutput) {
        // Convert ANSI to HTML directly
        markdownPreviewOutput.innerHTML = ansi_up.ansi_to_html(markdownText);
    }
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
    if (inputText) inputText.value = '';
    if (unabbreviatedOutput) unabbreviatedOutput.innerHTML = '';
    if (compactedOutput) compactedOutput.innerHTML = '';
    if (markdownPreviewOutput) markdownPreviewOutput.innerHTML = ''; // Clear new output box
    if (debugOutput) {
        debugOutput.innerHTML = '';
    }
    updateCharCounts('', '', '', ''); // Pass empty string for new output box
    if (inputText) inputText.focus();
}

function toggleDebug() {
    const debugContainer = document.getElementById('debugContainer');
    if (debugContainer) {
        if (debugContainer.style.display === 'none') {
            debugContainer.style.display = 'flex';
            if (toggleDebugButton) toggleDebugButton.textContent = 'Hide Debug Log';
        } else {
            debugContainer.style.display = 'none';
            if (toggleDebugButton) toggleDebugButton.textContent = 'Show Debug Log';
        }
    }
}

export function updateCharCounts(original, extended, compact, markdownPreview) {
    const originalSize = original.length;
    const extendedSize = extended.trim().length;
    const compactSize = compact.trim().length;
    const markdownPreviewSize = markdownPreview.trim().length; // New line

    if (inputCharCount) inputCharCount.textContent = `Characters: ${originalSize}`;

    if (originalSize > 0) {
        const extendedRatioPercent = ((extendedSize / originalSize) * 100).toFixed(1);
        if (extendedCharCount) extendedCharCount.innerHTML = `Characters: ${extendedSize} | ${extendedRatioPercent}%`;

        const compactRatioPercent = ((compactSize / originalSize) * 100).toFixed(1);
        if (compactCharCount) compactCharCount.innerHTML = `Characters: ${compactSize} | ${compactRatioPercent}%`;

        const markdownPreviewRatioPercent = ((markdownPreviewSize / originalSize) * 100).toFixed(1); // New line
        if (markdownPreviewCharCount) markdownPreviewCharCount.innerHTML = `Characters: ${markdownPreviewSize} | ${markdownPreviewRatioPercent}%`; // New line
    } else {
        if (extendedCharCount) extendedCharCount.innerHTML = '';
        if (compactCharCount) compactCharCount.innerHTML = '';
        if (markdownPreviewCharCount) markdownPreviewCharCount.innerHTML = ''; // New line
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
        if (copyPopup) {
            copyPopup.classList.add('show');
            setTimeout(() => { copyPopup.classList.remove('show'); }, 2000);
        }
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
}