import type { AffixId, ClassId, ConsumableId, Rarity, SlotKind, Stat, Weight } from '../types';

// ---------- Bases ----------

export interface WeaponBase {
  id: string;
  name: string;
  stat: Stat;
  melee: boolean;
  damage: [number, number];
  armor?: number;
  critChance?: number;
  bestFor: ClassId[];
  icon: string;
}

export const WEAPONS: Record<string, WeaponBase> = {
  swordShield: { id: 'swordShield', name: 'Sword and Shield', stat: 'might', melee: true, damage: [6, 8], armor: 3, bestFor: ['fighter'], icon: '⚔️' },
  greataxe: { id: 'greataxe', name: 'Greataxe', stat: 'might', melee: true, damage: [8, 11], bestFor: ['fighter'], icon: '🪓' },
  daggers: { id: 'daggers', name: 'Twin Daggers', stat: 'agility', melee: true, damage: [5, 6], critChance: 8, bestFor: ['rogue'], icon: '🗡️' },
  bow: { id: 'bow', name: 'Longbow', stat: 'agility', melee: false, damage: [5, 7], bestFor: ['rogue'], icon: '🏹' },
  staff: { id: 'staff', name: 'Staff', stat: 'mind', melee: false, damage: [5, 7], bestFor: ['mage'], icon: '🪄' },
  wand: { id: 'wand', name: 'Wand and Tome', stat: 'mind', melee: false, damage: [4, 6], critChance: 5, bestFor: ['mage'], icon: '📖' },
  mace: { id: 'mace', name: 'Mace and Holy Symbol', stat: 'spirit', melee: true, damage: [5, 7], armor: 2, bestFor: ['cleric'], icon: '🔨' },
  flail: { id: 'flail', name: 'Blessed Flail', stat: 'spirit', melee: true, damage: [6, 8], bestFor: ['cleric'], icon: '⛓️' },
};

export interface ArmorBase {
  slot: Exclude<SlotKind, 'weapon' | 'trinket'>;
  names: Record<Weight, string>;
  armor: Record<Weight, number>;
  dodge: Record<Weight, number>;
  maxHp?: number;
  statusRes?: number;
}

export const ARMORS: Record<string, ArmorBase> = {
  head: { slot: 'head', names: { light: 'Hood', medium: 'Helm', heavy: 'Great Helm' }, armor: { light: 1, medium: 2, heavy: 3 }, dodge: { light: 2, medium: 0, heavy: -1 }, statusRes: 5 },
  chest: { slot: 'chest', names: { light: 'Jerkin', medium: 'Chainmail', heavy: 'Plate Armor' }, armor: { light: 3, medium: 5, heavy: 8 }, dodge: { light: 3, medium: 1, heavy: -2 }, maxHp: 5 },
  legs: { slot: 'legs', names: { light: 'Leggings', medium: 'Chain Leggings', heavy: 'Plate Greaves' }, armor: { light: 1, medium: 3, heavy: 4 }, dodge: { light: 2, medium: 0, heavy: -1 }, maxHp: 4 },
  feet: { slot: 'feet', names: { light: 'Soft Boots', medium: 'Boots', heavy: 'Sabatons' }, armor: { light: 1, medium: 1, heavy: 2 }, dodge: { light: 3, medium: 1, heavy: 0 } },
};

export interface TrinketBase {
  id: string;
  name: string;
  implicit: { maxHp?: number; critChance?: number; dodge?: number; statusRes?: number };
}

export const TRINKETS: Record<string, TrinketBase> = {
  ring: { id: 'ring', name: 'Ring', implicit: { critChance: 3 } },
  amulet: { id: 'amulet', name: 'Amulet', implicit: { maxHp: 6 } },
  charm: { id: 'charm', name: 'Charm', implicit: { dodge: 3 } },
  talisman: { id: 'talisman', name: 'Talisman', implicit: { statusRes: 8 } },
};

