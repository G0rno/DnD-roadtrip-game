import type { CurseId, StatusId } from '../types';

export interface StatusDef {
  id: StatusId;
  name: string;
  icon: string;
  harmful: boolean;
  desc: string;
}

export const STATUSES: Record<StatusId, StatusDef> = {
  staggered: { id: 'staggered', name: 'Staggered', icon: '💫', harmful: true, desc: 'Deals 30% less damage.' },
  exposed: { id: 'exposed', name: 'Exposed', icon: '🎯', harmful: true, desc: 'The next hit deals 50% more damage.' },
  frozen: { id: 'frozen', name: 'Frozen', icon: '❄️', harmful: true, desc: 'Skips its next turn. A melee hit shatters it for double damage.' },
  blessed: { id: 'blessed', name: 'Blessed', icon: '✨', harmful: false, desc: '+20% damage and +2 on checks.' },
  poison: { id: 'poison', name: 'Poison', icon: '☠️', harmful: true, desc: 'Takes damage each turn.' },
  burn: { id: 'burn', name: 'Burn', icon: '🔥', harmful: true, desc: 'Takes heavy damage each turn.' },
  bleed: { id: 'bleed', name: 'Bleed', icon: '🩸', harmful: true, desc: 'Takes damage each turn.' },
  weak: { id: 'weak', name: 'Weak', icon: '🥀', harmful: true, desc: 'Deals 25% less damage.' },
  shield: { id: 'shield', name: 'Shield', icon: '🔰', harmful: false, desc: 'Absorbs damage.' },
  regen: { id: 'regen', name: 'Regen', icon: '💚', harmful: false, desc: 'Heals each turn.' },
};

/** Default durations, in the bearer's turns. */
export const STATUS_TURNS: Record<StatusId, number> = {
  staggered: 1,
  exposed: 2,
  frozen: 1,
  blessed: 2,
  poison: 3,
  burn: 2,
  bleed: 3,
  weak: 2,
  shield: 2,
  regen: 3,
};

export interface CurseDef {
  id: CurseId;
  name: string;
  desc: string;
}

export const CURSES: Record<CurseId, CurseDef> = {
  frail: { id: 'frail', name: 'Frail', desc: '-15% max HP' },
  sluggish: { id: 'sluggish', name: 'Sluggish', desc: 'All cooldowns +1' },
  clumsy: { id: 'clumsy', name: 'Clumsy', desc: '-10% dodge' },
  jinxed: { id: 'jinxed', name: 'Jinxed', desc: "Can't crit" },
  marked: { id: 'marked', name: 'Marked', desc: 'Enemies target you first, even in the back row' },
  weary: { id: 'weary', name: 'Weary', desc: '-25% healing received' },
  shaken: { id: 'shaken', name: 'Shaken', desc: '-2 on skill checks' },
  bleedingHeart: { id: 'bleedingHeart', name: 'Bleeding Heart', desc: 'Start every fight with Bleed' },
  butterfingers: { id: 'butterfingers', name: 'Butterfingers', desc: 'One belt slot locked' },
  tithe: { id: 'tithe', name: 'Tithe', desc: 'The party loses some gold after each fight' },
};
export const CURSE_IDS = Object.keys(CURSES) as CurseId[];

/** High Spirit weakens curses: 5% per Spirit point, up to 50%. */
export function curseStrength(spirit: number): number {
  return 1 - Math.min(0.5, spirit * 0.05);
}
