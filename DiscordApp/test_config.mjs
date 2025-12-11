import { generateDiscordText, ansiPalette, colorNameToHex } from '../modules/renderers.js';
import { StringSelectMenuOptionBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Mock Discord classes since we can't import them easily without a full environment or if they depend on something
// Actually discord.js exports them, so we can use them if installed.
// The user has discord.js installed in DiscordApp/node_modules.

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
        // ...
    }
    return { content: 'test', components };
}

try {
    console.log('Testing generateColorConfig...');
    const colors = { unit: '37', subunit: '90', wargear: '37', points: '33', header: '33' };
    const config = generateColorConfig(colors, 'units');
    console.log('Success!');
    console.log('Component count:', config.components.length);
} catch (e) {
    console.error('Error:', e);
}
