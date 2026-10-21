import type { Rng } from './rng';
import type { BackgroundId, ClassId, EquipSlot, Hero, HeroCombat, HeroId, Item, RaceId, Stat, Stats, StatusId } from './types';
import { EQUIP_SLOTS, STATS } from './types';
import { ABILITIES, CLASSES, MAX_ABILITIES, RACES, STAT_POINT_EVERY, TALENTS, xpToNext } from './data/characters';
import { WEAPONS } from './data/items';
import { curseStrength } from './data/statuses';
import { generateItem } from './items';

export interface WeaponInfo {
  name: string;
  stat: Stat;
  melee: boolean;
  damage: [number, number];
}

export interface Derived {
  stats: Stats;
  maxHp: number;
  armor: number;
  dodge: number;
  critChance: number;
  /** Crit multiplier, e.g. 1.5. */
  critMult: number;
  damagePct: number;
  statusRes: number;
  healingReceived: number;
  healPower: number;
  lifesteal: number;
  thorns: number;
  meterGain: number;
  goldFind: number;
  startShield: number;
  statusDuration: number;
  onHit: { status: StatusId; chance: number }[];
  vsStatus: { status: string; pct: number }[];
  vsFront: number;
  vsBack: number;
  cdMods: Record<string, number>;
  weapon: WeaponInfo;
  legendaries: Set<string>;
  canCrit: boolean;
}

const UNARMED: WeaponInfo = { name: 'Fists', stat: 'might', melee: true, damage: [2, 3] };

export function equippedItems(hero: Hero): Item[] {
  return EQUIP_SLOTS.map((s) => hero.equipment[s]).filter((i): i is Item => !!i);
}

export function hasTalent(hero: Hero, id: string): boolean {
  return hero.talents.includes(id);
}

