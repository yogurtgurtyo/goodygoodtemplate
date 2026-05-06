# StarterProject — AI Instructions

This is a high school game development class project. Students are learning to build a 2D browser game using Phaser.js with AI assistance inside VS Code.

## Project Context

- **Engine:** Phaser 3 (loaded from `node_modules/phaser/dist/phaser.min.js`)
- **Language:** Plain JavaScript — no TypeScript, no build step, no bundler
- **Preview:** Live Server extension (right-click `index.html` → Open with Live Server)
- **Entry points:** `index.html` loads Phaser, then `player.js`, then `game.js`
- **Students are beginners.** Prioritize clarity over cleverness.

## Asset Structure

All provided assets live in the `assets/` folder inside this project:

- `assets/2d/` — sprite sheets, backgrounds, tiles, characters, items, traps
- `assets/audio/` — SFX, instruments, voices

Always use **relative paths** when referencing assets. Examples:

```js
this.load.image("bg", "assets/2d/Background/Blue.png");
this.load.spritesheet(
  "player",
  "assets/2d/Main Characters/Pink Man/Run (32x32).png",
  { frameWidth: 32, frameHeight: 32 },
);
this.load.audio("jump", "assets/audio/GameSFX/jump.wav");
```

Never use absolute paths like `C:\Users\...`.

## Game Constraints

- Single player only
- Browser-based, local deploy via Live Server
- No external libraries beyond Phaser
- No backend, no server, no database

## Code Style

- Use `function` declarations (not arrow functions for scene methods)
- Player code lives in `player.js` — keep it there. Only put scene/map setup in `game.js`
- Comment any Phaser-specific API calls so the student understands what it does
- When suggesting Phaser APIs, prefer Phaser 3 syntax

## Starter Project Structure

The starter project includes a working Tiled map and playable character out of the box:

- **Map file:** `maps/level1.tmj` — Tiled JSON, 80×25 tiles at 16×16px (1280×400px total)
- **Tileset:** `assets/2d/Terrain/Terrain (16x16).png` — 22 columns, referenced in the map as `"Terrain"`
- **Background:** `assets/2d/Background/Grid.png` — 64×64 tiling grid texture (minor lines at 16px, major lines at 32px matching player size)
- **Player character:** Pink Man (`assets/2d/Main Characters/Pink Man/`) — 32×32px sprites
  - Idle: 11 frames, Run: 12 frames, Jump: 1 frame, Fall: 1 frame, Crouch: 3-frame sheet (animation plays frames 0–1, holds on frame 1)
- **Spawn point:** Defined as a Tiled point object named `player` in the `spawnpoints` object layer
- **Controls:** Arrow keys — left/right to move, up to jump, down to crouch
- **Physics:** Arcade physics, gravity 600, jump velocity -500, move speed 220, `TILE_BIAS` 32 (prevents corner snagging)
- **Player hitbox:** 20×28px (standing), 20×16px (crouching) — smaller than the 32×32 sprite frame; tunable via constants at the top of `player.js`

**File responsibilities:**

- `player.js` — all player logic: asset loading, sprite creation, animations, movement, crouch. Tuning values (`PLAYER_SPEED`, `PLAYER_JUMP`, `PLAYER_CHAR`, hitbox constants) are at the top. Students edit this file to change how the player feels or looks.
- `game.js` — scene scaffold only: config, map loading, background, camera, input, `TILE_BIAS`, and calls to `playerPreload()` / `playerCreate()` / `playerUpdate()`.

When helping students modify the game, assume this foundation is already in place. Do not rewrite the map loading or player setup unless the student explicitly asks to replace it.

## Branches

- `main` — clean student-facing base
- `dev` — teacher working branch; source of truth for the current feature set
- `MatterTest` — experimental Matter.js physics port; kept as a reference/advanced challenge, not for student distribution
- `robert` — active student branch; includes sprint + boomerang cleaver weapon (see below)

## Current State of `robert` Branch (as of May 6, 2026)

The following features have been added on top of the starter template:

### Player tuning values (top of `player.js`)

- `PLAYER_SPEED = 220`, `PLAYER_SPRINT_SPEED = 380`, `PLAYER_JUMP = -500`
- `PLAYER_HITBOX_WIDTH = 32`, `PLAYER_HITBOX_HEIGHT = 48`, `PLAYER_HITBOX_OFFSET_X = 0`, `PLAYER_HITBOX_OFFSET_Y = 12`
- `PLAYER_CROUCH_HEIGHT = 16`, `PLAYER_CROUCH_OFFSET_Y = 56`
- Sprite frames are loaded at **64×64** (not 32×32) via `frameWidth: 64, frameHeight: 64`; `setDisplaySize(64, 64)` and `setOrigin(0.5, 0.625)` keep the physics body aligned.

### Sprint (Shift key)

- `scene.shiftKey` registered in `playerCreate`
- `sprinting = shiftKey.isDown && !crouching` → uses `PLAYER_SPRINT_SPEED`
- Run animation speeds up to 20fps while sprinting (vs 12fps normal)

### Boomerang Cleaver weapon (Z key)

- Spritesheet: `assets/2d/Items/Weapons/tikitiitikitiki.png` — 32×32, 4 frames, loaded as key `"cleaver"`
- Also a `line.png` in the same folder (currently unused)
- `scene.cleavers` — physics group; `scene.maxCleavers = 3`; `scene.cleaverData` — array of state objects
- `scene.removeCleaver(cleaver, data)` — helper to destroy and splice
- **Throw:** Z pressed → spawn cleaver at player, velocity `dir * 350`, no gravity, plays `"cleaver-spin"` anim (24fps loop)
- **Return:** auto-returns after 0.5s; force-returns after 2.5s at max speed
- **Charge:** hold Z after 0.5s → cleaver stops mid-air, `chargePower` builds over 1.5s; release Z → returns faster (Linear lerp between minSpeed 350 and maxSpeed 700)
- **Catch:** when returning cleaver is within 24px of player → destroyed and removed from `cleaverData`
- **Afterimage:** ghost image spawned every 50ms while cleaver is moving, fades out over 200ms via tween
- State machine per cleaver: `state` can be `"thrown"`, `"charging"`, `"returning"`, `"magnetized"`
- `zKey` is re-fetched each frame inside `playerUpdate` via `addKey` — this is intentional (idempotent in Phaser 3)
- ⚠️ Known issue: the cleaver update loop runs **twice** in `playerUpdate` (duplicate `for` loop); second loop is redundant but harmless. Can be removed if cleaning up.

## How to Help Students

- When a student asks to add a feature, ask clarifying questions before writing code if the intent is unclear
- Suggest small, testable steps — one feature at a time
- If something won't work in a browser without a server, say so clearly
- Do not refactor working code unless the student asks
