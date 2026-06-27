import { Client, GatewayIntentBits, Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, AttachmentBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { html } from 'satori-html';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

// Import core modules from parent directory
import { detectFormat, parseV11List, parseGwAppV11, parseWarOrganV11 } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';
import { generateDiscordText, ansiPalette, colorNameToHex } from '../modules/renderers.js';
import { generateCardHtml, estimateCardWidth } from '../modules/cardRenderer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load skippable wargear
const skippablePath = path.join(__dirname, '../skippable_wargear.json');
let skippableWargear = {};
try {
    skippableWargear = JSON.parse(fs.readFileSync(skippablePath, 'utf8'));
} catch (e) {
    console.error('Failed to load skippable_wargear.json', e);
}

// Load fonts for Satori rendering
let interRegular = null;
let interBold = null;
try {
    interRegular = fs.readFileSync(path.join(__dirname, 'fonts/Inter-Regular.ttf'));
    interBold = fs.readFileSync(path.join(__dirname, 'fonts/Inter-Bold.ttf'));
} catch (e) {
    console.error('Failed to load Inter fonts for Satori bot rendering', e);
}

// Map Discord bot ANSI color codes back to HEX for the card renderer
function mapAnsiToHex(ansiColors) {
    if (!ansiColors) return undefined;
    const codeToHex = (code) => {
        const entry = ansiPalette.find(p => p.code === parseInt(code, 10));
        return entry ? entry.hex : '#FFFFFF';
    };
    return {
        unit: codeToHex(ansiColors.unit || '37'),
        subunit: codeToHex(ansiColors.subunit || '90'),
        wargear: codeToHex(ansiColors.wargear || '37'),
        points: codeToHex(ansiColors.points || '33'),
        header: codeToHex(ansiColors.header || '33'),
        icon: codeToHex(ansiColors.icon || ansiColors.header || '33')
    };
}

async function generateImageBuffer(parsedData, options) {
    if (!interRegular || !interBold) {
        throw new Error('Required fonts for image rendering are not loaded');
    }

    const useAbbreviations = options.format === 'discordCompact' || options.format === 'plainText' || options.format === 'imageCodexAbbr' || !!options.useAbbreviations;
    const hexColors = (options.colorMode === 'custom') ? mapAnsiToHex(options.customColors) : undefined;

    const widthOpts = {
        hideSubunits: options.hideSubunits,
        wargearShowMode: options.wargearShowMode,
        hidePoints: options.hidePoints,
        combineIdenticalUnits: options.combineUnits,
        useAbbreviations: useAbbreviations,
        noBullets: options.noBullets,
        abbreviateHeader: options.abbreviateHeader,
        colorMode: options.colorMode || 'faction',
        colors: hexColors
    };

    const cardWidth = estimateCardWidth(parsedData, widthOpts);

    const cardHtml = generateCardHtml(parsedData, {
        ...widthOpts,
        wargearAbbrMap: buildAbbreviationIndex(parsedData),
        cardWidth: cardWidth
    });

    const template = html(cardHtml);

    const svg = await satori(template, {
        width: cardWidth,
        fonts: [
            {
                name: 'Inter',
                data: interRegular,
                weight: 400,
                style: 'normal',
            },
            {
                name: 'Inter',
                data: interBold,
                weight: 700,
                style: 'normal',
            },
        ],
    });

    const resvg = new Resvg(svg, {
        background: '#18181b',
        fitTo: {
            mode: 'width',
            value: cardWidth,
        },
    });

    const pngData = resvg.render();
    return pngData.asPng();
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// In-memory session store: Map<messageId, { text: string, options: object }>
const sessions = new Map();

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    const guilds = c.guilds.cache.map(g => `${g.name} (${g.id})`).join(', ');
    console.log(`Bot is currently in guilds: ${guilds || 'None'}`);
});

