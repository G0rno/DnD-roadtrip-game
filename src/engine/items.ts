import type { Rng } from './rng';
import type { Affix, AffixId, ClassId, Item, Rarity, SlotKind, Stat, Weight } from './types';
import { RARITIES, STATS } from './types';
import {
  AFFIXES,
  AFFIX_IDS,
  ARMORS,
  DROP_TABLE,
  LEGENDARIES,
  ON_HIT_STATUSES,
  RARITY_INFO,
  SLOT_WEIGHTS,
  TRINKETS,
  VS_STATUSES,
  WEAPONS,
  powerScale,
  type DropSource,
} from './data/items';
import { ABILITIES, CLASSES } from './data/characters';

const STAT_CLASS: Record<Stat, ClassId> = { might: 'fighter', agility: 'rogue', mind: 'mage', spirit: 'cleric' };

export function rollRarity(rng: Rng, source: DropSource, night = false): Rarity {
  let odds = [...DROP_TABLE[source]];
  if (night) {
    // Shift half of each tier's odds one step up.
    const shifted = [odds[0] / 2, odds[1] / 2 + odds[0] / 2, odds[2] / 2 + odds[1] / 2, odds[3] + odds[2] / 2];
    odds = shifted;
  }
  return rng.weighted(RARITIES.map((r, i) => [r, odds[i]] as const));
}

function rarityIndex(r: Rarity) {
  return RARITIES.indexOf(r);
}

export interface GenOptions {
  power: number;
  rarity?: Rarity;
  slot?: SlotKind;
  baseId?: string;
  weight?: Weight;
  source?: DropSource;
  night?: boolean;
}

export function generateItem(rng: Rng, uid: string, opts: GenOptions): Item {
  const power = Math.max(1, Math.round(opts.power));
  const rarity = opts.rarity ?? rollRarity(rng, opts.source ?? 'normal', opts.night);

  if (rarity === 'legendary' && !opts.slot) {
    const leg = rng.pick(Object.values(LEGENDARIES));
    return makeLegendary(rng, uid, leg.id, power);
  }

  const slot = opts.slot ?? rng.weighted(SLOT_WEIGHTS);
  const item = makeBase(rng, uid, slot, power, opts.baseId, opts.weight);
  item.rarity = rarity;
  const count = RARITY_INFO[rarity].affixes;
  for (let i = 0; i < count; i++) addAffix(rng, item);
  item.bestFor = computeBestFor(item);
  item.name = composeName(rng, item);
  return item;
}

export function makeLegendary(rng: Rng, uid: string, legendaryId: string, power: number): Item {
  const leg = LEGENDARIES[legendaryId];
  const item = makeBase(rng, uid, leg.slot, power, leg.baseId, leg.weight);
  item.rarity = 'legendary';
  item.legendary = leg.id;
  addAffix(rng, item);
  addAffix(rng, item);
  item.bestFor = leg.forCls ? [leg.forCls] : computeBestFor(item);
  item.name = leg.name;
  return item;
}

function makeBase(rng: Rng, uid: string, slot: SlotKind, power: number, baseId?: string, weight?: Weight): Item {
  const s = powerScale(power);
  if (slot === 'weapon') {
    const w = WEAPONS[baseId ?? rng.pick(Object.keys(WEAPONS))];
    return {
      uid,
      baseId: w.id,
      slot,
      name: w.name,
      rarity: 'common',
      power,
      base: {
        damage: [Math.round(w.damage[0] * s), Math.round(w.damage[1] * s)],
        armor: w.armor ? Math.round(w.armor * s) : undefined,
        critChance: w.critChance,
      },
      affixes: [],
      bestFor: [...w.bestFor],
    };
  }
  if (slot === 'trinket') {
    const t = TRINKETS[baseId ?? rng.pick(Object.keys(TRINKETS))];
    const imp = t.implicit;
    return {
      uid,
      baseId: t.id,
      slot,
      name: t.name,
      rarity: 'common',
      power,
      base: {
        maxHp: imp.maxHp ? Math.round(imp.maxHp * s) : undefined,
        critChance: imp.critChance,
        dodge: imp.dodge,
        statusRes: imp.statusRes,
      },
      affixes: [],
      bestFor: [],
    };
  }
  const a = ARMORS[slot];
  const wt: Weight = weight ?? rng.pick(['light', 'medium', 'heavy'] as Weight[]);
  return {
    uid,
    baseId: slot,
    slot,
    name: a.names[wt],
    rarity: 'common',
    power,
    weight: wt,
    base: {
      armor: Math.round(a.armor[wt] * s),
      dodge: a.dodge[wt] || undefined,
      maxHp: a.maxHp ? Math.round(a.maxHp * s) : undefined,
      statusRes: a.statusRes,
    },
    affixes: [],
    bestFor: [],
  };
}

