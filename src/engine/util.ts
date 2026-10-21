import { Rng } from './rng';
import type { Hero, HeroId, LogEntry, Run } from './types';

export const MAX_LOG = 80;

export function rng(run: Run): Rng {
  return new Rng(run);
}

export function uid(run: Run): string {
  run.uidCounter += 1;
  return `u${run.uidCounter}`;
}

export function log(run: Run, text: string, kind?: LogEntry['kind']) {
  run.log.push({ text, kind });
  if (run.log.length > MAX_LOG) run.log.splice(0, run.log.length - MAX_LOG);
}

export function hero(run: Run, id: HeroId): Hero {
  return run.heroes.find((h) => h.id === id)!;
}

export function other(id: HeroId): HeroId {
  return id === 'p1' ? 'p2' : 'p1';
}

export function livingHeroes(run: Run): Hero[] {
  return run.heroes.filter((h) => !h.dead);
}