/** All numbers the combat engine needs, from stats, gear, talents, curses and in-fight buffs. */
export function derive(hero: Hero, hc?: HeroCombat): Derived {
  const cls = CLASSES[hero.cls];
  const stats: Stats = { ...hero.stats };
  const items = equippedItems(hero);
  const d: Derived = {
    stats,
    maxHp: 0,
    armor: 0,
    dodge: 0,
    critChance: 0,
    critMult: 1.5,
    damagePct: 0,
    statusRes: 0,
    healingReceived: 0,
    healPower: 0,
    lifesteal: 0,
    thorns: 0,
    meterGain: 0,
    goldFind: 0,
    startShield: 0,
    statusDuration: 0,
    onHit: [],
    vsStatus: [],
    vsFront: 0,
    vsBack: 0,
    cdMods: {},
    weapon: UNARMED,
    legendaries: new Set(),
    canCrit: true,
  };

  let gearHp = 0;
  let maxHpPct = 0;
  let armorPct = 0;

  for (const it of items) {
    if (it.legendary) d.legendaries.add(it.legendary);
    gearHp += it.base.maxHp ?? 0;
    d.armor += it.base.armor ?? 0;
    d.dodge += it.base.dodge ?? 0;
    d.statusRes += it.base.statusRes ?? 0;
    d.critChance += it.base.critChance ?? 0;
    for (const a of it.affixes) {
      switch (a.id) {
        case 'damagePct': d.damagePct += a.value; break;
        case 'critChance': d.critChance += a.value; break;
        case 'critDamage': d.critMult += a.value / 100; break;
        case 'damageVsStatus': d.vsStatus.push({ status: a.param!, pct: a.value }); break;
        case 'damageVsFront': d.vsFront += a.value; break;
        case 'damageVsBack': d.vsBack += a.value; break;
        case 'lifesteal': d.lifesteal += a.value; break;
        case 'onHitStatus': d.onHit.push({ status: a.param as StatusId, chance: a.value }); break;
        case 'maxHp': gearHp += a.value; break;
        case 'armor': d.armor += a.value; break;
        case 'dodge': d.dodge += a.value; break;
        case 'statusRes': d.statusRes += a.value; break;
        case 'thorns': d.thorns += a.value; break;
        case 'healingReceived': d.healingReceived += a.value; break;
        case 'stat': stats[a.param as Stat] += a.value; break;
        case 'abilityCooldown': d.cdMods[a.param!] = (d.cdMods[a.param!] ?? 0) - a.value; break;
        case 'meterGain': d.meterGain += a.value; break;
        case 'statusDuration': d.statusDuration += a.value; break;
        case 'goldFind': d.goldFind += a.value; break;
        case 'startShield': d.startShield += a.value; break;
      }
    }
  }

  for (const t of hero.talents) {
    const m = TALENTS[t]?.mods;
    if (!m) continue;
    d.damagePct += m.damagePct ?? 0;
    d.critChance += m.critChance ?? 0;
    d.critMult += (m.critDamage ?? 0) / 100;
    d.dodge += m.dodge ?? 0;
    d.statusRes += m.statusRes ?? 0;
    maxHpPct += m.maxHpPct ?? 0;
    armorPct += m.armorPct ?? 0;
    d.meterGain += m.meterGain ?? 0;
    d.goldFind += m.goldFind ?? 0;
    d.healingReceived += m.healingReceived ?? 0;
    d.healPower += m.healPower ?? 0;
  }
  if (hasTalent(hero, 't_deepFreeze')) d.cdMods.frostBind = (d.cdMods.frostBind ?? 0) - 1;

  // In-fight buffs.
  if (hc?.elixir) stats[cls.mainStat] += hc.elixir;

  // Weapon.
  const w = hero.equipment.weapon;
  if (w) {
    const base = WEAPONS[w.baseId];
    d.weapon = { name: w.name, stat: base.stat, melee: base.melee, damage: w.base.damage ?? [2, 3] };
  }

  // Core formulas.
  const lvl = hero.level - 1;
  d.maxHp = cls.baseHp + 5 * stats.might + lvl * (cls.hpPerLevel + Math.floor(stats.might / 2)) + gearHp;
  d.maxHp = Math.round(d.maxHp * (1 + maxHpPct / 100));
  d.armor = Math.round(d.armor * (1 + armorPct / 100));
  d.dodge += 3 + 2 * stats.agility;
  d.critChance += 5 + 1.5 * stats.agility;
  d.statusRes += 3 * stats.spirit;

  // Curses (high Spirit weakens them).
  const cs = curseStrength(stats.spirit);
  for (const c of hero.curses) {
    if (c === 'frail') d.maxHp = Math.round(d.maxHp * (1 - 0.15 * cs));
    if (c === 'clumsy') d.dodge -= 10 * cs;
    if (c === 'weary') d.healingReceived -= 25 * cs;
    if (c === 'jinxed') d.canCrit = false;
    if (c === 'sluggish') for (const a of hero.abilities) d.cdMods[a] = (d.cdMods[a] ?? 0) + 1;
  }

  d.dodge = clamp(Math.round(d.dodge), 0, 60);
  d.critChance = d.canCrit ? clamp(Math.round(d.critChance), 0, 75) : 0;
  d.statusRes = clamp(Math.round(d.statusRes), 0, 75);
  return d;
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function abilityCooldown(id: string, d: Derived): number {
  return Math.max(1, ABILITIES[id].cooldown + (d.cdMods[id] ?? 0));
}

// ---------- Creation ----------

export interface HeroDraft {
  name: string;
  race: RaceId;
  cls: ClassId;
  background: BackgroundId;
  humanStat?: Stat;
  look?: string;
}

export function createHero(rng: Rng, id: HeroId, draft: HeroDraft, uid: () => string): Hero {
  const cls = CLASSES[draft.cls];
  const stats = { ...cls.baseStats };
  const race = RACES[draft.race];
  const bonus = race.bonus === 'any' ? (draft.humanStat ?? cls.mainStat) : race.bonus;
  stats[bonus] += 1;

  const hero: Hero = {
    id,
    name: draft.name.trim() || (id === 'p1' ? 'Player 1' : 'Player 2'),
    race: draft.race,
    cls: draft.cls,
    background: draft.background,
    look: draft.look,
    level: 1,
    xp: 0,
    stats,
    hp: 1,
    dead: false,
    abilities: [...cls.startAbilities],
    talents: [],
    equipment: {},
    belt: [null, null, null],
    curses: [],
    pendingLevelUps: 0,
    statPoints: 0,
  };

  hero.equipment.weapon = generateItem(rng, uid(), { power: 1, rarity: 'common', slot: 'weapon', baseId: cls.startWeapon });
  hero.equipment.chest = generateItem(rng, uid(), { power: 1, rarity: 'common', slot: 'chest', weight: cls.startArmorWeight });
  if (draft.background === 'soldier') {
    hero.equipment.legs = generateItem(rng, uid(), { power: 1, rarity: 'common', slot: 'legs', weight: cls.startArmorWeight });
  }

  hero.belt[0] = { id: 'potion', qty: draft.cls === 'fighter' ? 2 : 1 };
  if (draft.cls === 'rogue') hero.belt[1] = { id: 'smokeBomb', qty: 1 };

  hero.hp = derive(hero).maxHp;
  return hero;
}

export function randomDraft(rng: Rng, takenNames: string[] = []): HeroDraft {
  const names = ['Aldric', 'Brienne', 'Corvin', 'Dara', 'Elowen', 'Fenwick', 'Garrick', 'Hesper', 'Isolde', 'Jory', 'Kael', 'Liora', 'Maren', 'Nyx', 'Oswin', 'Perrin', 'Quill', 'Rowan', 'Sable', 'Tamsin'];
  return {
    name: rng.pick(names.filter((n) => !takenNames.includes(n))),
    race: rng.pick(Object.keys(RACES) as RaceId[]),
    cls: rng.pick(Object.keys(CLASSES) as ClassId[]),
    background: rng.pick(['soldier', 'scholar', 'criminal', 'merchant', 'acolyte', 'outlander'] as BackgroundId[]),
    humanStat: rng.pick(STATS),
  };
}

// ---------- Leveling ----------

/** Adds XP; returns the number of levels gained. HP grows with max HP. */
export function gainXp(hero: Hero, amount: number): number {
  if (hero.dead) return 0;
  hero.xp += Math.round(amount);
  let gained = 0;
  while (hero.xp >= xpToNext(hero.level)) {
    const before = derive(hero).maxHp;
    hero.xp -= xpToNext(hero.level);
    hero.level += 1;
    gained += 1;
    hero.pendingLevelUps += 1;
    if (hero.level % STAT_POINT_EVERY === 0) hero.statPoints += 1;
    hero.hp += derive(hero).maxHp - before;
  }
  return gained;
}

export function talentPool(hero: Hero): string[] {
  return Object.values(TALENTS)
    .filter((t) => !t.cls || t.cls === hero.cls)
    .filter((t) => t.stackable || !hero.talents.includes(t.id))
    .filter((t) => !t.ability || (hero.abilities.length < MAX_ABILITIES && !hero.abilities.includes(t.ability)))
    .map((t) => t.id);
}

export function rollTalentOffer(rng: Rng, hero: Hero): string[] {
  const pool = talentPool(hero);
  // Class talents are twice as likely as general ones.
  const weighted = pool.flatMap((id) => (TALENTS[id].cls ? [id, id] : [id]));
  const offer: string[] = [];
  while (offer.length < 3 && offer.length < pool.length) {
    const pick = rng.pick(weighted);
    if (!offer.includes(pick)) offer.push(pick);
  }
  return offer;
}

export function chooseTalent(hero: Hero, talentId: string) {
  const t = TALENTS[talentId];
  const before = derive(hero).maxHp;
  hero.talents.push(talentId);
  if (t.ability && !hero.abilities.includes(t.ability)) hero.abilities.push(t.ability);
  hero.pendingLevelUps = Math.max(0, hero.pendingLevelUps - 1);
  hero.talentOffer = undefined;
  hero.humanRerollUsed = false;
  const after = derive(hero).maxHp;
  if (!hero.dead) hero.hp = clamp(hero.hp + (after - before), 1, after);
}

export function spendStatPoint(hero: Hero, stat: Stat) {
  if (hero.statPoints <= 0) return;
  const before = derive(hero).maxHp;
  hero.stats[stat] += 1;
  hero.statPoints -= 1;
  const after = derive(hero).maxHp;
  if (!hero.dead) hero.hp = clamp(hero.hp + (after - before), 1, after);
}

export function equipSlotFor(hero: Hero, item: Item): EquipSlot {
  if (item.slot !== 'trinket') return item.slot;
  if (!hero.equipment.trinket1) return 'trinket1';
  if (!hero.equipment.trinket2) return 'trinket2';
  return 'trinket1';
}

/** Keeps current HP within the new max after gear changes (HP doesn't refill). */
export function fixHp(hero: Hero) {
  if (hero.dead) return;
  hero.hp = clamp(hero.hp, 1, derive(hero).maxHp);
}

// ---------- Item comparison ----------

export interface StatDelta {
  key: string;
  label: string;
  before: number;
  after: number;
  /** Higher is better (false for none so far, kept for clarity). */
  unit: '' | '%';
}

/** Typical damage of a basic attack, before enemy Armor. */
export function attackPower(hero: Hero, d: Derived): number {
  const avg = (d.weapon.damage[0] + d.weapon.damage[1]) / 2 + 1.2 * d.stats[d.weapon.stat] + 0.8 * (hero.level - 1);
  return avg * (1 + d.damagePct / 100);
}

/** Equips the item on a copy of the hero and returns how the real stats change. */
export function compareEquip(hero: Hero, item: Item, slot: EquipSlot): { deltas: StatDelta[]; current?: Item } {
  const before = derive(hero);
  const copy: Hero = { ...hero, equipment: { ...hero.equipment, [slot]: item } };
  const after = derive(copy);
  const rows: [string, string, number, number, '' | '%'][] = [
    ['attack', 'Attack damage', attackPower(hero, before), attackPower(copy, after), ''],
    ['maxHp', 'Max HP', before.maxHp, after.maxHp, ''],
    ['armor', 'Armor', before.armor, after.armor, ''],
    ['dodge', 'Dodge', before.dodge, after.dodge, '%'],
    ['crit', 'Crit chance', before.critChance, after.critChance, '%'],
    ['critMult', 'Crit damage', Math.round(before.critMult * 100), Math.round(after.critMult * 100), '%'],
    ['statusRes', 'Status resistance', before.statusRes, after.statusRes, '%'],
    ['might', 'Might', before.stats.might, after.stats.might, ''],
    ['agility', 'Agility', before.stats.agility, after.stats.agility, ''],
    ['mind', 'Mind', before.stats.mind, after.stats.mind, ''],
    ['spirit', 'Spirit', before.stats.spirit, after.stats.spirit, ''],
    ['lifesteal', 'Lifesteal', before.lifesteal, after.lifesteal, '%'],
    ['thorns', 'Thorns', before.thorns, after.thorns, ''],
    ['healingReceived', 'Healing received', before.healingReceived, after.healingReceived, '%'],
    ['meterGain', 'Team meter gain', before.meterGain, after.meterGain, '%'],
    ['goldFind', 'Gold found', before.goldFind, after.goldFind, '%'],
    ['startShield', 'Start shield', before.startShield, after.startShield, ''],
  ];
  const deltas = rows
    .map(([key, label, b, a, unit]) => ({ key, label, before: Math.round(b * 10) / 10, after: Math.round(a * 10) / 10, unit }))
    .filter((r) => Math.abs(r.after - r.before) >= 0.1);
  return { deltas, current: hero.equipment[slot] };
}