client.on(Events.InteractionCreate, async interaction => {
    console.log(`Received interaction: ${interaction.type} from ${interaction.user.tag}`);
    try {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'compact') {
                console.log('Handling /compact command');
                const modal = new ModalBuilder()
                    .setCustomId('compactModal')
                    .setTitle('Compact Army List');

                const listInput = new TextInputBuilder()
                    .setCustomId('listInput')
                    .setLabel("Paste list (4k limit - check fit)")
                    .setPlaceholder("If over the 4k limit, please use https://www.40kcompactor.com/ (which has no character limits)")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(listInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
                console.log('Modal shown');
            }
        } else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'compactModal') {
            const listText = interaction.fields.getTextInputValue('listInput');

            if (listText.length >= 4000) {
                await interaction.reply({
                    content: '⚠️ **Input Limit Reached**\nDiscord has a text input limit of 4000 characters. Your list is likely truncated.\n\nPlease use the website instead: https://www.40kcompactor.com/ (No character limits!)',
                    ephemeral: true
                });
                return;
            }
            
            // Default options
            const options = {
                hideSubunits: true,
                combineUnits: false,
                multilineHeader: false,
                noBullets: false,
                hidePoints: false,
                abbreviateHeader: false,
                wargearShowMode: 'hide-mandatory',
                username: interaction.user.username,
                userId: interaction.user.id,
                colorMode: 'faction',
                format: 'discordCompact'
            };

            const { content, components, files } = await generateResponse(listText, options);

            // Send ephemeral preview
            const response = await interaction.reply({
                content: content,
                components: components,
                files: files || [],
                ephemeral: true,
                fetchReply: true
            });

            // Store session
            sessions.set(response.id, { text: listText, options });
        }
    } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
        try {
            // Handle stateless buttons (Edit/Delete on published messages)
            if (interaction.customId.startsWith('delete_published_')) {
                const ownerId = interaction.customId.replace('delete_published_', '');
                console.log(`[Delete] Clicked by ${interaction.user.id} (${interaction.user.tag}), Owner: ${ownerId}`);
                
                if (interaction.user.id !== ownerId) {
                    await interaction.reply({ content: "⛔ **Access Denied**\nOnly the user who published this list can delete it.", ephemeral: true });
                    return;
                }
                await interaction.message.delete();
                return;
            }

            if (interaction.customId.startsWith('edit_published_')) {
                const ownerId = interaction.customId.replace('edit_published_', '');
                console.log(`[Edit] Clicked by ${interaction.user.id} (${interaction.user.tag}), Owner: ${ownerId}`);

                if (interaction.user.id !== ownerId) {
                    await interaction.reply({ content: "⛔ **Access Denied**\nOnly the user who published this list can edit it.", ephemeral: true });
                    return;
                }
                
                const modal = new ModalBuilder()
                    .setCustomId('edit_published_modal')
                    .setTitle('Edit List');

                const textInput = new TextInputBuilder()
                    .setCustomId('edited_text')
                    .setLabel('Content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(interaction.message.content);

                modal.addComponents(new ActionRowBuilder().addComponents(textInput));
                await interaction.showModal(modal);
                return;
            }

            const session = sessions.get(interaction.message.id);
            if (!session) {
                await interaction.reply({ content: 'Session expired or not found.', ephemeral: true });
                return;
            }

            if (interaction.customId === 'publish') {
                await interaction.deferUpdate();
                
                // Add username to options for the final render
                session.options.username = interaction.user.username;
                session.options.userId = interaction.user.id;
                
                try {
                    const lines = session.text.split(/\r?\n/);
                    const format = detectFormat(lines);
                    
                    const parser = {
                        V11_GENERIC: parseV11List,
                        GW_APP_V11: parseGwAppV11,
                        WAR_ORGAN_V11: parseWarOrganV11
                    }[format];

                    if (!parser) {
                        throw new Error('Unsupported or unknown list format.');
                    }

                    const parsedData = parser(lines, skippableWargear);
                    const isImage = session.options.format === 'imageCodex' || session.options.format === 'imageCodexAbbr';
                    
                    let channel = interaction.channel;
                    if (!channel && interaction.channelId) {
                        channel = await interaction.client.channels.fetch(interaction.channelId);
                    }

                    if (channel) {
                        if (channel.guild) {
                            const permissions = channel.permissionsFor(interaction.client.user);
                            if (permissions) {
                                if (!permissions.has('SendMessages')) {
                                    throw new Error(`Missing 'Send Messages' permission in #${channel.name}`);
                                }
                                if (isImage && !permissions.has('AttachFiles')) {
                                    throw new Error(`Missing 'Attach Files' permission in #${channel.name}`);
                                }
                            }
                        }

                        const row = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`delete_published_${interaction.user.id}`)
                                    .setLabel('Delete')
                                    .setStyle(ButtonStyle.Danger)
                            );

                        if (isImage) {
                            const pngBuffer = await generateImageBuffer(parsedData, session.options);
                            const armyName = (parsedData.metadata?.title || parsedData.metadata?.armyName || 'army-list').toLowerCase().replace(/[^a-z0-9]/g, '-');
                            const attachment = new AttachmentBuilder(pngBuffer, { name: `${armyName}-card.png` });
                            
                            await channel.send({
                                content: `📊 **Image Version** of the list published by <@${interaction.user.id}>:`,
                                files: [attachment],
                                components: [row]
                            });
                        } else {
                            const { content } = await generateResponse(session.text, session.options);
                            const editRow = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setCustomId(`edit_published_${interaction.user.id}`)
                                        .setLabel('Edit')
                                        .setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder()
                                        .setCustomId(`delete_published_${interaction.user.id}`)
                                        .setLabel('Delete')
                                        .setStyle(ButtonStyle.Danger)
                                );
                            await channel.send({ content, components: [editRow] });
                        }
                        await interaction.editReply({ content: 'List published to channel!', components: [], files: [] });
                        sessions.delete(interaction.message.id);
                    } else {
                        throw new Error('Could not access the channel to publish.');
                    }
                } catch (err) {
                    console.error('Publish error:', err);
                    await interaction.followUp({ content: `Failed to publish: ${err.message}`, ephemeral: true });
                }
                return;
            }

            // Handle Option Toggles
            const { options } = session;
            
            if (interaction.customId === 'toggle_combine') options.combineUnits = !options.combineUnits;
            if (interaction.customId === 'toggle_subunits') options.hideSubunits = !options.hideSubunits;
            if (interaction.customId === 'toggle_header') options.multilineHeader = !options.multilineHeader;
            if (interaction.customId === 'toggle_bullets') options.noBullets = !options.noBullets;
            if (interaction.customId === 'toggle_points') options.hidePoints = !options.hidePoints;
            if (interaction.customId === 'toggle_abbr_header') options.abbreviateHeader = !options.abbreviateHeader;
            if (interaction.customId === 'toggle_mandatory') {
                const cur = options.wargearShowMode || (options.showMandatoryWargear ? 'show-all' : 'hide-mandatory');
                if (cur === 'show-all') {
                    options.wargearShowMode = 'hide-mandatory';
                } else if (cur === 'hide-mandatory') {
                    options.wargearShowMode = 'hide-all';
                } else {
                    options.wargearShowMode = 'show-all';
                }
                options.showMandatoryWargear = (options.wargearShowMode === 'show-all');
            }
            
            if (interaction.customId === 'select_color') {
                options.colorMode = interaction.values[0];
            }

            if (interaction.customId === 'select_format') {
                options.format = interaction.values[0];
            }

            if (interaction.customId === 'btn_config_colors') {
                const colors = options.customColors || { unit: '37', subunit: '90', wargear: '37', points: '33', header: '33', icon: '33' };
                const { content, components } = generateColorConfig(colors, 'units');
                await interaction.update({ content, components });
                return;
            }

            if (interaction.customId === 'btn_config_accents') {
                const colors = options.customColors || { unit: '37', subunit: '90', wargear: '37', points: '33', header: '33', icon: '33' };
                const { content, components } = generateColorConfig(colors, 'accents');
                await interaction.update({ content, components });
                return;
            }

            if (interaction.customId === 'btn_config_units') {
                const colors = options.customColors || { unit: '37', subunit: '90', wargear: '37', points: '33', header: '33', icon: '33' };
                const { content, components } = generateColorConfig(colors, 'units');
                await interaction.update({ content, components });
                return;
            }

            if (interaction.customId === 'btn_config_done') {
                const { content, components, files } = await generateResponse(session.text, options);
                await interaction.update({ content, components, files: files || [] });
                return;
            }

            if (interaction.customId.startsWith('cfg_')) {
                const type = interaction.customId.replace('cfg_', '');
                const colorVal = interaction.values[0];
                
                if (!options.customColors) options.customColors = { unit: '37', subunit: '90', wargear: '37', points: '33', header: '33', icon: '33' };
                options.customColors[type] = colorVal;
                
                // Stay on current page
                const page = (type === 'header' || type === 'points' || type === 'icon') ? 'accents' : 'units';
                const { content, components } = generateColorConfig(options.customColors, page);
                await interaction.update({ content, components });
                return;
            }

            // Update session
            sessions.set(interaction.message.id, { text: session.text, options });

            // Re-render
            const { content, components, files } = await generateResponse(session.text, options);
            await interaction.update({ content, components, files: files || [] });
        } catch (error) {
            console.error('Interaction error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred processing your request.', ephemeral: true });
            }
        }
    } else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'edit_published_modal') {
            const newText = interaction.fields.getTextInputValue('edited_text');
            await interaction.message.edit({ content: newText });
            await interaction.reply({ content: 'Updated!', ephemeral: true });
            return;
        }
    }
    } catch (error) {
        console.error('Global interaction error:', error);
    }
});

