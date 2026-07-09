# Advency Sound System — Blind Test

A French-language, browser-based **blind test** for a closed group of players. Tracks come from shared Spotify playlists; the core question is **“Quel est le titre de ce morceau ?”** — players type the song title while an excerpt plays.

Built as a single-page application with no build step: `index.html`, `style.css`, ES modules under `js/`, plus static assets.

---

## Table of contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Game concept](#game-concept)
- [Authentication](#authentication)
- [Game flow](#game-flow)
- [Difficulty levels](#difficulty-levels)
- [Scoring](#scoring)
- [Hall of Fame](#hall-of-fame)
- [Local data model](#local-data-model)
- [Front-end conventions](#front-end-conventions)
- [Assets](#assets)
- [Application states](#application-states)
- [Local development](#local-development)
- [Known limitations](#known-limitations)

---

## Overview

**Advency Sound System** is an internal blind test built on a collaborative playlist. It gamifies music recognition and memory — with escalating difficulty up to a deliberately chaotic **Glitched** mode.

- Scores, stats, and favorites are persisted in **localStorage** (per browser)
- Track metadata (title, artist, cover art) comes from the **Spotify Web API**
- Actual audio during gameplay is served from **local MP3 previews** (not streamed live from Spotify)

---

## Architecture

```
Browser SPA (index.html + style.css + js/)
    ├── Spotify Web API     → playlist metadata
    ├── localStorage          → profiles, scores, stats (per browser)
    └── Local assets        → previews, avatars, sound effects
```

### Code organization

ES modules (entry point `js/app.js`):

| Module | Responsibility |
|--------|----------------|
| `js/config.js` | Constants |
| `js/services/spotify-api.js` | Spotify token + playlist fetch |
| `js/services/local-storage.js` | Auth, scores, stats, favorites (localStorage) |
| `js/game/` | Setlist, difficulty, audio, scoring, round flow |
| `js/lib/normalize-title.js` | Title normalization + answer validation |
| `js/ui/leaderboard.js` | Hall of Fame builders |
| `js/app.js` | Init and event wiring |

Script load order:

1. jQuery 3.7.1
2. `js/app.js` (`type="module"`)

---

## Tech stack

| Layer | Technology |
|-------|------------|
| UI | HTML5, CSS (BEM + `_` separators), responsive at **640px** |
| Behavior | ES modules + jQuery (`js/`) |
| Persistence | Browser localStorage |
| Music metadata | Spotify Web API (two fixed playlists, `market=FR`) |
| Audio playback | Two `<audio>` elements + local preview files |
| Fonts | Ubuntu (normal), Yarndings 12 (glitch mode) |

---

## Game concept

### Tracks

On load, the app:

1. Fetches a Spotify token and merges tracks from playlists `6MiBYhSbLxGXfNcc5ZzNj8` and `7EMbtxrDS6DfnnQF89oise`
2. If a username is stored in `localStorage`, loads that profile automatically

Each round picks a **random unique track index** from the merged playlist. The player must **type the song title** before the excerpt ends.

### Answer validation

Titles are compared with **normalized exact matching** (`js/lib/normalize-title.js`):

- Case-insensitive, accent-stripped, punctuation removed
- Parentheticals and `feat.` suffixes stripped
- Common Spotify suffixes (`- Remastered`, `- Radio Edit`, etc.) optionally accepted

---

## Authentication

Enter a **username** to start. Profiles (scores, stats, favorites) are stored in the browser via `localStorage`. No password or server account required.

UI flow:

**Login** → **Settings** → **Game** → **End screen**

Top bar actions: logout, quit game, leaderboard, back from leaderboard.

---

## Game flow

### 1. Initialization

`js/app.js` init → `loadPlaylist()`:

- Get Spotify access token
- Merge both playlists into `tracks[]`
- Attempt auto-login from `localStorage`
- When profile exists: show settings + top bar, add `#wrapper.initialized` (fade-in)

### 2. Settings

| Setting | Default | Effect |
|---------|---------|--------|
| Tracks per game | **40** | Number of random rounds |
| Difficulty | **1 (Normal)** | See [Difficulty levels](#difficulty-levels) |

Track count is clamped to min 1, max 1000 (capped by playlist size at runtime).

### 3. Setlist construction (`buildSetlist()`)

When **Lancer la partie** is clicked:

1. Build an array of all track indices `0 … tracks.length - 1`
2. **Shuffle** and take `TRACKSBYGAME` unique indices
3. Adjust `tracksByGame` to actual length

### 4. Each round (`playRound()`)

For the current track index:

**Audio**

- Preview path: `assets/previews/{paddedIndex}.mp3` (e.g. track index 0 → `001.mp3`)
- Normal modes: `#audio_player`
- Glitched mode (5): `#audio_player_hardcore` (looping) with volume crossfade; main player muted

**Display**

- **Difficulty 1**: album cover, title, artists from Spotify
- **Difficulty 2–5**: “Morceau mystère” / “Artiste inconnu”; cover hidden
- Track counter `current/total`
- Countdown bar + numeric timer

**Answer input**

- Text field + **Valider** button (Enter submits)
- Correct answer = Spotify track title (normalized comparison)
- On wrong answer or timeout: reveal `Réponse : {title} — {artist}`

**Audio timing**

| Level | Duration | Start position | Notes |
|-------|----------|----------------|-------|
| 1–2 | 30 s | 0 (full preview) | Play until end or answer |
| 3–5 | 5 s | Random 1–24 s | Hardcore segment |
| 5 | 5 s | Random + glitch jumps | Playback rate changes, segment restarts |

If time runs out without an answer → wrong answer, streak reset, next track.

### 5. Answering

- Pause audio, freeze countdown
- **Correct**: green input state, `right.m4a`, increment streak, score += `(1 + streakBonus) × multiplier`
  - Streak bonus starts after **3** consecutive correct (`MINSTREAK = 3`)
- **Wrong / timeout**: red input state, `wrong.m4a`, reveal correct title + artist, increment wrong-answer stat
- After 1 s delay → next track or end game

### 6. Favorites

Heart button on track display (hidden on difficulty > 2). Toggles track index in `playerData.likedTracks` → persisted to `localStorage`.

### 7. End game

- Push score tuple `[difficultyName, trackCount, score]` to `playerData.scores`
- Update local profile: scores, games played, good/wrong answers
- Show end screen with difficulty label and final score
- Options: **Rejouer** or **Retour au menu**

---

## Difficulty levels

Each level changes **audio**, **metadata visibility**, and **scoring multiplier** (`pointsMultiplier = difficultyLevel`):

| # | Name | Clip | Metadata | Input | Multiplier |
|---|------|------|----------|-------|------------|
| 1 | Normal | 30 s, full | Visible | Type title | ×1 |
| 2 | Difficile | 30 s, full | Hidden | Type title | ×2 |
| 3 | Infernal | 5 s, random start | Hidden | Type title | ×3 |
| 4 | Extrême | 5 s, random | Hidden | Type title | ×4 |
| 5 | Glitched | 5 s, glitched playback | Hidden | Type title | ×5 |

**Level 5 extras:**

- `body.glitched` — Yarndings font, zalgo duplicate text, black overlay opacity tied to `--glitchedOpacity`
- Progression increases glitch intensity (avatars, playback rate, random segment jumps)
- Second half of game: `glitched_halfgame` class

---

## Scoring

```
scoreIncrement = (POINTSBYANSWER + streakBonus) × POINTSMULTIPLICATOR
```

- `POINTSBYANSWER = 1`
- `streakBonus = max(0, streak - MINSTREAK + 1)` when streak ≥ 3
- Animated `+N` popups on correct answers

Leaderboards split:

- **Parties classiques** — exactly **40** tracks (default)
- **Parties personnalisées** — any other track count

Best score per player per difficulty is kept via `returnBestScores()`.

---

## Hall of Fame

Opened via the trophy button in the top bar. Four tabs:

### Classement

Leaderboards built from all rows in `scores`, split classic vs custom games, sorted by points per difficulty.

### Statistiques

Per-difficulty grid for the logged-in user:

- Games played
- Correct / incorrect answers
- Best scores

### Favoris

List of the current user’s liked tracks with cover art and unlike button.

### Trophées

Dynamic trophies computed from all profiles (games played, accuracy, favorites count, cumulative best scores). Two entries are hard-coded jokes in HTML. Section title marks **work in progress**.

Example trophies: Accro, Fantôme, Émérite, Godiche, Sagace, Modique, Groupie, Fine bouche, etc.

---

## Local data model

| Storage key | Purpose |
|-------------|---------|
| `ass_username` | Last logged-in username |
| `ass_profiles` | JSON map of usernames → profile objects |

Profile fields: `username`, `initials`, `likedTracks`, `games_played`, `good_answers`, `wrong_answers`, `scores` (objects keyed by difficulty name where applicable).

Leaderboards and trophies compare all profiles stored on **this browser** only.

---

## Front-end conventions

- **BEM with underscores**: `panel_box__title`, `track_display__half--cover`
- **`js-*` hooks** for JavaScript only — never styled directly
- **State via CSS classes**: `visible`, `active`, `game_started`, `game_ended`, `answer_form--playing`, `answer_form--correct`, `answer_form--incorrect`, `glitched`
- **French UI copy** throughout; `lang="en"` on `<html>` is intentional legacy
- **Mobile breakpoint**: 640px (`hide_desktop`, `hide_mobile` utility classes)
- **Glitch text pattern**: every title has normal + zalgo variant; CSS toggles visibility based on `body.glitched`

Visual identity: high-contrast black/white borders, bold uppercase buttons, color-coded difficulty (green → blue → red → purple → black glitch).

---

## Assets

The repo includes SVG icons under `assets/`. The app also expects (may be gitignored or deployed separately):

| Path | Used for |
|------|----------|
| `assets/previews/*.mp3` | Game audio (one file per playlist track) |
| `assets/avatars/*.png` | Player avatars (+ `-glitched`, `-glitched2` variants) |
| `assets/right.m4a`, `assets/wrong.m4a` | Feedback sounds |

Without previews, avatars, and sound files, the game cannot run fully in a fresh clone.

---

## Application states

`#wrapper` classes orchestrate the UX:

| State | Classes / behavior |
|-------|-------------------|
| Loading | `:not(.initialized)` → opacity 0 |
| Logged in | `.js-settings.visible`, `.js-bar-top.visible` |
| In game | `.game_started` (shows game display, hides settings) |
| Game over | `.game_ended` (shows end screen) |
| Leaderboard | `.js-leaderboard.visible` (hides settings) |

---

## Local development

1. Serve the project root with any static file server (e.g. Live Server, `npx serve`, or similar).
2. Spotify client credentials must be valid for playlist metadata fetch on load.

No install step, database, or build command is required.

---

## Known limitations

- **Legacy `script.js`** — superseded by `js/` modules; kept in repo as reference only.
- **Secrets in client** — Spotify client ID/secret (obfuscated) are in source.
- **Error handling** — many Supabase calls only `console.log(error)` without user feedback.
- **Unused logic** — `minScore` is calculated but the end-game message (`.js-message`) is never populated.
- **`updateStatsBestScore`** — `bestScores` object omits **Glitched**; Glitched best score may show as 0 in stats.
- **Spotify vs local audio** — API fetches metadata; playback uses local files indexed by track position (playlist order matters).
- **No build tooling** — no TypeScript, bundler, or tests in repo.
- **Trophies tab** — partially static, partially computed; explicitly WIP.

---

## Typical user journey

1. Open app → brief loading (Spotify playlists)
2. Enter a username (or auto-login from previous session)
3. Choose track count and difficulty
4. Play rounds: hear snippet → type title → see score/streak
5. Optionally favorite tracks (Normal / Difficile only)
6. Finish → score saved → replay or menu
7. Open Hall of Fame → compare scores, inspect stats, manage favorites, view trophies
