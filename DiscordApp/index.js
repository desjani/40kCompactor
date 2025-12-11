import { Client, GatewayIntentBits, Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import core modules from parent directory
import { detectFormat, parseGwApp, parseWtcCompact, parseWtc, parseNrGw, parseNrNr, parseLf } from '../modules/parsers.js';
import { buildAbbreviationIndex } from '../modules/abbreviations.js';
import { generateDiscordText, ansiPalette, colorNameToHex } from '../modules/renderers.js';

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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// In-memory session store: Map<messageId, { text: string, options: object }>
const sessions = new Map();

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
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
                    .setLabel("Paste your army list here")
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
                    content: '⚠️ **Input Limit Reached**\nDiscord has a text input limit of 4000 characters. Your list is likely truncated.\n\nPlease use the website instead: http://www.40kcompactor.com (No character limits!)',
                    ephemeral: true
                });
                return;
            }
            
            // Default options
            const options = {
                hideSubunits: false,
                combineUnits: false,
                multilineHeader: false,
                noBullets: false,
                hidePoints: false,
                username: interaction.user.username,
                userId: interaction.user.id,
                colorMode: 'faction',
                format: 'discordCompact'
            };

            const { content, components } = generateResponse(listText, options);

            // Send ephemeral preview
            const response = await interaction.reply({
                content: content,
                components: components,
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
                
                const { content } = generateResponse(session.text, session.options);
                
                try {
                    let channel = interaction.channel;
                    if (!channel && interaction.channelId) {
                        channel = await interaction.client.channels.fetch(interaction.channelId);
                    }

                    if (channel) {
                        // Debug permissions
                        if (channel.guild) {
                            const permissions = channel.permissionsFor(interaction.client.user);
                            console.log(`Attempting to publish to channel ${channel.id} (${channel.name})`);
                            console.log('Bot permissions:', permissions ? permissions.toArray() : 'Unknown');
                            
                            if (permissions && !permissions.has('SendMessages')) {
                                throw new Error(`Missing 'Send Messages' permission in #${channel.name}`);
                            }
                            if (permissions && !permissions.has('ViewChannel')) {
                                throw new Error(`Missing 'View Channel' permission in #${channel.name}`);
                            }
                        }

                        const row = new ActionRowBuilder()
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

                        await channel.send({ content, components: [row] });
                        await interaction.editReply({ content: 'List published to channel!', components: [] });
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
            
            if (interaction.customId === 'select_color') {
                options.colorMode = interaction.values[0];
            }

            if (interaction.customId === 'select_format') {
                options.format = interaction.values[0];
            }

            if (interaction.customId === 'btn_config_colors') {
                const colors = options.customColors || { unit: '37', subunit: '90', wargear: '37', points: '33', header: '33' };
                const { content, components } = generateColorConfig(colors, 'units');
                await interaction.update({ content, components });
                return;
            }

            if (interaction.customId === 'btn_config_accents') {
                const colors = options.customColors || { unit: '37', subunit: '90', wargear: '37', points: '33', header: '33' };
                const { content, components } = generateColorConfig(colors, 'accents');
                await interaction.update({ content, components });
                return;
            }

            if (interaction.customId === 'btn_config_units') {
                const colors = options.customColors || { unit: '37', subunit: '90', wargear: '37', points: '33', header: '33' };
                const { content, components } = generateColorConfig(colors, 'units');
                await interaction.update({ content, components });
                return;
            }

            if (interaction.customId === 'btn_config_done') {
                const { content, components } = generateResponse(session.text, options);
                await interaction.update({ content, components });
                return;
            }

            if (interaction.customId.startsWith('cfg_')) {
                const type = interaction.customId.replace('cfg_', '');
                const colorVal = interaction.values[0];
                
                if (!options.customColors) options.customColors = { unit: '37', subunit: '90', wargear: '37', points: '33', header: '33' };
                options.customColors[type] = colorVal;
                
                // Stay on current page
                const page = (type === 'header' || type === 'points') ? 'accents' : 'units';
                const { content, components } = generateColorConfig(options.customColors, page);
                await interaction.update({ content, components });
                return;
            }

            // Update session
            sessions.set(interaction.message.id, { text: session.text, options });

            // Re-render
            const { content, components } = generateResponse(session.text, options);
            await interaction.update({ content, components });
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
}
    } catch (error) {
        console.error('Global interaction error:', error);
    }
});