function generateColorConfig(colors, page) {
    const getColorOptions = (selectedVal) => Object.entries(colorNameToHex).map(([name, hex]) => {
        const entry = ansiPalette.find(p => p.hex.toLowerCase() === hex.toLowerCase());
        const code = entry ? entry.code.toString() : '37';
        return new StringSelectMenuOptionBuilder()
            .setLabel(name.charAt(0).toUpperCase() + name.slice(1))
            .setValue(code)
            .setDescription(`Select ${name}`)
            .setDefault(code === selectedVal);
    });

    const components = [];

    if (page === 'units') {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_unit').setPlaceholder('Unit Color').addOptions(getColorOptions(colors.unit))
        ));
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_subunit').setPlaceholder('Subunit Color').addOptions(getColorOptions(colors.subunit))
        ));
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_wargear').setPlaceholder('Wargear Color').addOptions(getColorOptions(colors.wargear))
        ));
        
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_config_accents').setLabel('Next: Accents').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_config_done').setLabel('Done').setStyle(ButtonStyle.Success)
        ));
    } else {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_header').setPlaceholder('Header Color').addOptions(getColorOptions(colors.header))
        ));
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_points').setPlaceholder('Points Color').addOptions(getColorOptions(colors.points))
        ));
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_icon').setPlaceholder('Icon Color').addOptions(getColorOptions(colors.icon || colors.header))
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_config_units').setLabel('Back: Units').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('btn_config_done').setLabel('Done').setStyle(ButtonStyle.Success)
        ));
    }

    return { content: `**Configure Custom Colors (${page === 'units' ? '1/2' : '2/2'})**\nSelect colors for each element below.${page !== 'units' ? '\n*(Icon Color affects the faction emblem in Image mode)*' : ''}`, components };
}