function affixAllowed(id: AffixId, item: Item): boolean {
  const def = AFFIXES[id];
  if (def.slots && !def.slots.includes(item.slot)) return false;
  if (def.minRarity && rarityIndex(item.rarity) < rarityIndex(def.minRarity)) return false;
  return true;
}

export function rollAffix(rng: Rng, item: Item, exclude: AffixId[] = []): Affix {
  const options = AFFIX_IDS.filter((id) => affixAllowed(id, item) && !exclude.includes(id));
  const id = rng.pick(options);
  const def = AFFIXES[id];
  let value = rng.int(def.range[0], def.range[1]);
  if (def.scales) value = Math.max(1, Math.round(value * powerScale(item.power)));
  const affix: Affix = { id, value };
  if (id === 'stat') affix.param = item.slot === 'weapon' ? weaponStat(item) : rng.pick(STATS);
  if (id === 'damageVsStatus') affix.param = rng.pick(VS_STATUSES);
  if (id === 'onHitStatus') affix.param = rng.pick(ON_HIT_STATUSES);
  if (id === 'abilityCooldown') {
    const cls = item.bestFor[0] ?? rng.pick(Object.keys(CLASSES) as ClassId[]);
    affix.param = rng.pick(CLASSES[cls].startAbilities);
  }
  return affix;
}

function addAffix(rng: Rng, item: Item) {
  item.affixes.push(rollAffix(rng, item, item.affixes.map((a) => a.id)));
}

function weaponStat(item: Item): Stat {
  return WEAPONS[item.baseId]?.stat ?? 'might';
}

export function computeBestFor(item: Item): ClassId[] {
  const set = new Set<ClassId>();
  if (item.slot === 'weapon') WEAPONS[item.baseId].bestFor.forEach((c) => set.add(c));
  if (item.weight === 'heavy') {
    set.add('fighter');
  } else if (item.weight === 'medium') {
    set.add('cleric');
  } else if (item.weight === 'light') {
    set.add(item.slot === 'feet' || item.slot === 'legs' ? 'rogue' : 'mage');
  }
  for (const a of item.affixes) {
    if (a.id === 'stat' && a.param) set.add(STAT_CLASS[a.param as Stat]);
    if (a.id === 'abilityCooldown' && a.param) set.add(ABILITIES[a.param].cls);
  }
  return [...set].slice(0, 2);
}

const SUFFIXES = ['the Road', 'Embers', 'the Wolf', 'Dusk', 'the Vale', 'Stormlight', 'the Pass', 'Old Kings', 'the Wild', 'Ash'];

function composeName(rng: Rng, item: Item): string {
  const baseName = item.slot === 'weapon' ? WEAPONS[item.baseId].name : item.slot === 'trinket' ? TRINKETS[item.baseId].name : ARMORS[item.slot].names[item.weight!];
  if (item.rarity === 'common') return baseName;
  const prefix = AFFIXES[item.affixes[0].id].prefix;
  if (item.rarity === 'rare') return `${prefix} ${baseName}`;
  return `${prefix} ${baseName} of ${rng.pick(SUFFIXES)}`;
}

export function itemValue(item: Item): number {
  return Math.round(18 * powerScale(item.power) * RARITY_INFO[item.rarity].valueMult);
}

export function sellValue(item: Item): number {
  return Math.max(1, Math.round(itemValue(item) * 0.25));
}

export function salvageValue(item: Item): number {
  return RARITY_INFO[item.rarity].essence * (1 + Math.floor(item.power / 10));
}

export function canUpgrade(item: Item): boolean {
  return item.rarity === 'common' || item.rarity === 'rare';
}

/** Forge upgrade: one tier up (to Epic at most), adding one affix. */
export function upgradeItem(rng: Rng, item: Item) {
  if (!canUpgrade(item)) return;
  item.rarity = RARITIES[rarityIndex(item.rarity) + 1];
  addAffix(rng, item);
  item.bestFor = computeBestFor(item);
  item.name = composeName(rng, item);
}

/** Forge reroll: replace one affix with a new one. */
export function rerollAffix(rng: Rng, item: Item, index: number) {
  if (!item.affixes[index]) return;
  const others = item.affixes.filter((_, i) => i !== index).map((a) => a.id);
  item.affixes[index] = rollAffix(rng, item, [...others, item.affixes[index].id]);
  item.bestFor = item.legendary ? item.bestFor : computeBestFor(item);
  if (!item.legendary) item.name = composeName(rng, item);
}

export function describeAffix(a: Affix): string {
  return AFFIXES[a.id].format(a.value, a.param ? (ABILITIES[a.param]?.name ?? a.param) : undefined);
}

export function forgeUpgradeCost(item: Item): number {
  return (item.rarity === 'common' ? 6 : 12) * (1 + Math.floor(item.power / 10));
}

export function forgeRerollCost(item: Item): number {
  return 4 * (1 + Math.floor(item.power / 10));
}
