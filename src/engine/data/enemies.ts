import type { EnemyRole, StatusId } from '../types';

export type MoveKind =
  | 'attack' // single target
  | 'attackAll'
  | 'heal'
  | 'shield'
  | 'buff'
  | 'drain'
  | 'summon'
  | 'freeze'
  | 'raise';

export interface MoveDef {
  id: string;
  name: string;
  kind: MoveKind;
  /** Damage multiplier for attacks, or % of max HP for heals. */
  power: number;
  melee?: boolean;
  /** Prefer the hero with the lowest HP. */
  focusWeak?: boolean;
  status?: StatusId | 'region';
  weight: number;
  icon: string;
}

const M = (m: MoveDef) => m;

export const ROLE_MOVES: Record<Exclude<EnemyRole, 'boss'>, MoveDef[]> = {
  brute: [
    M({ id: 'smash', name: 'Smash', kind: 'attack', power: 1.0, melee: true, weight: 3, icon: '👊' }),
    M({ id: 'heavySmash', name: 'Heavy Smash', kind: 'attack', power: 1.6, melee: true, weight: 1, icon: '🔨' }),
    M({ id: 'rend', name: 'Rend', kind: 'attack', power: 0.7, melee: true, status: 'region', weight: 1, icon: '🩸' }),
  ],
  archer: [
    M({ id: 'shoot', name: 'Shoot', kind: 'attack', power: 1.0, weight: 3, icon: '🏹' }),
    M({ id: 'aimed', name: 'Aimed Shot', kind: 'attack', power: 1.4, focusWeak: true, weight: 1, icon: '🎯' }),
    M({ id: 'volley', name: 'Volley', kind: 'attackAll', power: 0.6, weight: 1, icon: '🌧️' }),
  ],
  caster: [
    M({ id: 'hex', name: 'Hex', kind: 'attack', power: 0.6, status: 'region', weight: 2, icon: '🌀' }),
    M({ id: 'blast', name: 'Blast', kind: 'attack', power: 1.25, weight: 2, icon: '💥' }),
    M({ id: 'curseAll', name: 'Dark Wave', kind: 'attackAll', power: 0.45, status: 'region', weight: 1, icon: '🌑' }),
  ],
  support: [
    M({ id: 'mend', name: 'Mend', kind: 'heal', power: 0.25, weight: 3, icon: '💚' }),
    M({ id: 'ward', name: 'Ward', kind: 'shield', power: 0.25, weight: 2, icon: '🔰' }),
    M({ id: 'poke', name: 'Poke', kind: 'attack', power: 0.6, weight: 2, icon: '📍' }),
  ],
};

export interface RoleBase {
  hp: number;
  damage: number;
  armor: number;
  dodge: number;
  row: 'front' | 'back';
  icon: string;
}

export const ROLE_BASE: Record<Exclude<EnemyRole, 'boss'>, RoleBase> = {
  brute: { hp: 30, damage: 7, armor: 4, dodge: 0, row: 'front', icon: '👹' },
  archer: { hp: 19, damage: 6, armor: 1, dodge: 8, row: 'back', icon: '🏹' },
  caster: { hp: 17, damage: 6, armor: 0, dodge: 4, row: 'back', icon: '🧙' },
  support: { hp: 20, damage: 4, armor: 2, dodge: 4, row: 'back', icon: '🕯️' },
};

export interface BossDef {
  name: string;
  icon: string;
  signature: MoveDef;
  /** Phase 2 summons these roles. */
  summons: Exclude<EnemyRole, 'boss'>[];
  mechanic: string;
}

export interface RegionDef {
  id: string;
  name: string;
  acts: number[];
  family: Record<Exclude<EnemyRole, 'boss'>, string>;
  hazard: StatusId;
  hazardText: string;
  nightTwist: string;
  boss: BossDef;
}

const sig = (id: string, name: string, kind: MoveKind, power: number, status?: StatusId, icon = '☄️'): MoveDef => ({
  id,
  name,
  kind,
  power,
  status,
  weight: 1,
  icon,
});

