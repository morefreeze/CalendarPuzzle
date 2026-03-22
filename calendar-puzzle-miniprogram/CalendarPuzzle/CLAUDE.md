# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm install                # Install dependencies
npm run dev:weapp          # WeChat mini-program dev mode (generates dist/ for WeChat Developer Tools)
npm run build:weapp        # Production build for WeChat
npm run dev:h5             # H5 web dev mode
```

Other platforms: `dev:alipay`, `dev:swan`, `dev:tt`, `dev:qq`, `dev:jd` (and corresponding `build:*`).

No test framework is configured. No lint scripts in package.json; run manually:
```bash
npx eslint src/
npx stylelint src/
npx tsc --noEmit
```

## Tech Stack

- **Taro 4.1.5** (React 18) - cross-platform mini-program framework
- **TypeScript 5.4** with path alias `@/*` -> `./src/*`
- **SCSS** for styling
- **Vite** as bundler (via Taro)
- Backend: Python/Flask on Railway (not in this repo)

## Architecture

**Entry flow:** `app.tsx` -> `pages/index/index.tsx` -> `SimpleBoard.tsx` (the active game board)

**State management:** Pure React hooks, no external state library. All game state lives in SimpleBoard via useState/useMemo/useCallback.

**Key architectural decisions:**
- Multiple board implementations exist (`SimpleBoard`, `PlayBoard`, `InteractiveBoard`, `BoardPreview`). **SimpleBoard.tsx is the currently active one** used by the index page.
- `InitBoard.tsx` is not a visual component - it holds game constants (CELL_SIZE=70px, block shapes/colors) and utility functions (rotateShape, flipShape, formatTime).
- `types/game.tsx` defines all TypeScript types (PlacedBlock, BlockType, BoardCell, etc.) despite the `.tsx` extension.

**Board layout (8x7 grid):**
- Rows 0-1: Months (Jan-Dec)
- Rows 2-5: Days (1-31)
- Rows 6-7: Weekdays + overflow days
- "Uncoverable" cells = today's date/month/weekday (highlighted yellow, cannot be covered by blocks)
- Win condition: all 10 blocks placed AND all coverable cells covered

**Custom hooks:**
- `useGameTimer` - auto-incrementing timer, persisted to storage
- `useGamePersistence` - save/load game state via mini-program storage
- `useSolver` - calls backend API for AI puzzle solutions
- `useGameInitialization` - sets up initial game state

**API layer (`utils/api.tsx`):**
- Wraps `wx.request` (WeChat native HTTP)
- Endpoints: `POST /game-id`, `POST /solution`, `GET /health`
- Config in `config/api.ts` selects env-based URLs (dev: localhost:5001, prod: Railway)
- Has retry logic and timeout handling

**Storage (`utils/storage.tsx`):**
- Wraps `wx.setStorageSync`/`wx.getStorageSync` with prefix `calendarPuzzle`
- Persists: game state, timer, game ID

## Environment Config

- `.env.development` - API at `http://localhost:5001/api`, logging enabled
- `.env.production` - API at Railway URL, logging disabled
- `config/api.ts` - merges env vars into typed config object

## Troubleshooting

Build issues: `rm -rf node_modules package-lock.json && npm install`, also `rm -rf .temp` for Taro cache.

The `dist/` folder must be imported into WeChat Developer Tools for testing. AppID is set to `touristappid` for demo use.
