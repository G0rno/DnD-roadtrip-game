import type { Rng } from './rng';
import type { CheckResult, CheckTier, Difficulty, Hero, HeroId, Run, Stat } from './types';
import { derive } from './character';
import { curseStrength } from './data/statuses';

// Skill checks: 2d10 + stat vs a difficulty that scales with distance.
// Tiers by margin (GM note): great +5 or more (or double 10), success 0..+4, partial -1..-3,
// failure -4..-7, bad -8 or less. No fumbles.

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

export const DIFFICULTY_OFFSET: Record<Difficulty, number> = { easy: -3, normal: 0, hard: 3, veryhard: 6 };
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard', veryhard: 'Very hard' };

export function dcFor(run: Run, difficulty: Difficulty): number {
  return baseDc(run.distance) + DIFFICULTY_OFFSET[difficulty];
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

export function tierFor(total: number, dc: number, dice: [number, number]): CheckTier {
  if (dice[0] === 10 && dice[1] === 10) return 'great';
  const m = total - dc;
  if (m >= 5) return 'great';
  if (m >= 0) return 'success';
  if (m >= -3) return 'partial';
  if (m >= -7) return 'failure';
  return 'bad';
}

export interface CheckOdds {
  /** Success or better (includes great). */
  success: number;
  great: number;
  partial: number;
  failure: number;
  bad: number;
  bonus: number;
}

export function checkOdds(run: Run, hero: Hero, stat: Stat, dc: number): CheckOdds {
  const bonus = checkBonus(run, hero, stat);
  const counts: Record<CheckTier, number> = { great: 0, success: 0, partial: 0, failure: 0, bad: 0 };
  for (let a = 1; a <= 10; a++) for (let b = 1; b <= 10; b++) counts[tierFor(a + b + bonus, dc, [a, b])]++;
  return {
    success: (counts.great + counts.success) / 100,
    great: counts.great / 100,
    partial: counts.partial / 100,
    failure: counts.failure / 100,
    bad: counts.bad / 100,
    bonus,
  };
}

export function rollCheck(rng: Rng, run: Run, heroId: HeroId, stat: Stat, dc: number, rerolled = false): CheckResult {
  const hero = run.heroes.find((h) => h.id === heroId)!;
  const dice: [number, number] = [rng.int(1, 10), rng.int(1, 10)];
  let bonus = checkBonus(run, hero, stat);
  if (rerolled && run.heroes.some((h) => Object.values(h.equipment).some((i) => i?.legendary === 'gamblersCoin'))) bonus += 2;
  const total = dice[0] + dice[1] + bonus;
  return { heroId, stat, dice, bonus, total, dc, tier: tierFor(total, dc, dice), rerolled };
}