export const REGIONS: Record<string, RegionDef> = {
  forest: {
    id: 'forest',
    name: 'Whispering Forest',
    acts: [1, 2],
    family: { brute: 'Bramble Bear', archer: 'Thorn Sprite', caster: 'Forest Hag', support: 'Dryad' },
    hazard: 'bleed',
    hazardText: 'Thorns cause Bleed',
    nightTwist: 'Wolf packs join fights',
    boss: { name: 'The Elder Treant', icon: '🌳', signature: sig('entangle', 'Entangle', 'attackAll', 0.6, 'bleed', '🌿'), summons: ['archer', 'support'], mechanic: 'Entangles the party with thorns; calls sprites at 2/3 HP.' },
  },
  marsh: {
    id: 'marsh',
    name: 'Sunken Marsh',
    acts: [1, 2],
    family: { brute: 'Bog Troll', archer: 'Lizardfolk Spearthrower', caster: 'Swamp Witch', support: 'Leech Swarm' },
    hazard: 'poison',
    hazardText: 'Poison',
    nightTwist: 'Will-o-wisps lure the party into ambushes',
    boss: { name: 'The Bog Mother', icon: '🐸', signature: sig('bogBreath', 'Bog Breath', 'attackAll', 0.5, 'poison', '🤢'), summons: ['brute', 'support'], mechanic: 'Poisons everyone; drags a troll out of the mud.' },
  },
  goblin: {
    id: 'goblin',
    name: 'Goblin Hills',
    acts: [1, 2],
    family: { brute: 'Hobgoblin', archer: 'Goblin Slinger', caster: 'Goblin Shaman', support: 'Goblin Drummer' },
    hazard: 'bleed',
    hazardText: 'Traps on the path',
    nightTwist: 'Goblins raid rest nodes',
    boss: { name: 'The Goblin Warchief', icon: '👺', signature: sig('callHorde', 'Call the Horde', 'summon', 0, undefined, '📯'), summons: ['archer', 'brute'], mechanic: 'Keeps calling reinforcements.' },
  },
  ashen: {
    id: 'ashen',
    name: 'Ashen Mountains',
    acts: [2, 3],
    family: { brute: 'Orc Berserker', archer: 'Harpy', caster: 'Fire Cultist', support: 'Orc War-chanter' },
    hazard: 'burn',
    hazardText: 'Burn',
    nightTwist: 'Lava glow: fire enemies are stronger',
    boss: { name: 'The Ash Tyrant', icon: '🌋', signature: sig('eruption', 'Eruption', 'attackAll', 0.8, 'burn', '🌋'), summons: ['caster', 'brute'], mechanic: 'Erupts for heavy fire damage on everyone.' },
  },
  north: {
    id: 'north',
    name: 'Frozen North',
    acts: [2, 3],
    family: { brute: 'Frost Giant', archer: 'Ice Archer', caster: 'Rime Witch', support: 'Spirit Shaman' },
    hazard: 'frozen',
    hazardText: 'Players can be Frozen',
    nightTwist: 'Blizzard: fog of war shows 1 step only',
    boss: { name: 'The Frost Jarl', icon: '🧊', signature: sig('glacialRoar', 'Glacial Roar', 'freeze', 1.0, 'frozen', '🥶'), summons: ['archer', 'support'], mechanic: 'Freezes a hero solid, then hits hard.' },
  },
  desert: {
    id: 'desert',
    name: 'Desert Ruins',
    acts: [2, 3, 4],
    family: { brute: 'Stone Golem', archer: 'Skeleton Archer', caster: 'Mummy Priest', support: 'Scarab Swarm' },
    hazard: 'weak',
    hazardText: 'Sandstorm causes Weak',
    nightTwist: 'The dead rise: extra undead in fights',
    boss: { name: 'The Sand Pharaoh', icon: '🏺', signature: sig('sandstorm', 'Sandstorm', 'attackAll', 0.55, 'weak', '🌪️'), summons: ['archer', 'caster'], mechanic: 'Weakens the party; raises skeleton archers.' },
  },
  underdark: {
    id: 'underdark',
    name: 'Underdark',
    acts: [3, 4],
    family: { brute: 'Cave Brute', archer: 'Deep Elf Crossbow', caster: 'Mind Eater', support: 'Giant Spider' },
    hazard: 'weak',
    hazardText: 'Always night',
    nightTwist: 'Darker still: elite nodes appear more often',
    boss: { name: 'The Deep Mind', icon: '🧠', signature: sig('mindBlast', 'Mind Blast', 'attack', 2.0, 'weak', '🧠'), summons: ['caster', 'support'], mechanic: 'A crushing psychic blast on one hero.' },
  },
  cursed: {
    id: 'cursed',
    name: 'Cursed Kingdom',
    acts: [3, 4],
    family: { brute: 'Death Knight', archer: 'Wraith Archer', caster: 'Necromancer', support: 'Ghost' },
    hazard: 'weak',
    hazardText: 'Curses on failed checks',
    nightTwist: 'Fallen enemies can rise once',
    boss: { name: 'The Hollow King', icon: '👑', signature: sig('raiseDead', 'Raise the Dead', 'raise', 0, undefined, '💀'), summons: ['brute', 'archer'], mechanic: 'Raises fallen soldiers back to fight.' },
  },
};
export const REGION_IDS = Object.keys(REGIONS);

export const BOSS_MOVES: MoveDef[] = [
  { id: 'bossSlam', name: 'Crushing Blow', kind: 'attack', power: 1.4, weight: 3, icon: '🔨' },
  { id: 'bossSweep', name: 'Sweep', kind: 'attackAll', power: 0.75, weight: 2, icon: '🌀' },
];

export interface EliteMod {
  id: string;
  name: string;
  desc: string;
}

export const ELITE_MODS: Record<string, EliteMod> = {
  armored: { id: 'armored', name: 'Armored', desc: 'Much higher Armor' },
  swift: { id: 'swift', name: 'Swift', desc: '+15% dodge' },
  vampiric: { id: 'vampiric', name: 'Vampiric', desc: 'Heals for 30% of damage dealt' },
  thorned: { id: 'thorned', name: 'Thorned', desc: 'Melee attackers take damage' },
  enraged: { id: 'enraged', name: 'Enraged', desc: '+25% damage' },
  regenerating: { id: 'regenerating', name: 'Regenerating', desc: 'Heals 6% of max HP each turn' },
};
export const ELITE_MOD_IDS = Object.keys(ELITE_MODS);

/** Distance scaling for enemies. */
export function enemyScale(distance: number) {
  return {
    // Gentle early (heroes still have starting gear), steeper late (heroes have talents and good items).
    hp: 1 + 0.09 * distance + 0.0016 * distance * distance,
    damage: 1 + 0.08 * distance + 0.0016 * distance * distance,
    armor: Math.floor(distance * 0.5),
  };
}
