# Roadtrip RPG

A 2-player co-op, D&D-style game for the iPad, with an AI Game Master. Built for a long road trip.

It's a web app (PWA): open it in Safari, add it to the home screen, and it works offline after the first load.

## Status

**Phase 2 (core engine and basic UI, no AI): playable.**

- Character creation (guided, 5 steps per player, randomize per step or whole character)
- Combat: team turns, front/back rows, enemy intentions, cooldowns, 10 status effects, class combos, team meter and Duo Strike, elites and 2–3 phase bosses
- Skill checks (2d10 + stat, odds shown, reroll tokens), template events
- Items: 7 slots, 4 rarities, affixes, signature legendaries (18 of 31 so far), shared bag and belts, shops, Rest or Forge, salvage to essence
- Leveling with talents and stat points, escalating revives, wipe rollback to the act start with curses
- Autosave after every action, 3 run slots, backup export/import (Files app), offline play
- A temporary path picker stands in for the Phase 3 map

Coming next: map and art (3), AI Game Master (4), narration and car mode (5), content and unlocks (6), playtesting (7).

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173 (also on your network, for the iPad)
npm test           # unit tests, including bot-played runs
npm run sim -- 40  # balance simulation: a bot plays 40 runs
npm run build      # production build in dist/
```

## Deploy (GitHub Pages)

Every push to `main` runs the tests and deploys through GitHub Actions. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Layout

- `src/engine/`: the rules, with no UI code (characters, items, combat, checks, run flow, saves). Data tables live in `src/engine/data/`.
- `src/ui/`: Preact screens and components.
- `scripts/`: balance simulation and test fixtures.
- `tests/`: engine tests.

## Credits

Fonts: Cinzel and Alegreya Sans (SIL Open Font License). Rules inspired by the D&D 5e SRD (Creative Commons).
