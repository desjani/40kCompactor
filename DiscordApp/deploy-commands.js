import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DISCORD_TOKEN) {
    console.error('Error: DISCORD_TOKEN is missing from .env file');
    process.exit(1);
}
if (!process.env.CLIENT_ID) {
    console.error('Error: CLIENT_ID is missing from .env file');
    process.exit(1);
}

const commands = [
    new SlashCommandBuilder()
        .setName('compact')
        .setDescription('Compact a Warhammer 40k army list'),
]
    .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        if (process.env.GUILD_ID) {
            console.log(`Registering commands to specific guild: ${process.env.GUILD_ID}`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            
            // Clear global commands to prevent duplicates
            console.log('Clearing global commands to prevent duplicates...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: [] },
            );
        } else {
            console.log('Registering global commands (may take up to 1 hour to propagate)');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
        }

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();
