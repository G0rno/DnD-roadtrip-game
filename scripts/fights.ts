// Per-fight balance report by distance, from bot-played runs.
// Usage: npx vite-node scripts/fights.ts [runs=30]
import { newRun, finishCreation } from '../src/engine/run';
import { derive, randomDraft } from '../src/engine/character';
import { botStep } from '../src/engine/bot';
import { Rng } from '../src/engine/rng';
import type { Run } from '../src/engine/types';

const N = Number(process.argv[2] ?? 30);

interface Fight {
  d: number;
  kind: string;
  rounds: number;
  hpLost: number;
  won: boolean;
  level: number;
}
const fights: Fight[] = [];

function hpPct(run: Run) {
  const tot = run.heroes.reduce((s, h) => s + derive(h).maxHp, 0);
  return run.heroes.reduce((s, h) => s + Math.max(0, h.hp), 0) / tot;
}

for (let n = 0; n < N; n++) {
  const seed = 5000 + n * 104729;
  const run = newRun(1, seed);
  const r = new Rng({ rngState: seed ^ 0x1234 });
  const a = randomDraft(r);
  finishCreation(run, [a, randomDraft(r, [a.name])]);
  let cur: Fight | null = null;
  let startHp = 1;
  for (let i = 0; i < 5000 && run.screen !== 'victory' && run.stats.wipes < 5; i++) {
    if (run.screen === 'combat' && !cur) {
      cur = { d: run.distance, kind: run.combat!.kind, rounds: 0, hpLost: 0, won: false, level: run.heroes[0].level };
      startHp = hpPct(run);
    }
    const wipes = run.stats.wipes;
    if (run.screen === 'combat') cur!.rounds++;
    botStep(run);
    if (cur && run.screen !== 'combat') {
      cur.won = run.stats.wipes === wipes;
      cur.hpLost = cur.won ? startHp - hpPct(run) : 1;
      fights.push(cur);
      cur = null;
    }
  }
}

const buckets = [0, 3, 6, 10, 15, 20, 25, 30, 35, 40, 45];
for (const kind of ['normal', 'elite', 'boss']) {
  console.log(`\n== ${kind} ==`);
  console.log('dist   n   win%  rounds  hpLost%  lvl');
  for (let i = 0; i < buckets.length - 1; i++) {
    const f = fights.filter((x) => x.kind === kind && x.d >= buckets[i] && x.d < buckets[i + 1]);
    if (!f.length) continue;
    const avg = (g: (x: Fight) => number) => f.reduce((s, x) => s + g(x), 0) / f.length;
    console.log(
      `${String(buckets[i]).padStart(2)}-${String(buckets[i + 1] - 1).padEnd(3)} ${String(f.length).padStart(3)}  ${(avg((x) => (x.won ? 1 : 0)) * 100).toFixed(0).padStart(4)}  ${avg((x) => x.rounds).toFixed(1).padStart(6)}  ${(avg((x) => x.hpLost) * 100).toFixed(0).padStart(6)}  ${avg((x) => x.level).toFixed(1)}`,
    );
  }
}
