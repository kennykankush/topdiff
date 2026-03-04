# TopDiff

A League of Legends pre-game coaching overlay built with Electron + React. Analyses your matchup during champion select and displays real-time coaching briefs — builds, runes, JG paths, gameplan, and team comp — in a lightweight overlay you can keep open while you play.

---

## Features

- **Screenshot scan** — detects enemy champions and your own pick from the ranked draft pick screen
- **AI analysis** — powered by Claude (claude-sonnet-4-6) with live web search for current patch meta
- **Tabbed overlay** — JG Path / Gameplan / Runes / Build / Team Comp / Kit tabs, shift-click to stack
- **Build path** — starting items, first back buys (matchup-reactive), core items, vs-their-comp slots
- **Item images** — Data Dragon item icons shown inline
- **Champion autocomplete** — fuzzy search with portrait thumbnails from Data Dragon
- **Tips ticker** — transparent overlay mode that rotates coaching tips while in-game
- **Blue/Red side context** — JG gank timing adjusted based on your side
- **Patch-aware** — fetches current patch version from Data Dragon and includes in search query
- **Dynamic window** — overlay resizes to fit content automatically

---

## Setup

### Requirements

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com)

### Install

```bash
git clone https://github.com/kennykankush/topdiff.git
cd topdiff
npm install
```

### Add your API key

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Then open `.env` and add your key:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

> **Never commit your `.env` file.** It is already in `.gitignore`.

### Run in development

```bash
npm run dev
```

The main window and overlay will open. Logs appear in the terminal.

---

## Build for macOS

```bash
npm run dist
```

This outputs a `.dmg` installer to the `release/` folder.

**Before launching the built app**, create the config file at:

```
~/Library/Application Support/TopDiff/.env
```

```bash
mkdir -p ~/Library/Application\ Support/TopDiff
echo "ANTHROPIC_API_KEY=sk-ant-api03-..." > ~/Library/Application\ Support/TopDiff/.env
```

Then open the DMG, drag TopDiff to Applications, and launch it.

> macOS may block the app on first launch since it is unsigned. Go to **System Settings → Privacy & Security → Open Anyway**.

---

## Screen Recording Permission

TopDiff needs Screen Recording permission to scan champion select.

1. Launch the app
2. Go to **System Settings → Privacy & Security → Screen Recording**
3. Enable **TopDiff** (or **Electron** in dev mode)
4. Fully quit and relaunch

---

## How to use

1. Open TopDiff before or during champion select
2. Enter your champion and role
3. Select **Blue** or **Red** side
4. Click **Scan** to auto-detect enemy picks from your screen (or type them manually)
5. Click **Analyse Match**
6. The overlay appears with your coaching brief

### Overlay tabs

| Tab | Content |
|-----|---------|
| JG | Enemy jungler start buff, clear path, gank timing, ward tip |
| Plan | Playstyle, lane focus, enemy strategy, threats, dos/don'ts |
| Runes | Keystone, full rune page, shard recommendations |
| Build | Starting items → first back → core → vs their comp |
| Comp | Team damage type, tags, breakdown |
| Kit | Enemy laner abilities with cooldowns |

**Shift-click** tabs to stack multiple sections at once.
Click the **Tips** button in the overlay header to switch to transparent tips ticker mode.

---

## Tech stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python) (`claude-sonnet-4-6` + `claude-opus-4-6`)
- [Riot Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) for champion/item data
- [Zod](https://zod.dev/) for AI response schema validation

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required) |
| `OPENAI_API_KEY` | OpenAI key (optional, falls back to this if set) |

---

## Notes

- Screenshots are saved to `ss/` in the project root during dev (ignored by git)
- The overlay is always-on-top and click-through on areas outside interactive elements
- Data Dragon is a free public CDN — no Riot API key needed
