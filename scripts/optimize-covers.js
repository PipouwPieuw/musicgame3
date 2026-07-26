/**
 * Convert album covers in assets/covers from PNG to WebP (when needed),
 * then write assets/covers/manifest.json grouping variants by track ID.
 *
 * Existing .webp files are never re-encoded — only PNGs are converted.
 * With an all-WebP folder, this script only builds/updates the manifest.
 *
 * Usage (from repo root):
 *   npm run optimize-covers
 *
 * Options:
 *   --keep-png   Leave source PNGs after conversion
 *   --quality=N  WebP quality 1–100 (default: 80)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVERS_DIR = path.join(__dirname, '..', 'assets', 'covers');
const MANIFEST_PATH = path.join(COVERS_DIR, 'manifest.json');
const DEFAULT_QUALITY = 80;

/** Base track id + optional letter suffix, e.g. A001, A001B, A001C. */
const COVER_STEM_PATTERN = /^([A-Z]\d+)([A-Z].*)?$/i;

function parseArgs(argv) {
    let keepPng = false;
    let quality = DEFAULT_QUALITY;

    for (const arg of argv) {
        if (arg === '--keep-png') {
            keepPng = true;
            continue;
        }

        const qualityMatch = arg.match(/^--quality=(\d+)$/);
        if (qualityMatch) {
            quality = Number(qualityMatch[1]);
            if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
                throw new Error(`Invalid --quality=${qualityMatch[1]} (expected 1–100)`);
            }
        }
    }

    return { keepPng, quality };
}

async function fileSize(filePath) {
    const stat = await fs.stat(filePath);
    return stat.size;
}

function formatBytes(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function convertPngs({ keepPng, quality }) {
    const entries = await fs.readdir(COVERS_DIR);
    const pngFiles = entries.filter((name) => name.toLowerCase().endsWith('.png')).sort();

    if (pngFiles.length === 0) {
        console.log('No PNG covers found — skipping conversion (existing WebPs left untouched).');
        return;
    }

    console.log(`Optimizing ${pngFiles.length} cover(s) → WebP (quality ${quality})...`);

    let totalBefore = 0;
    let totalAfter = 0;
    let converted = 0;

    for (const name of pngFiles) {
        const pngPath = path.join(COVERS_DIR, name);
        const webpName = name.replace(/\.png$/i, '.webp');
        const webpPath = path.join(COVERS_DIR, webpName);

        const before = await fileSize(pngPath);
        totalBefore += before;

        await sharp(pngPath)
            .webp({ quality, effort: 4 })
            .toFile(webpPath);

        const after = await fileSize(webpPath);
        totalAfter += after;
        converted += 1;

        const savedPct = before > 0 ? Math.round((1 - after / before) * 100) : 0;
        console.log(
            `  ✓ ${name} → ${webpName}  ${formatBytes(before)} → ${formatBytes(after)} (−${savedPct}%)`
        );

        if (!keepPng) {
            await fs.unlink(pngPath);
        }
    }

    const savedPct =
        totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0;

    console.log('');
    console.log(
        `Done converting: ${converted} file(s). ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)} (−${savedPct}%)`
    );
    if (!keepPng) {
        console.log('Source PNGs removed. Re-drop PNGs into assets/covers and re-run to add new covers.');
    }
}

function buildManifest(webpFiles) {
    const manifest = {};

    for (const name of webpFiles) {
        const stem = name.replace(/\.webp$/i, '');
        const match = stem.match(COVER_STEM_PATTERN);
        if (!match) {
            console.warn(`  ⚠ Skipping unrecognized cover name: ${name}`);
            continue;
        }

        const trackId = match[1].toUpperCase();
        const normalizedStem = stem.toUpperCase();

        if (!manifest[trackId]) {
            manifest[trackId] = [];
        }
        if (manifest[trackId].indexOf(normalizedStem) === -1) {
            manifest[trackId].push(normalizedStem);
        }
    }

    for (const trackId of Object.keys(manifest)) {
        manifest[trackId].sort(function (a, b) {
            if (a === trackId) {
                return -1;
            }
            if (b === trackId) {
                return 1;
            }
            return a.localeCompare(b);
        });
    }

    return Object.fromEntries(
        Object.keys(manifest)
            .sort()
            .map(function (trackId) {
                return [trackId, manifest[trackId]];
            })
    );
}

async function writeManifest() {
    const entries = await fs.readdir(COVERS_DIR);
    const webpFiles = entries
        .filter(function (name) {
            return name.toLowerCase().endsWith('.webp') && name.toLowerCase() !== 'manifest.json';
        })
        .sort();

    const manifest = buildManifest(webpFiles);
    const trackCount = Object.keys(manifest).length;
    const variantCount = Object.values(manifest).reduce(function (sum, stems) {
        return sum + stems.length;
    }, 0);

    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    console.log(
        `Wrote manifest.json: ${trackCount} track id(s), ${variantCount} cover stem(s).`
    );
}

async function main() {
    const { keepPng, quality } = parseArgs(process.argv.slice(2));
    await convertPngs({ keepPng, quality });
    console.log('');
    await writeManifest();
}

main().catch(function (error) {
    console.error(error.message || error);
    process.exit(1);
});
