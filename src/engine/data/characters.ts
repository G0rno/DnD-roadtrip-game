import type { BackgroundId, ClassId, RaceId, Stat, Stats } from '../types';

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  mainStat: Stat;
  baseStats: Stats;
  baseHp: number;
  hpPerLevel: number;
  startWeapon: string;
  startArmorWeight: 'light' | 'medium' | 'heavy';
  startAbilities: string[];
  applies: string;
  blurb: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    role: 'Tank, frontline',
    mainStat: 'might',
    baseStats: { might: 3, agility: 1, mind: 1, spirit: 2 },
    baseHp: 44,
    hpPerLevel: 7,
    startWeapon: 'swordShield',
    startArmorWeight: 'medium',
    startAbilities: ['guard', 'cleave'],
    applies: 'Staggered',
    blurb: 'Holds the line, takes hits for the ally and staggers enemies.',
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    role: 'Single-target burst',
    mainStat: 'agility',
    baseStats: { might: 1, agility: 3, mind: 2, spirit: 1 },
    baseHp: 34,
    hpPerLevel: 5,
    startWeapon: 'daggers',
    startArmorWeight: 'light',
    startAbilities: ['backstab', 'vanish'],
    applies: 'Exposed',
    blurb: 'Exposes enemies with every strike, then backstabs for huge damage.',
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    role: 'Area damage, control',
    mainStat: 'mind',
    baseStats: { might: 1, agility: 2, mind: 3, spirit: 1 },
    baseHp: 30,
    hpPerLevel: 4,
    startWeapon: 'staff',
    startArmorWeight: 'light',
    startAbilities: ['fireball', 'frostBind'],
    applies: 'Frozen',
    blurb: 'Burns whole groups and freezes the dangerous ones.',
  },
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    role: 'Healing, support',
    mainStat: 'spirit',
    baseStats: { might: 2, agility: 1, mind: 1, spirit: 3 },
    baseHp: 38,
    hpPerLevel: 6,
    startWeapon: 'mace',
    startArmorWeight: 'medium',
    startAbilities: ['heal', 'bless'],
    applies: 'Blessed (ally)',
    blurb: 'Keeps the party alive and blesses the ally for big turns.',
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export interface RaceDef {
  id: RaceId;
  name: string;
  bonus: Stat | 'any';
  passive: string;
}

export const RACES: Record<RaceId, RaceDef> = {
  human: { id: 'human', name: 'Human', bonus: 'any', passive: 'Once per level-up, reroll the 3 talent options.' },
  dwarf: { id: 'dwarf', name: 'Dwarf', bonus: 'might', passive: 'Resists poison. Rest nodes heal 25% more.' },
  elf: { id: 'elf', name: 'Elf', bonus: 'agility', passive: 'Bonus to initiative. Sees further on the map (Phase 3).' },
  gnome: { id: 'gnome', name: 'Gnome', bonus: 'mind', passive: 'First ability used each fight: cooldown cut by 1.' },
};
export const RACE_IDS = Object.keys(RACES) as RaceId[];

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
  perk: string;
}

export const BACKGROUNDS: Record<BackgroundId, BackgroundDef> = {
  soldier: { id: 'soldier', name: 'Soldier', perk: 'Starts with an extra armor piece. +2 on Might checks to intimidate or force.' },
  scholar: { id: 'scholar', name: 'Scholar', perk: '+2 on Mind checks. Reveals one enemy weakness per fight.' },
  criminal: { id: 'criminal', name: 'Criminal', perk: '+2 on Agility checks (traps, locks, stealth).' },
  merchant: { id: 'merchant', name: 'Merchant', perk: 'Shop prices 15% lower. Starts with extra gold.' },
  acolyte: { id: 'acolyte', name: 'Acolyte', perk: 'Revives cost one step less. The first revive of the run is free.' },
  outlander: { id: 'outlander', name: 'Outlander', perk: 'Finds extra supplies at rest nodes. Reveals a hidden node per act (Phase 3).' },
};
export const BACKGROUND_IDS = Object.keys(BACKGROUNDS) as BackgroundId[];

// ---------- Abilities ----------

export type AbilityTarget = 'enemy' | 'allEnemies' | 'ally' | 'self' | 'anyHero' | 'none';

export interface AbilityDef {
  id: string;
  name: string;
  cls: ClassId;
  cooldown: number;
  target: AbilityTarget;
  /** Uses the weapon's reach rule (melee only hits the front row). */
  melee?: boolean;
  desc: string;
  icon: string;
}

