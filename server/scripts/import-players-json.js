/**
 * One-time import: upserts server/data/players.json into Supabase.
 *
 * Usage (from repo root, with a local .env file):
 *   npm run import-players
 *
 * Or with exported env vars:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node server/scripts/import-players-json.js
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { savePlayer, normalizeUsername } from '../store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS_FILE = path.join(__dirname, '..', 'data', 'players.json');

async function main() {
    const raw = await fs.readFile(PLAYERS_FILE, 'utf8');
    const profiles = JSON.parse(raw || '{}');
    const usernames = Object.keys(profiles);

    if (usernames.length === 0) {
        console.log('No players found in players.json — nothing to import.');
        return;
    }

    console.log(`Importing ${usernames.length} player(s)...`);

    for (const username of usernames) {
        const key = normalizeUsername(username);
        const profile = profiles[username];
        await savePlayer(key, profile);
        console.log(`  ✓ ${key}`);
    }

    console.log('Import complete.');
}

main().catch(function (error) {
    console.error('Import failed:', error);
    process.exit(1);
});
