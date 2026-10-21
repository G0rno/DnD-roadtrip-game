// Pixel sprites from 0x72's DungeonTileset II (CC0), bundled in public/sprites/dungeon.png.
import type { ClassId, Enemy, EnemyRole } from '../engine/types';

export const ATLAS_URL = './sprites/dungeon.png';
export const ATLAS_SIZE = 512;

export interface SpriteDef {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Idle animations: 4 frames laid out left to right. */
export const SPRITES: Record<string, SpriteDef> = {
  knight_m: { x: 128, y: 106, w: 16, h: 22 },
  knight_f: { x: 128, y: 74, w: 16, h: 22 },
  elf_m: { x: 128, y: 42, w: 16, h: 22 },
  elf_f: { x: 128, y: 16, w: 16, h: 16 },
  wizzard_m: { x: 128, y: 170, w: 16, h: 22 },
  wizzard_f: { x: 128, y: 132, w: 16, h: 28 },
  lizard_m: { x: 128, y: 237, w: 16, h: 19 },
  lizard_f: { x: 128, y: 205, w: 16, h: 19 },
  tiny_zombie: { x: 368, y: 20, w: 16, h: 12 },
  goblin: { x: 368, y: 37, w: 16, h: 11 },
  imp: { x: 368, y: 48, w: 16, h: 16 },
  skelet: { x: 368, y: 80, w: 16, h: 16 },
  muddy: { x: 368, y: 112, w: 16, h: 16 },
  swampy: { x: 432, y: 112, w: 16, h: 16 },
  zombie: { x: 368, y: 144, w: 16, h: 16 },
  ice_zombie: { x: 432, y: 144, w: 16, h: 16 },
  masked_orc: { x: 368, y: 172, w: 16, h: 20 },
  orc_warrior: { x: 368, y: 204, w: 16, h: 20 },
  orc_shaman: { x: 368, y: 236, w: 16, h: 20 },
  necromancer: { x: 366, y: 270, w: 16, h: 20 },
  wogol: { x: 368, y: 303, w: 16, h: 17 },
  chort: { x: 368, y: 328, w: 16, h: 24 },
  big_zombie: { x: 16, y: 270, w: 32, h: 34 },
  ogre: { x: 16, y: 320, w: 32, h: 32 },
  big_demon: { x: 16, y: 364, w: 32, h: 36 },
};

export const HERO_LOOKS = ['knight_m', 'knight_f', 'elf_m', 'elf_f', 'wizzard_m', 'wizzard_f', 'lizard_m', 'lizard_f'];

export const LOOK_NAMES: Record<string, string> = {
  knight_m: 'Knight',
  knight_f: 'Knight (plume)',
  elf_m: 'Ranger',
  elf_f: 'Ranger (blond)',
  wizzard_m: 'Wizard',
  wizzard_f: 'Wizard (tall hat)',
  lizard_m: 'Lizardfolk',
  lizard_f: 'Lizardfolk (red)',
};

export function defaultLook(cls: ClassId): string {
  return { fighter: 'knight_m', rogue: 'elf_m', mage: 'wizzard_m', cleric: 'knight_f' }[cls];
}

export interface EnemyLook {
  sprite: string;
  /** CSS filter tint so each region's family looks distinct. */
  filter?: string;
}

const T = {
  green: 'hue-rotate(70deg) saturate(1.2)',
  moss: 'hue-rotate(40deg) saturate(0.8) brightness(0.95)',
  ice: 'hue-rotate(170deg) saturate(1.3) brightness(1.1)',
  fire: 'hue-rotate(-20deg) saturate(1.6) brightness(1.05)',
  sand: 'sepia(0.8) saturate(1.3) brightness(1.05)',
  stone: 'grayscale(0.85) brightness(1.1)',
  dark: 'grayscale(0.4) brightness(0.7) contrast(1.2)',
  violet: 'hue-rotate(230deg) saturate(1.2)',
  ghost: 'grayscale(1) brightness(1.6) opacity(0.85)',
  pale: 'hue-rotate(180deg) brightness(1.2)',
};

/** region -> role -> look */
const FAMILY_LOOKS: Record<string, Record<Exclude<EnemyRole, 'boss'> | 'boss', EnemyLook>> = {
  forest: { brute: { sprite: 'ogre', filter: T.moss }, archer: { sprite: 'imp', filter: T.green }, caster: { sprite: 'orc_shaman', filter: T.moss }, support: { sprite: 'swampy' }, boss: { sprite: 'big_zombie', filter: T.moss } },
  marsh: { brute: { sprite: 'big_zombie' }, archer: { sprite: 'lizard_m' }, caster: { sprite: 'necromancer', filter: T.green }, support: { sprite: 'swampy' }, boss: { sprite: 'big_demon', filter: T.green } },
  goblin: { brute: { sprite: 'masked_orc' }, archer: { sprite: 'goblin' }, caster: { sprite: 'orc_shaman' }, support: { sprite: 'goblin', filter: T.fire }, boss: { sprite: 'ogre' } },
  ashen: { brute: { sprite: 'orc_warrior', filter: T.fire }, archer: { sprite: 'imp' }, caster: { sprite: 'necromancer', filter: T.fire }, support: { sprite: 'masked_orc', filter: T.fire }, boss: { sprite: 'big_demon' } },
  north: { brute: { sprite: 'big_zombie', filter: T.ice }, archer: { sprite: 'ice_zombie' }, caster: { sprite: 'necromancer', filter: T.ice }, support: { sprite: 'orc_shaman', filter: T.ice }, boss: { sprite: 'ogre', filter: T.ice } },
  desert: { brute: { sprite: 'ogre', filter: T.stone }, archer: { sprite: 'skelet' }, caster: { sprite: 'zombie', filter: T.sand }, support: { sprite: 'muddy', filter: T.sand }, boss: { sprite: 'big_demon', filter: T.sand } },
  underdark: { brute: { sprite: 'big_zombie', filter: T.dark }, archer: { sprite: 'elf_m', filter: T.violet }, caster: { sprite: 'wogol' }, support: { sprite: 'chort', filter: T.dark }, boss: { sprite: 'big_demon', filter: T.violet } },
  cursed: { brute: { sprite: 'knight_m', filter: T.dark }, archer: { sprite: 'skelet', filter: T.pale }, caster: { sprite: 'necromancer' }, support: { sprite: 'tiny_zombie', filter: T.ghost }, boss: { sprite: 'big_demon', filter: T.dark } },
};

export function enemyLook(e: Enemy): EnemyLook {
  const region = e.defId.split('.')[0];
  const fam = FAMILY_LOOKS[region] ?? FAMILY_LOOKS.forest;
  return fam[e.role] ?? fam.brute;
}