async function generateResponse(text, options) {
    let outputText = '';
    let files = [];
    try {
        const lines = text.split(/\r?\n/);
        const format = detectFormat(lines);
        
        const parser = {
            V11_GENERIC: parseV11List,
            GW_APP_V11: parseGwAppV11,
            WAR_ORGAN_V11: parseWarOrganV11
        }[format];

        if (!parser) {
            return { content: 'Could not detect list format. Please check your input.', components: [] };
        }

        const parsedData = parser(lines, skippableWargear);
        const isImage = options.format === 'imageCodex' || options.format === 'imageCodexAbbr';

        if (isImage) {
            // Generate PNG preview
            const imageOpts = {
                hideSubunits: options.hideSubunits,
                wargearShowMode: options.wargearShowMode,
                hidePoints: options.hidePoints,
                combineIdenticalUnits: options.combineUnits,
                useAbbreviations: options.format === 'imageCodexAbbr',
                noBullets: options.noBullets,
                abbreviateHeader: options.abbreviateHeader,
                colorMode: options.colorMode || 'faction',
                customColors: options.customColors
            };
            const pngBuffer = await generateImageBuffer(parsedData, imageOpts);
            const armyName = (parsedData.metadata?.title || parsedData.metadata?.armyName || 'army-list').toLowerCase().replace(/[^a-z0-9]/g, '-');
            const attachment = new AttachmentBuilder(pngBuffer, { name: `${armyName}-card.png` });
            files = [attachment];
            
            // Text content for image mode: just a friendly header / title
            const totalPts = parsedData.metadata?.pointsTotal || parsedData.metadata?.totalPoints || 0;
            const faction = parsedData.metadata?.faction || '';
            const listTitle = parsedData.metadata?.title || parsedData.metadata?.armyName || 'Army List';
            outputText = `📊 **Codex Card Preview** for **${listTitle}** (${faction}${totalPts ? ` | ${totalPts} pts` : ''})`;
        } else {
            const abbrIndex = buildAbbreviationIndex(parsedData); // No custom abbrs for now in Discord bot

            const renderOptions = {
                multilineHeader: options.multilineHeader,
                abbreviateHeader: options.abbreviateHeader,
                wargearShowMode: options.wargearShowMode,
                colorMode: options.colorMode,
                forcePalette: true, // Ensure we use Discord-safe colors
                colors: options.customColors
            };

            // Map format selection to renderer arguments
            let plain = false;
            let useAbbreviations = true;
            
            switch (options.format) {
                case 'discordCompact': plain = false; useAbbreviations = true; break;
                case 'discordExtended': plain = false; useAbbreviations = false; break;
                case 'plainText': plain = true; useAbbreviations = true; break;
                case 'plainTextExtended': plain = true; useAbbreviations = false; break;
            }

            outputText = generateDiscordText(
                parsedData,
                plain,
                useAbbreviations,
                abbrIndex,
                options.hideSubunits,
                skippableWargear,
                options.combineUnits,
                renderOptions,
                options.noBullets,
                options.hidePoints
            );
        }

        const userAttribution = options.userId ? `List created by <@${options.userId}>` : (options.username ? `List created by ${options.username}` : 'List created');
        outputText += `\n*${userAttribution} with [40kCompactor](https://www.40kcompactor.com/)*`;

    } catch (err) {
        console.error(err);
        return { content: `Error processing list: ${err.message}`, components: [] };
    }

    // Truncate if too long for Discord (2000 chars)
    if (outputText.length > 2000) {
        outputText = outputText.substring(0, 1900) + '\n... (truncated)';
    }

    // Build UI Components
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('toggle_header')
                .setLabel(options.multilineHeader ? 'Single Header' : 'Multi Header')
                .setStyle(options.multilineHeader ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_abbr_header')
                .setLabel(options.abbreviateHeader ? 'Full Header' : 'Abbr Header')
                .setStyle(options.abbreviateHeader ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_combine')
                .setLabel(options.combineUnits ? 'Split Units' : 'Combine Units')
                .setStyle(options.combineUnits ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_subunits')
                .setLabel(options.hideSubunits ? 'Show Subunits' : 'Hide Subunits')
                .setStyle(options.hideSubunits ? ButtonStyle.Secondary : ButtonStyle.Primary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('toggle_bullets')
                .setLabel(options.noBullets ? 'Show Bullets' : 'Hide Bullets')
                .setStyle(options.noBullets ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_points')
                .setLabel(options.hidePoints ? 'Show Points' : 'Hide Points')
                .setStyle(options.hidePoints ? ButtonStyle.Primary : ButtonStyle.Secondary),
            (() => {
                const cur = options.wargearShowMode || (options.showMandatoryWargear ? 'show-all' : 'hide-mandatory');
                let label = 'Wargear: Hide Mand.';
                let style = ButtonStyle.Secondary;
                if (cur === 'show-all') {
                    label = 'Wargear: Show All';
                    style = ButtonStyle.Primary;
                } else if (cur === 'hide-all') {
                    label = 'Wargear: Hide All';
                    style = ButtonStyle.Danger;
                }
                return new ButtonBuilder()
                    .setCustomId('toggle_mandatory')
                    .setLabel(label)
                    .setStyle(style);
            })()
        );

    const row3 = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_format')
                .setPlaceholder('Select List Style')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Discord (Compact)').setValue('discordCompact').setDefault(options.format === 'discordCompact'),
                    new StringSelectMenuOptionBuilder().setLabel('Discord (Extended)').setValue('discordExtended').setDefault(options.format === 'discordExtended'),
                    new StringSelectMenuOptionBuilder().setLabel('Plain Text').setValue('plainText').setDefault(options.format === 'plainText'),
                    new StringSelectMenuOptionBuilder().setLabel('Plain Text (Extended)').setValue('plainTextExtended').setDefault(options.format === 'plainTextExtended'),
                    new StringSelectMenuOptionBuilder().setLabel('Image (Codex Card)').setValue('imageCodex').setDefault(options.format === 'imageCodex'),
                    new StringSelectMenuOptionBuilder().setLabel('Image (Codex Card Abbreviated)').setValue('imageCodexAbbr').setDefault(options.format === 'imageCodexAbbr')
                )
        );

    const row4 = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_color')
                .setPlaceholder('Select Color Mode')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Faction Colors').setValue('faction').setDefault(options.colorMode === 'faction'),
                    new StringSelectMenuOptionBuilder().setLabel('No Color').setValue('none').setDefault(options.colorMode === 'none'),
                    new StringSelectMenuOptionBuilder().setLabel('Custom').setValue('custom').setDefault(options.colorMode === 'custom')
                )
        );

    const publishButtons = [
        new ButtonBuilder()
            .setCustomId('publish')
            .setLabel('Publish to Channel')
            .setStyle(ButtonStyle.Success)
    ];

    if (options.colorMode === 'custom') {
        publishButtons.push(
            new ButtonBuilder()
                .setCustomId('btn_config_colors')
                .setLabel('Configure Colors')
                .setStyle(ButtonStyle.Secondary)
        );
    }

    publishButtons.push(
        new ButtonBuilder()
            .setLabel('Support on Ko-fi')
            .setURL('https://ko-fi.com/U7U7Z3Q0S')
            .setStyle(ButtonStyle.Link)
    );

    const rowPublish = new ActionRowBuilder().addComponents(publishButtons);

    const components = [row1, row2, row3, row4, rowPublish];

    return { content: outputText, components, files };
}

client.login(process.env.DISCORD_TOKEN);