export const ABILITIES: Record<string, AbilityDef> = {
  // Fighter
  guard: { id: 'guard', name: 'Guard', cls: 'fighter', cooldown: 3, target: 'none', desc: 'Take every hit aimed at your ally until your next turn.', icon: '🛡️' },
  cleave: { id: 'cleave', name: 'Cleave', cls: 'fighter', cooldown: 2, target: 'enemy', melee: true, desc: 'Hit 2 enemies for 80% damage and Stagger them.', icon: '🪓' },
  shieldBash: { id: 'shieldBash', name: 'Shield Bash', cls: 'fighter', cooldown: 3, target: 'enemy', melee: true, desc: '110% damage; Staggered and Weak for 2 turns.', icon: '💥' },
  secondWind: { id: 'secondWind', name: 'Second Wind', cls: 'fighter', cooldown: 4, target: 'self', desc: 'Heal 30% of max HP and gain a Shield.', icon: '💨' },
  // Rogue
  backstab: { id: 'backstab', name: 'Backstab', cls: 'rogue', cooldown: 2, target: 'enemy', desc: '200% damage, +50% on a debuffed enemy. Reaches the back row.', icon: '🗡️' },
  vanish: { id: 'vanish', name: 'Vanish', cls: 'rogue', cooldown: 4, target: 'none', desc: 'Untargetable until your next turn.', icon: '🌫️' },
  poisonBlade: { id: 'poisonBlade', name: 'Poison Blade', cls: 'rogue', cooldown: 3, target: 'enemy', desc: '100% damage and a strong Poison.', icon: '🧪' },
  fanOfKnives: { id: 'fanOfKnives', name: 'Fan of Knives', cls: 'rogue', cooldown: 3, target: 'allEnemies', desc: '55% damage to all enemies and Bleed.', icon: '✴️' },
  // Mage
  fireball: { id: 'fireball', name: 'Fireball', cls: 'mage', cooldown: 3, target: 'allEnemies', desc: '75% damage to all enemies. Always crits on Exposed enemies.', icon: '🔥' },
  frostBind: { id: 'frostBind', name: 'Frost Bind', cls: 'mage', cooldown: 4, target: 'enemy', desc: '50% damage; the enemy is Frozen and skips its next turn.', icon: '❄️' },
  chainLightning: { id: 'chainLightning', name: 'Chain Lightning', cls: 'mage', cooldown: 3, target: 'enemy', desc: 'Hits the target and 2 random enemies for 80%.', icon: '⚡' },
  arcaneShield: { id: 'arcaneShield', name: 'Arcane Shield', cls: 'mage', cooldown: 4, target: 'none', desc: 'Shield on both heroes.', icon: '🔮' },
  // Cleric
  heal: { id: 'heal', name: 'Heal', cls: 'cleric', cooldown: 2, target: 'anyHero', desc: 'Restore HP to a hero.', icon: '✚' },
  bless: { id: 'bless', name: 'Bless', cls: 'cleric', cooldown: 3, target: 'anyHero', desc: 'Blessed for 2 turns: +20% damage, +2 on checks.', icon: '✨' },
  smite: { id: 'smite', name: 'Smite', cls: 'cleric', cooldown: 2, target: 'enemy', desc: '130% holy damage; heals you for a third of it.', icon: '☀️' },
  sanctuary: { id: 'sanctuary', name: 'Sanctuary', cls: 'cleric', cooldown: 4, target: 'none', desc: 'Shield and Regen on both heroes.', icon: '⛪' },
  purify: { id: 'purify', name: 'Purify', cls: 'cleric', cooldown: 3, target: 'anyHero', desc: 'Remove all debuffs from a hero and heal them a little.', icon: '💧' },
};

// ---------- Talents ----------

export interface TalentDef {
  id: string;
  name: string;
  cls?: ClassId;
  desc: string;
  /** Grants this ability. */
  ability?: string;
  stackable?: boolean;
  /** Flat modifiers merged into derived stats (per stack). */
  mods?: Partial<Record<'damagePct' | 'critChance' | 'critDamage' | 'dodge' | 'statusRes' | 'maxHpPct' | 'armorPct' | 'meterGain' | 'goldFind' | 'healingReceived' | 'healPower', number>>;
}