function generateColorConfig(colors, page) {
    const colorOptions = Object.entries(colorNameToHex).map(([name, hex]) => {
        const entry = ansiPalette.find(p => p.hex.toLowerCase() === hex.toLowerCase());
        const code = entry ? entry.code.toString() : '37';
        return new StringSelectMenuOptionBuilder()
            .setLabel(name.charAt(0).toUpperCase() + name.slice(1))
            .setValue(code)
            .setDescription(`Select ${name}`);
    });

    const components = [];

    if (page === 'units') {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_unit').setPlaceholder('Unit Color').addOptions(colorOptions.map(o => o.setDefault(o.data.value === colors.unit)))
        ));
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_subunit').setPlaceholder('Subunit Color').addOptions(colorOptions.map(o => o.setDefault(o.data.value === colors.subunit)))
        ));
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_wargear').setPlaceholder('Wargear Color').addOptions(colorOptions.map(o => o.setDefault(o.data.value === colors.wargear)))
        ));
        
        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_config_accents').setLabel('Next: Accents').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_config_done').setLabel('Done').setStyle(ButtonStyle.Success)
        ));
    } else {
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_header').setPlaceholder('Header Color').addOptions(colorOptions.map(o => o.setDefault(o.data.value === colors.header)))
        ));
        components.push(new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('cfg_points').setPlaceholder('Points Color').addOptions(colorOptions.map(o => o.setDefault(o.data.value === colors.points)))
        ));

        components.push(new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_config_units').setLabel('Back: Units').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('btn_config_done').setLabel('Done').setStyle(ButtonStyle.Success)
        ));
    }

    return { content: `**Configure Custom Colors (${page === 'units' ? '1/2' : '2/2'})**\nSelect colors for each element below.`, components };
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
            return { content: 'Could not detect list format. Please check your input.', components: [] };
        }

        const parsedData = parser(lines);
        const abbrIndex = buildAbbreviationIndex(parsedData); // No custom abbrs for now in Discord bot

        const renderOptions = {
            multilineHeader: options.multilineHeader,
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

        const userAttribution = options.userId ? `List created by <@${options.userId}>` : (options.username ? `List created by ${options.username}` : 'List created');
        outputText += `\n*${userAttribution} with [40kCompactor](http://www.40kcompactor.com)*`;

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
                .setCustomId('toggle_combine')
                .setLabel(options.combineUnits ? 'Split Units' : 'Combine Units')
                .setStyle(options.combineUnits ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_subunits')
                .setLabel(options.hideSubunits ? 'Show Subunits' : 'Hide Subunits')
                .setStyle(options.hideSubunits ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_bullets')
                .setLabel(options.noBullets ? 'Show Bullets' : 'Hide Bullets')
                .setStyle(options.noBullets ? ButtonStyle.Primary : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('toggle_points')
                .setLabel(options.hidePoints ? 'Show Points' : 'Hide Points')
                .setStyle(options.hidePoints ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_format')
                .setPlaceholder('Select List Style')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Discord (Compact)').setValue('discordCompact').setDefault(options.format === 'discordCompact'),
                    new StringSelectMenuOptionBuilder().setLabel('Discord (Extended)').setValue('discordExtended').setDefault(options.format === 'discordExtended'),
                    new StringSelectMenuOptionBuilder().setLabel('Plain Text').setValue('plainText').setDefault(options.format === 'plainText'),
                    new StringSelectMenuOptionBuilder().setLabel('Plain Text (Extended)').setValue('plainTextExtended').setDefault(options.format === 'plainTextExtended')
                )
        );

    const row3 = new ActionRowBuilder()
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

    const components = [row1, row2, row3];

    if (options.colorMode === 'custom') {
        const row4 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_config_colors')
                    .setLabel('Configure Colors')
                    .setStyle(ButtonStyle.Secondary)
            );
        components.push(row4);
    }

    const rowPublish = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('publish')
                .setLabel('Publish to Channel')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setLabel('Support on Ko-fi')
                .setURL('https://ko-fi.com/U7U7Z3Q0S')
                .setStyle(ButtonStyle.Link)
        );
    components.push(rowPublish);

    return { content: outputText, components };
}

client.login(process.env.DISCORD_TOKEN);
