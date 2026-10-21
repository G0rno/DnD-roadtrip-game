# Roadtrip RPG

A 2-player co-op, D&D-style game for the iPad, with an AI Game Master. Built for a long road trip.

It's a web app (PWA): open it in Safari, add it to the home screen, and it works offline after the first load.

## Status

**Phases 2 and 4 done: core engine, battle scene, and the AI Game Master.**

- AI Game Master (Claude API, key entered in Settings, stored only on the device): a story bible per run (villain, four lieutenants who are the act bosses, recurring characters), a scene before every step, AI-written events with a "Something else" free-text option, narrated outcomes, act intros, boss confrontations, an ending, a Journal and a "Previously..." recap. Haiku for routine scenes, Sonnet for key moments; cost shown in Settings, budget mode available. Without signal it uses pre-written scenes, then templates.
- Battle scene: region backdrops, pixel sprites (0x72 DungeonTileset II, CC0), enemy turns played one action at a time, item comparison.

- Character creation (guided, 5 steps per player, randomize per step or whole character)
- Combat: team turns, front/back rows, enemy intentions, cooldowns, 10 status effects, class combos, team meter and Duo Strike, elites and 2–3 phase bosses
- Skill checks (2d10 + stat, odds shown, reroll tokens), template events
- Items: 7 slots, 4 rarities, affixes, signature legendaries (18 of 31 so far), shared bag and belts, shops, Rest or Forge, salvage to essence
- Leveling with talents and stat points, escalating revives, wipe rollback to the act start with curses
- Autosave after every action, 3 run slots, backup export/import (Files app), offline play
- A temporary path picker stands in for the Phase 3 map

Coming next: the map (3), voice narration and car mode (5), content, companions and unlocks (6), playtesting (7).

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

Sprites: DungeonTileset II by 0x72 (CC0). Fonts: Cinzel and Alegreya Sans (SIL Open Font License). Rules inspired by the D&D 5e SRD (Creative Commons).