export const TALENTS: Record<string, TalentDef> = {
  // Fighter
  t_shieldBash: { id: 't_shieldBash', name: 'Shield Bash', cls: 'fighter', ability: 'shieldBash', desc: 'New ability: 110% damage, Staggered and Weak.' },
  t_secondWind: { id: 't_secondWind', name: 'Second Wind', cls: 'fighter', ability: 'secondWind', desc: 'New ability: heal 30% and gain a Shield.' },
  t_ironSkin: { id: 't_ironSkin', name: 'Iron Skin', cls: 'fighter', desc: '+25% Armor.', mods: { armorPct: 25 }, stackable: true },
  t_wideCleave: { id: 't_wideCleave', name: 'Wide Cleave', cls: 'fighter', desc: 'Cleave hits 3 enemies.' },
  t_unbreakable: { id: 't_unbreakable', name: 'Unbreakable', cls: 'fighter', desc: 'Below 30% HP, take 25% less damage.' },
  t_sentinel: { id: 't_sentinel', name: 'Sentinel', cls: 'fighter', desc: 'Guard also gives you a Shield.' },
  // Rogue
  t_poisonBlade: { id: 't_poisonBlade', name: 'Poison Blade', cls: 'rogue', ability: 'poisonBlade', desc: 'New ability: damage and a strong Poison.' },
  t_fanOfKnives: { id: 't_fanOfKnives', name: 'Fan of Knives', cls: 'rogue', ability: 'fanOfKnives', desc: 'New ability: hit all enemies and Bleed.' },
  t_assassin: { id: 't_assassin', name: 'Assassin', cls: 'rogue', desc: '+30% crit damage.', mods: { critDamage: 30 }, stackable: true },
  t_opportunist: { id: 't_opportunist', name: 'Opportunist', cls: 'rogue', desc: '+20% damage to debuffed enemies.' },
  t_evasion: { id: 't_evasion', name: 'Evasion', cls: 'rogue', desc: '+8% dodge.', mods: { dodge: 8 }, stackable: true },
  t_shadowstep: { id: 't_shadowstep', name: 'Shadowstep', cls: 'rogue', desc: 'Swapping rows is free and gives +25% dodge for a turn.' },
  // Mage
  t_chainLightning: { id: 't_chainLightning', name: 'Chain Lightning', cls: 'mage', ability: 'chainLightning', desc: 'New ability: hit 3 enemies.' },
  t_arcaneShield: { id: 't_arcaneShield', name: 'Arcane Shield', cls: 'mage', ability: 'arcaneShield', desc: 'New ability: Shield on both heroes.' },
  t_pyromancer: { id: 't_pyromancer', name: 'Pyromancer', cls: 'mage', desc: 'Fireball applies Burn.' },
  t_deepFreeze: { id: 't_deepFreeze', name: 'Deep Freeze', cls: 'mage', desc: 'Frost Bind cooldown -1. Shatters deal triple damage.' },
  t_glassCannon: { id: 't_glassCannon', name: 'Glass Cannon', cls: 'mage', desc: '+20% damage, -10% max HP.', mods: { damagePct: 20, maxHpPct: -10 } },
  t_spellEcho: { id: 't_spellEcho', name: 'Spell Echo', cls: 'mage', desc: '20% chance an ability does not go on cooldown.' },
  // Cleric
  t_smite: { id: 't_smite', name: 'Smite', cls: 'cleric', ability: 'smite', desc: 'New ability: holy damage that heals you.' },
  t_sanctuary: { id: 't_sanctuary', name: 'Sanctuary', cls: 'cleric', ability: 'sanctuary', desc: 'New ability: Shield and Regen on both heroes.' },
  t_purify: { id: 't_purify', name: 'Purify', cls: 'cleric', ability: 'purify', desc: 'New ability: cleanse and heal a hero.' },
  t_greaterHeal: { id: 't_greaterHeal', name: 'Greater Heal', cls: 'cleric', desc: '+30% healing done.', mods: { healPower: 30 }, stackable: true },
  t_divineFavor: { id: 't_divineFavor', name: 'Divine Favor', cls: 'cleric', desc: 'Bless lasts 1 extra turn.' },
  t_martyr: { id: 't_martyr', name: 'Martyr', cls: 'cleric', desc: 'Heal also applies Regen.' },
  // Everyone
  g_toughness: { id: 'g_toughness', name: 'Toughness', desc: '+12% max HP.', mods: { maxHpPct: 12 }, stackable: true },
  g_precision: { id: 'g_precision', name: 'Precision', desc: '+6% crit chance.', mods: { critChance: 6 }, stackable: true },
  g_fury: { id: 'g_fury', name: 'Fury', desc: '+10% damage.', mods: { damagePct: 10 }, stackable: true },
  g_fleet: { id: 'g_fleet', name: 'Fleet', desc: '+5% dodge.', mods: { dodge: 5 }, stackable: true },
  g_ironWill: { id: 'g_ironWill', name: 'Iron Will', desc: '+12% status resistance.', mods: { statusRes: 12 }, stackable: true },
  g_teamwork: { id: 'g_teamwork', name: 'Teamwork', desc: '+25% team meter gain.', mods: { meterGain: 25 }, stackable: true },
  g_scavenger: { id: 'g_scavenger', name: 'Scavenger', desc: '+15% gold found.', mods: { goldFind: 15 }, stackable: true },
  g_fieldMedic: { id: 'g_fieldMedic', name: 'Field Medic', desc: '+20% healing received.', mods: { healingReceived: 20 }, stackable: true },
};

export const MAX_ABILITIES = 4;

/** XP needed to go from `level` to `level + 1`. Front-loaded: fast early, slower later. */
export function xpToNext(level: number): number {
  return Math.round(25 * Math.pow(level, 1.4));
}

export const STAT_POINT_EVERY = 3;
