import fs from 'fs';
import { execSync } from 'child_process';

try {
    execSync('node cli.mjs -i samples/WTCCompactSample.txt --format discordCompact --color-mode faction > output_test.txt');
    const content = fs.readFileSync('output_test.txt', 'utf8');
    if (content.includes('\u001b[')) {
        console.log('Success: Output contains ANSI escape codes.');
        // Print a snippet to confirm
        console.log('Snippet:', JSON.stringify(content.slice(0, 100)));
    } else {
        console.error('Failure: Output does NOT contain ANSI escape codes.');
    }
} catch (e) {
    console.error('Error:', e);
}
