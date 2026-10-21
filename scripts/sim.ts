// Balance simulation: a bot plays many runs headlessly and reports how far it gets.
// Usage: npm run sim -- [runs=40]
import { newRun, finishCreation } from '../src/engine/run';
import { randomDraft } from '../src/engine/character';
import { botStep } from '../src/engine/bot';
import { Rng } from '../src/engine/rng';
import type { Run } from '../src/engine/types';
import { CLASSES } from '../src/engine/data/characters';

const N = Number(process.argv[2] ?? 40);
const MAX_STEPS = 6000;

interface Result {
  classes: string;
  distance: number;
  act: number;
  level: number;
  wipes: number;
  fights: number;
  rounds: number;
  victory: boolean;
  firstWipeAt: number;
}

function play(seed: number): Result {
  const run: Run = newRun(1, seed);
  const r = new Rng({ rngState: seed ^ 0x5bd1e995 });
  const a = randomDraft(r);
  const b = randomDraft(r, [a.name]);
  finishCreation(run, [a, b]);
  let rounds = 0;
  let firstWipeAt = -1;
  let wipes = 0;
  for (let i = 0; i < MAX_STEPS; i++) {
    if (run.screen === 'victory' || run.screen === 'gameover') break;
    if (run.screen === 'combat') rounds++;
    const before = run.stats.wipes;
    botStep(run);
    if (run.stats.wipes > before) {
      wipes++;
      if (firstWipeAt < 0) firstWipeAt = run.distance;
      if (wipes >= 6) break;
    }
  }
  return {
    classes: run.heroes.map((h) => CLASSES[h.cls].name).join('+'),
    distance: run.distance,
    act: run.act,
    level: Math.max(...run.heroes.map((h) => h.level)),
    wipes: run.stats.wipes,
    fights: run.stats.fights,
    rounds,
    victory: run.screen === 'victory',
    firstWipeAt,
  };
}

const results: Result[] = [];
for (let i = 0; i < N; i++) results.push(play(1000 + i * 7919));

const avg = (f: (r: Result) => number) => (results.reduce((s, r) => s + f(r), 0) / results.length).toFixed(1);
console.log(`Runs: ${N}`);
console.log(`Victories: ${results.filter((r) => r.victory).length}`);
console.log(`Avg distance: ${avg((r) => r.distance)}  avg act: ${avg((r) => r.act)}  avg max level: ${avg((r) => r.level)}`);
console.log(`Avg wipes: ${avg((r) => r.wipes)}  first wipe at distance (when any): ${(() => {
  const w = results.filter((r) => r.firstWipeAt >= 0);
  return w.length ? (w.reduce((s, r) => s + r.firstWipeAt, 0) / w.length).toFixed(1) : 'none';
})()}`);
console.log(`Avg rounds per fight: ${(results.reduce((s, r) => s + r.rounds, 0) / Math.max(1, results.reduce((s, r) => s + r.fights, 0))).toFixed(1)}`);
const byAct = [1, 2, 3, 4].map((a) => results.filter((r) => r.act >= a || r.victory).length);
console.log(`Reached act 1/2/3/4: ${byAct.join(' / ')}`);
