// --- UI Elements ---
const isBrowser = (typeof document !== 'undefined' && document);
const inputText = isBrowser ? document.getElementById('inputText') : null;
const unabbreviatedOutput = isBrowser ? document.getElementById('unabbreviatedOutput') : null;
const compactedOutput = isBrowser ? document.getElementById('compactedOutput') : null;
const markdownPreviewOutput = isBrowser ? document.getElementById('markdownPreviewOutput') : null; // New element
const debugOutput = isBrowser ? document.getElementById('debugOutput') : null;
const parseButton = isBrowser ? document.getElementById('parseButton') : null;
const resetButton = isBrowser ? document.getElementById('resetButton') : null;
const toggleDebugButton = isBrowser ? document.getElementById('toggleDebugButton') : null;
const copyExtendedButton = isBrowser ? document.getElementById('copyExtendedButton') : null;
const outputFormatSelect = isBrowser ? document.getElementById('outputFormatSelect') : null;
const copyPreviewButton = isBrowser ? document.getElementById('copyPreviewButton') : null;
const customColorPickers = isBrowser ? document.getElementById('customColorPickers') : null;
const inputCharCount = isBrowser ? document.getElementById('inputCharCount') : null;
const extendedCharCount = isBrowser ? document.getElementById('extendedCharCount') : null; // Corrected ID
const compactCharCount = isBrowser ? document.getElementById('compactCharCount') : null;
const markdownPreviewCharCount = isBrowser ? document.getElementById('markdownPreviewCharCount') : null; // New element
const copyPopup = isBrowser ? document.getElementById('copyPopup') : null;

// Initialize ansi_up (use a no-op shim in non-browser environments)
const ansi_up = (typeof AnsiUp !== 'undefined') ? new AnsiUp() : { ansi_to_html: (s) => s };

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

    if (isBrowser) {
        // Set initial visibility of custom color pickers based on checked radio
        const checked = document.querySelector('input[name="colorMode"]:checked');
        if (customColorPickers) customColorPickers.style.display = (checked && checked.value === 'custom') ? 'block' : 'none';
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
    }

    if (parseButton) parseButton.addEventListener('click', callbacks.onParse);
    if (resetButton) resetButton.addEventListener('click', callbacks.onReset);
    if (isBrowser && toggleDebugButton) toggleDebugButton.addEventListener('click', toggleDebug);
    if (copyExtendedButton) copyExtendedButton.addEventListener('click', callbacks.onCopyExtended);
    if (outputFormatSelect) outputFormatSelect.addEventListener('change', callbacks.onOutputFormatChange);
    if (copyPreviewButton) copyPreviewButton.addEventListener('click', callbacks.onCopyPreview);
    
    if (isBrowser) {
        const hideSubunitsCheckbox = document.getElementById('hideSubunitsCheckbox');
        if (hideSubunitsCheckbox) {
            hideSubunitsCheckbox.addEventListener('change', callbacks.onHideSubunitsChange);
        }

        const multilineHeaderCheckbox = document.getElementById('multilineHeaderCheckbox'); // New checkbox event listener
        if (multilineHeaderCheckbox) {
            multilineHeaderCheckbox.addEventListener('change', callbacks.onMultilineHeaderChange);
        }
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
    if (!isBrowser) return;
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

// Add an optional detectedFormat parameter (string) so callers can show a small
// "format detected" indicator beside the input character count.
export function updateCharCounts(original, extended, compact, markdownPreview, detectedFormat) {
    const originalSize = original.length;
    const extendedSize = extended.trim().length;
    const compactSize = compact.trim().length;
    const markdownPreviewSize = markdownPreview.trim().length; // New line

    // Map internal format codes to user-friendly labels
    const formatLabelMap = {
        'GW_APP': 'GW Official App',
        'WTC_COMPACT': "New Recruit - WTC-Compact",
        'NR_GW': 'New Recruit - GW'
    };

    let inputTextContent = `Characters: ${originalSize}`;
    if (detectedFormat) {
        const friendly = formatLabelMap[detectedFormat] || detectedFormat;
        inputTextContent += ` | ${friendly} format Detected!`;
    }

    if (inputCharCount) inputCharCount.textContent = inputTextContent;

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

export function setFactionColorDiagnostic(text) {
    const el = isBrowser ? document.getElementById('factionColorDiagnostic') : null;
    if (el) el.textContent = text || '';
}

export function clearFactionColorDiagnostic() {
    setFactionColorDiagnostic('');
}