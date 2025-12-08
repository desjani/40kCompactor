import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';
import { detectFormat, parseGwApp, parseWtcCompact, parseWtc, parseNrGw, parseNrNr, parseLf } from '../../modules/parsers.js';
import { buildAbbreviationIndex } from '../../modules/abbreviations.js';
import { generateDiscordText } from '../../modules/renderers.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load skippable wargear
// Note: In Vercel, we might need to adjust path or bundle it. 
// For now, assuming standard node file access works if files are included.
const skippablePath = path.join(__dirname, '../../skippable_wargear.json');
let skippableWargear = {};
try {
    if (fs.existsSync(skippablePath)) {
        skippableWargear = JSON.parse(fs.readFileSync(skippablePath, 'utf8'));
    }
} catch (e) {
    console.error('Failed to load skippable_wargear.json', e);
}

export default async function handler(req, res) {
    // Verify signature
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const rawBody = JSON.stringify(req.body);

    const isValidRequest = verifyKey(
        rawBody,
        signature,
        timestamp,
        process.env.DISCORD_PUBLIC_KEY
    );

    if (!isValidRequest) {
        return res.status(401).send('Bad request signature');
    }

    const interaction = req.body;

    // Handle PING
    if (interaction.type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG });
    }

    // Handle Slash Command
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        if (interaction.data.name === 'compact') {
            // Return Modal
            return res.send({
                type: InteractionResponseType.MODAL,
                data: {
                    custom_id: 'compactModal',
                    title: 'Compact Army List',
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 4,
                                    custom_id: 'listInput',
                                    label: 'Paste your army list here',
                                    style: 2,
                                    min_length: 1,
                                    max_length: 4000,
                                    placeholder: 'Paste list text...',
                                    required: true
                                }
                            ]
                        }
                    ]
                }
            });
        }
    }

    // Handle Modal Submit
    if (interaction.type === InteractionType.MODAL_SUBMIT) {
        if (interaction.data.custom_id === 'compactModal') {
            const listText = interaction.data.components[0].components[0].value;
            
            // Default options
            const options = {
                hideSubunits: false,
                combineUnits: false,
                multilineHeader: false,
                noBullets: false,
                hidePoints: false,
                colorMode: 'faction',
                format: 'discordCompact'
            };

            const { content } = generateResponse(listText, options);

            // We cannot easily support interactive buttons on Vercel without a DB to store the listText.
            // So we will just return the content.
            return res.send({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: content,
                    flags: 64 // Ephemeral
                }
            });
        }
    }

    return res.status(404).send('Not found');
}

function generateResponse(text, options) {
    let outputText = '';
    try {
        const lines = text.split(/\r?\n/);
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
            return { content: 'Could not detect list format. Please check your input.' };
        }

        const parsedData = parser(lines);
        const abbrIndex = buildAbbreviationIndex(parsedData);

        const renderOptions = {
            multilineHeader: options.multilineHeader,
            colorMode: options.colorMode,
            forcePalette: true
        };

        outputText = generateDiscordText(
            parsedData,
            false, // plain?
            true,  // useAbbreviations
            abbrIndex,
            options.hideSubunits,
            skippableWargear,
            options.combineUnits,
            renderOptions,
            options.noBullets,
            options.hidePoints
        );

    } catch (err) {
        console.error(err);
        return { content: `Error processing list: ${err.message}` };
    }

    if (outputText.length > 2000) {
        outputText = outputText.substring(0, 1900) + '\n... (truncated)';
    }

    return { content: outputText };
}