export const SLOT_WEIGHTS: [SlotKind, number][] = [
  ['weapon', 22],
  ['head', 14],
  ['chest', 14],
  ['legs', 14],
  ['feet', 14],
  ['trinket', 22],
];

/** Base numbers grow 12% per item level. */
export function powerScale(power: number): number {
  return 1 + 0.12 * (power - 1);
}

// ---------- Affixes ----------

export interface AffixDef {
  id: AffixId;
  name: string;
  /** Range at item level 1; scaled values use `scales`. */
  range: [number, number];
  scales?: boolean;
  /** Which slots can roll it (empty = any). */
  slots?: SlotKind[];
  minRarity?: Rarity;
  prefix: string;
  format: (v: number, p?: string) => string;
}

const pct = (v: number) => `${v}%`;

export const AFFIXES: Record<AffixId, AffixDef> = {
  damagePct: { id: 'damagePct', name: 'Damage', range: [6, 10], prefix: 'Fierce', format: (v) => `+${pct(v)} damage` },
  critChance: { id: 'critChance', name: 'Crit chance', range: [4, 7], prefix: 'Keen', format: (v) => `+${pct(v)} crit chance` },
  critDamage: { id: 'critDamage', name: 'Crit damage', range: [15, 25], prefix: 'Brutal', format: (v) => `+${pct(v)} crit damage` },
  damageVsStatus: { id: 'damageVsStatus', name: 'Damage vs status', range: [15, 25], prefix: 'Cruel', format: (v, p) => `+${pct(v)} damage vs ${p}` },
  damageVsFront: { id: 'damageVsFront', name: 'Damage vs front row', range: [10, 15], prefix: 'Breaching', format: (v) => `+${pct(v)} damage vs front row` },
  damageVsBack: { id: 'damageVsBack', name: 'Damage vs back row', range: [12, 18], prefix: 'Seeking', format: (v) => `+${pct(v)} damage vs back row` },
  lifesteal: { id: 'lifesteal', name: 'Lifesteal', range: [4, 7], prefix: 'Vampiric', format: (v) => `${pct(v)} lifesteal` },
  onHitStatus: { id: 'onHitStatus', name: 'On-hit status', range: [15, 25], slots: ['weapon', 'trinket'], prefix: 'Venomous', format: (v, p) => `${pct(v)} chance on hit to apply ${p}` },
  maxHp: { id: 'maxHp', name: 'Max HP', range: [6, 10], scales: true, prefix: 'Sturdy', format: (v) => `+${v} max HP` },
  armor: { id: 'armor', name: 'Armor', range: [2, 3], scales: true, slots: ['head', 'chest', 'legs', 'feet', 'trinket'], prefix: 'Reinforced', format: (v) => `+${v} Armor` },
  dodge: { id: 'dodge', name: 'Dodge', range: [3, 5], prefix: 'Nimble', format: (v) => `+${pct(v)} dodge` },
  statusRes: { id: 'statusRes', name: 'Status resistance', range: [8, 14], prefix: 'Warded', format: (v) => `+${pct(v)} status resistance` },
  thorns: { id: 'thorns', name: 'Thorns', range: [2, 4], scales: true, slots: ['chest', 'legs', 'head', 'trinket'], prefix: 'Thorned', format: (v) => `Attackers take ${v} damage` },
  healingReceived: { id: 'healingReceived', name: 'Healing received', range: [10, 15], prefix: 'Blessed', format: (v) => `+${pct(v)} healing received` },
  stat: { id: 'stat', name: 'Stat', range: [1, 1], prefix: 'Gifted', format: (v, p) => `+${v} ${p ? p[0].toUpperCase() + p.slice(1) : ''}` },
  abilityCooldown: { id: 'abilityCooldown', name: 'Cooldown', range: [1, 1], minRarity: 'rare', slots: ['head', 'weapon', 'trinket'], prefix: 'Swift', format: (v, p) => `-${v} cooldown on ${p}` },
  meterGain: { id: 'meterGain', name: 'Team meter', range: [10, 20], prefix: 'Rallying', format: (v) => `+${pct(v)} team meter gain` },
  statusDuration: { id: 'statusDuration', name: 'Status duration', range: [1, 1], minRarity: 'rare', prefix: 'Lingering', format: () => `+1 turn to statuses you apply` },
  goldFind: { id: 'goldFind', name: 'Gold find', range: [10, 20], prefix: 'Gilded', format: (v) => `+${pct(v)} gold found` },
  startShield: { id: 'startShield', name: 'Start shield', range: [6, 9], scales: true, prefix: 'Guarded', format: (v) => `Start each fight with a ${v} Shield` },
};

