import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getAllProfiles,
    getAllScores,
    getOrCreatePlayer,
    normalizeUsername,
    savePlayer,
    updateLikedTracks,
} from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in Render Environment Variables (or a local .env).'
    );
    process.exit(1);
}

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(ROOT_DIR));

app.get('/api/players/:username', async function (req, res) {
    try {
        const username = normalizeUsername(req.params.username);
        if (!username) {
            res.status(400).json({ error: 'Nom d\'utilisateur invalide' });
            return;
        }

        const { profile, created } = await getOrCreatePlayer(username);
        res.json({ profile, created });
    } catch (error) {
        console.error('GET /api/players/:username failed', error);
        res.status(500).json({ error: 'Impossible de charger le profil' });
    }
});

app.put('/api/players/:username', async function (req, res) {
    try {
        const username = normalizeUsername(req.params.username);
        if (!username) {
            res.status(400).json({ error: 'Nom d\'utilisateur invalide' });
            return;
        }

        if (!req.body || typeof req.body !== 'object') {
            res.status(400).json({ error: 'Profil invalide' });
            return;
        }

        const profile = await savePlayer(username, req.body);
        res.json({ profile });
    } catch (error) {
        console.error('PUT /api/players/:username failed', error);
        res.status(500).json({ error: 'Impossible de sauvegarder le profil' });
    }
});

app.patch('/api/players/:username/likes', async function (req, res) {
    try {
        const username = normalizeUsername(req.params.username);
        if (!username) {
            res.status(400).json({ error: 'Nom d\'utilisateur invalide' });
            return;
        }

        if (!Array.isArray(req.body?.likedTracks)) {
            res.status(400).json({ error: 'Liste de favoris invalide' });
            return;
        }

        const profile = await updateLikedTracks(username, req.body.likedTracks);
        res.json({ profile });
    } catch (error) {
        if (error.message === 'Player not found') {
            res.status(404).json({ error: 'Joueur introuvable' });
            return;
        }

        console.error('PATCH /api/players/:username/likes failed', error);
        res.status(500).json({ error: 'Impossible de sauvegarder les favoris' });
    }
});

app.get('/api/leaderboard', async function (_req, res) {
    try {
        const profiles = await getAllProfiles();
        const scores = await getAllScores();
        res.json({ profiles, scores });
    } catch (error) {
        console.error('GET /api/leaderboard failed', error);
        res.status(500).json({ error: 'Impossible de charger le classement' });
    }
});

app.listen(PORT, function () {
    console.log(`Advency Sound System running at http://localhost:${PORT}`);
});
