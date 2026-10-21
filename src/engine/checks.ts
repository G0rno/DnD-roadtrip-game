import type { Rng } from './rng';
import type { CheckResult, Hero, HeroId, Run, Stat } from './types';
import { derive } from './character';
import { curseStrength } from './data/statuses';

// Skill checks: 2d10 + stat vs a difficulty that scales with distance.
// Critical success on double 10. No fumbles. Partial success when missing by 2 or less.

/** P(2d10 >= n). */
export function prob2d10AtLeast(n: number): number {
  if (n <= 2) return 1;
  if (n > 20) return 0;
  let count = 0;
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) if (a + b >= n) count++;
  return count / 100;
}

export function baseDc(distance: number): number {
  return 11 + Math.floor(distance / 4);
}

export function checkBonus(run: Run, hero: Hero, stat: Stat): number {
  const d = derive(hero);
  let bonus = d.stats[stat];
  if (hero.background === 'scholar' && stat === 'mind') bonus += 2;
  if (hero.background === 'criminal' && stat === 'agility') bonus += 2;
  if (hero.background === 'soldier' && stat === 'might') bonus += 2;
  if (hero.curses.includes('shaken')) bonus -= Math.round(2 * curseStrength(d.stats.spirit));
  void run;
  return bonus;
}

export interface CheckOdds {
  success: number;
  partial: number;
  failure: number;
  critical: number;
  bonus: number;
}

export function checkOdds(run: Run, hero: Hero, stat: Stat, dc: number): CheckOdds {
  const bonus = checkBonus(run, hero, stat);
  const success = Math.max(prob2d10AtLeast(dc - bonus), 0.01); // double 10 always succeeds
  const partialOrBetter = Math.max(prob2d10AtLeast(dc - 2 - bonus), success);
  return { success, partial: partialOrBetter - success, failure: 1 - partialOrBetter, critical: 0.01, bonus };
}

export function rollCheck(rng: Rng, run: Run, heroId: HeroId, stat: Stat, dc: number, rerolled = false): CheckResult {
  const hero = run.heroes.find((h) => h.id === heroId)!;
  const dice: [number, number] = [rng.int(1, 10), rng.int(1, 10)];
  let bonus = checkBonus(run, hero, stat);
  if (rerolled && run.heroes.some((h) => Object.values(h.equipment).some((i) => i?.legendary === 'gamblersCoin'))) bonus += 2;
  const total = dice[0] + dice[1] + bonus;
  let tier: CheckResult['tier'];
  if (dice[0] === 10 && dice[1] === 10) tier = 'critical';
  else if (total >= dc) tier = 'success';
  else if (total >= dc - 2) tier = 'partial';
  else tier = 'failure';
  return { heroId, stat, dice, bonus, total, dc, tier, rerolled };
}
