import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads KEY=VALUE pairs from a .env file into process.env (without overriding
 * variables that are already set). Compatible with older Node versions that
 * do not support `node --env-file`.
 */
export function loadEnvFile(filename = '.env') {
    const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
    const envPath = path.join(rootDir, filename);

    let raw;
    try {
        raw = fs.readFileSync(envPath, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return;
        }
        throw error;
    }

    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (process.env[key] == null) {
            process.env[key] = value;
        }
    }
}