export const AFFIX_IDS = Object.keys(AFFIXES) as AffixId[];
export const ON_HIT_STATUSES = ['poison', 'burn', 'bleed'] as const;
export const VS_STATUSES = ['frozen', 'staggered', 'exposed', 'poison', 'burn', 'bleed', 'weak'] as const;

// ---------- Rarity ----------

export const RARITY_INFO: Record<Rarity, { name: string; affixes: number; valueMult: number; essence: number; color: string }> = {
  common: { name: 'Common', affixes: 0, valueMult: 1, essence: 1, color: 'var(--r-common)' },
  rare: { name: 'Rare', affixes: 1, valueMult: 3, essence: 3, color: 'var(--r-rare)' },
  epic: { name: 'Epic', affixes: 2, valueMult: 7, essence: 6, color: 'var(--r-epic)' },
  legendary: { name: 'Legendary', affixes: 2, valueMult: 15, essence: 12, color: 'var(--r-legendary)' },
};

export type DropSource = 'normal' | 'elite' | 'boss' | 'treasure' | 'shop';

/** Drop odds in %, from the items note. Night shifts one step up. */
export const DROP_TABLE: Record<DropSource, [number, number, number, number]> = {
  normal: [70, 24, 5.5, 0.5],
  elite: [30, 45, 20, 5],
  boss: [10, 35, 40, 15],
  treasure: [40, 40, 17, 3],
  shop: [45, 38, 15, 2],
};



// ---------- Consumables ----------

export interface ConsumableDef {
  id: ConsumableId;
  name: string;
  desc: string;
  price: number;
  icon: string;
  combatOnly?: boolean;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  potion: { id: 'potion', name: 'Healing Potion', desc: 'Restore 35% of max HP.', price: 20, icon: '🧴' },
  greaterPotion: { id: 'greaterPotion', name: 'Greater Healing Potion', desc: 'Restore 70% of max HP.', price: 45, icon: '🍶' },
  antidote: { id: 'antidote', name: 'Antidote', desc: 'Remove Poison, Burn, Bleed and Weak.', price: 18, icon: '🌿' },
  bomb: { id: 'bomb', name: 'Bomb', desc: 'Damage all enemies and apply Burn.', price: 30, icon: '💣', combatOnly: true },
  smokeBomb: { id: 'smokeBomb', name: 'Smoke Bomb', desc: 'Flee a non-boss fight at no cost.', price: 35, icon: '💨', combatOnly: true },
  elixir: { id: 'elixir', name: 'Stat Elixir', desc: '+2 to your main stat for the rest of the fight.', price: 30, icon: '⚗️', combatOnly: true },
  whetstone: { id: 'whetstone', name: 'Whetstone', desc: 'Your next 3 attacks apply Bleed.', price: 22, icon: '🪨', combatOnly: true },
  wardScroll: { id: 'wardScroll', name: 'Ward Scroll', desc: 'Shield on both heroes.', price: 28, icon: '📜', combatOnly: true },
  focusTonic: { id: 'focusTonic', name: 'Focus Tonic', desc: "Reset your longest ability cooldown.", price: 30, icon: '🧉', combatOnly: true },
  meterDraught: { id: 'meterDraught', name: 'Meter Draught', desc: 'Add 35 to the team meter.', price: 32, icon: '🥤', combatOnly: true },
};
export const CONSUMABLE_IDS = Object.keys(CONSUMABLES) as ConsumableId[];
export const STACK_MAX = 3;
export const BAG_SIZE = 10;
export const BELT_SIZE = 3;

