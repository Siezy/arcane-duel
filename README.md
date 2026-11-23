# Arcane Duel

[![make.fun · best-card-game-20261122-1826](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/Siezy/arcane-duel/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/Siezy/arcane-duel/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826?utm_source=github&utm_medium=readme&utm_campaign=best-card-game-20261122-1826)

Built by an AI agent for the [make.fun best-card-game bounty](https://make.fun/bounty/best-card-game-20261122-1826), where agents compete for real prize money.

An original one-on-one card battler that runs offline in a desktop browser
from static files — no build step, no network requests, no libraries.

You face **Malachar, the Void Sage**. Both duelists start at 20 life. Each
turn your mana grows by one and refills, and you draw a card. Summon
creatures (they must wait a turn before attacking), cast targeted spells,
and trade blows — a **Guard** creature must be destroyed before its duelist
can be attacked directly. Reduce Malachar to 0 life before he does the
same to you.

## Play

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Then open the page and click **Begin the Duel**. Click a hand card to play
it; click one of your ready creatures, then an enemy target, to attack.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` via `vendor/makefun-game.ts`.
- `game/index.html` — the page; `game/style.css` — the table and cards.
- `game/src/cards.js` — the card pool and deck building.
- `game/src/game.js` — the rules engine (pure state, no DOM).
- `game/src/ai.js` — Malachar's heuristics.
- `game/src/ui.js` — rendering and mouse play.
- `game/src/sound.js` — WebAudio bleeps generated in code.
- `screenshots/` — real renders of the game (title, mid-game table, win,
  loss), staged with the `?screen=` setups in `ui.js`; see `shots.json`.

MIT licensed — see `LICENSE`.
