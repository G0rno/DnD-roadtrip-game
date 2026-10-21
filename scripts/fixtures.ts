// Writes saved runs parked on specific screens, for visual checks in a browser.
// Usage: npx vite-node scripts/fixtures.ts <outDir>
import { writeFileSync, mkdirSync } from 'node:fs';
import { newRun, finishCreation, chooseNode, advance, afterCombatAction } from '../src/engine/run';
import { gainXp } from '../src/engine/character';
import { generateItem } from '../src/engine/items';
import { botStep } from '../src/engine/bot';
import { endPlayerTurn } from '../src/engine/combat';
import { Rng } from '../src/engine/rng';
import type { Run } from '../src/engine/types';

const out = process.argv[2] ?? 'fixtures';
mkdirSync(out, { recursive: true });

function base(seed = 11): Run {
  const run = newRun(1, seed);
  finishCreation(run, [
    { name: 'Gabriel', race: 'dwarf', cls: 'fighter', background: 'soldier' },
    { name: 'Emma', race: 'elf', cls: 'cleric', background: 'acolyte' },
  ]);
  run.gold = 140;
  run.essence = 30;
  return run;
}

function save(name: string, run: Run) {
  writeFileSync(`${out}/${name}.json`, JSON.stringify(run));
}

let r = base();
r.choices = [{ type: 'event' }];
chooseNode(r, 0);
save('event', r);

r = base();
r.choices = [{ type: 'shop' }];
r.distance = 6;
chooseNode(r, 0);
save('shop', r);

r = base();
const rng = new Rng({ rngState: 5 });
r.bag[0] = { type: 'item', item: generateItem(rng, 'f1', { power: 4, rarity: 'rare', slot: 'chest' }) };
r.bag[1] = { type: 'item', item: generateItem(rng, 'f2', { power: 4, rarity: 'legendary' }) };
r.bag[2] = { type: 'consumable', stack: { id: 'potion', qty: 3 } };
r.choices = [{ type: 'rest' }];
chooseNode(r, 0);
save('rest', r);

r = base();
r.pendingLoot = [generateItem(rng, 'l1', { power: 3, rarity: 'epic', slot: 'weapon', baseId: 'greataxe' }), generateItem(rng, 'l2', { power: 3, rarity: 'legendary' }), generateItem(rng, 'l3', { power: 3, rarity: 'common', slot: 'feet' })];
r.pendingConsumables = [{ id: 'bomb', qty: 1 }];
r.pendingGold = 24;
r.pendingXp = 40;
r.screen = 'loot';
save('loot', r);

r = base();
gainXp(r.heroes[0], 200);
gainXp(r.heroes[1], 200);
advance(r);
save('levelup', r);

r = base();
r.heroes[1].dead = true;
r.heroes[1].hp = 0;
r.bag[0] = { type: 'item', item: generateItem(rng, 'r1', { power: 2, rarity: 'rare', slot: 'head' }) };
r.screen = 'revive';
save('revive', r);

r = base();
r.choices = [{ type: 'fight' }];
chooseNode(r, 0);
for (const h of r.heroes) h.hp = 1;
for (let i = 0; i < 20 && r.screen === 'combat'; i++) {
  endPlayerTurn(r);
  for (const h of r.heroes) if (!h.dead) h.hp = 1;
  afterCombatAction(r);
}
save('wipe', r);

// A boss fight mid-way, and a busy late-game fight played by the bot.
r = base(21);
for (let i = 0; i < 4000 && !(r.screen === 'hub' && r.actNode >= 10); i++) botStep(r);
if (r.screen === 'hub') chooseNode(r, 0);
for (let i = 0; i < 4 && r.screen === 'combat'; i++) botStep(r);
save('boss', r);

r = base(33);
for (let i = 0; i < 6000 && r.distance < 22; i++) botStep(r);
while (r.screen !== 'hub') botStep(r);
r.choices = [{ type: 'elite' }];
chooseNode(r, 0);
for (let i = 0; i < 2 && (r.screen as string) === 'combat'; i++) botStep(r);
save('late', r);

console.log('fixtures written to', out);