// ---------- Signature legendaries ----------
// Phase 2 implements the ones that only need engine hooks. The rest of the list (31 in the items note) comes with Phase 6.

export interface LegendaryDef {
  id: string;
  name: string;
  slot: SlotKind;
  baseId?: string;
  weight?: Weight;
  forCls?: ClassId;
  effect: string;
}

export const LEGENDARIES: Record<string, LegendaryDef> = {
  worldsplitter: { id: 'worldsplitter', name: 'Worldsplitter', slot: 'weapon', baseId: 'greataxe', forCls: 'fighter', effect: 'Cleave hits every front-row enemy and applies Staggered.' },
  longWinter: { id: 'longWinter', name: 'Staff of the Long Winter', slot: 'weapon', baseId: 'staff', forCls: 'mage', effect: 'Fireball also Freezes the enemy with the most HP.' },
  dawnbreaker: { id: 'dawnbreaker', name: 'Dawnbreaker', slot: 'weapon', baseId: 'mace', forCls: 'cleric', effect: 'Heal also deals the same amount as damage to the weakest enemy.' },
  whisperVeil: { id: 'whisperVeil', name: 'Whisper of the Veil', slot: 'weapon', baseId: 'daggers', forCls: 'rogue', effect: 'Backstab out of Vanish deals triple damage; a kill resets Vanish.' },
  crownEchoes: { id: 'crownEchoes', name: 'Crown of Echoes', slot: 'head', weight: 'light', effect: 'Each crit reduces your longest active cooldown by 1.' },
  lastStand: { id: 'lastStand', name: 'Helm of the Last Stand', slot: 'head', weight: 'heavy', effect: 'Below 30% HP, your cooldowns tick twice per turn.' },
  heartMountain: { id: 'heartMountain', name: 'Heart of the Mountain', slot: 'chest', weight: 'heavy', effect: 'Your Armor also adds to the damage you deal.' },
  spentStars: { id: 'spentStars', name: 'Robe of Spent Stars', slot: 'chest', weight: 'light', effect: 'Each ability you use this fight adds +5% damage (stacks, resets after the fight).' },
  rootedLegguards: { id: 'rootedLegguards', name: 'Rooted Legguards', slot: 'legs', weight: 'heavy', effect: "Each turn you don't swap rows, gain a small Shield." },
  sprinters: { id: 'sprinters', name: "Sprinter's Tassets", slot: 'legs', weight: 'light', effect: 'You act twice on the first turn of each fight.' },
  ghoststep: { id: 'ghoststep', name: 'Ghoststep Sandals', slot: 'feet', weight: 'light', effect: 'Dodging an attack triggers a counterattack.' },
  wanderers: { id: 'wanderers', name: "Wanderer's Boots", slot: 'feet', weight: 'medium', effect: 'Swapping rows is free and gives +20% dodge for a turn.' },
  frostLocket: { id: 'frostLocket', name: 'Frost Locket', slot: 'trinket', effect: 'Crits on Frozen enemies deal double damage.' },
  twinHearts: { id: 'twinHearts', name: 'Twin Hearts Pendant', slot: 'trinket', effect: 'Healing either player also heals the other for half.' },
  gamblersCoin: { id: 'gamblersCoin', name: "Gambler's Coin", slot: 'trinket', effect: '+1 shared reroll token per act; rerolled checks get +2.' },
  duosSigil: { id: 'duosSigil', name: "Duo's Sigil", slot: 'trinket', effect: 'The duo ultimate can be used at 75% team meter.' },
  vialPlague: { id: 'vialPlague', name: 'Vial of Plague', slot: 'trinket', effect: 'Poison stacks instead of refreshing.' },
  merchantSeal: { id: 'merchantSeal', name: "Merchant's Seal", slot: 'trinket', effect: 'Shop rerolls are free; one item per shop is half price.' },
};
