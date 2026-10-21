import type {
  CombatKind,
  CombatState,
  Enemy,
  EnemyRole,
  Hero,
  HeroCombat,
  HeroId,
  Intent,
  Run,
  StatusId,
  StatusInstance,
} from './types';
import { ABILITIES, CLASSES } from './data/characters';
import { STATUSES, STATUS_TURNS } from './data/statuses';
import { CONSUMABLES } from './data/items';
import {
  BOSS_MOVES,
  ELITE_MODS,
  ELITE_MOD_IDS,
  REGIONS,
  ROLE_BASE,
  ROLE_MOVES,
  enemyScale,
  type MoveDef,
} from './data/enemies';
import { abilityCooldown, clamp, derive, hasTalent, type Derived } from './character';
import { hero as getHero, livingHeroes, log, other, rng, uid } from './util';
import { checkBonus, prob2d10AtLeast } from './checks';

export const METER_MAX = 100;

// ====================================================================
// Setup
// ====================================================================

function newHeroCombat(): HeroCombat {
  return {
    row: 'front',
    statuses: [],
    cooldowns: {},
    mainUsed: 0,
    mainAllowed: 1,
    minorUsed: false,
    guarding: false,
    vanished: false,
    firstAbilityUsed: false,
    whetstone: 0,
    elixir: 0,
    abilitiesUsed: 0,
    fromVanish: false,
    dodgeBuff: 0,
    swappedThisTurn: false,
  };
}

function makeEnemy(run: Run, regionId: string, role: Exclude<EnemyRole, 'boss'>): Enemy {
  const base = ROLE_BASE[role];
  const sc = enemyScale(run.distance);
  const hp = Math.round(base.hp * sc.hp);
  return {
    uid: uid(run),
    defId: `${regionId}.${role}`,
    name: REGIONS[regionId].family[role],
    role,
    row: base.row,
    hp,
    maxHp: hp,
    damage: Math.round(base.damage * sc.damage * 10) / 10,
    armor: base.armor + sc.armor,
    dodge: base.dodge,
    statuses: [],
  };
}

function makeBoss(run: Run, regionId: string): Enemy {
  const region = REGIONS[regionId];
  const sc = enemyScale(run.distance);
  const hp = Math.round(ROLE_BASE.brute.hp * sc.hp * (3 + 0.5 * run.act));
  return {
    uid: uid(run),
    defId: `${regionId}.boss`,
    name: region.boss.name,
    role: 'boss',
    row: 'front',
    hp,
    maxHp: hp,
    damage: Math.round(ROLE_BASE.brute.damage * sc.damage * 1.1 * 10) / 10,
    armor: ROLE_BASE.brute.armor + sc.armor + 2,
    dodge: 0,
    statuses: [],
    boss: true,
    phase: 1,
    flags: {},
  };
}

function makeElite(run: Run, e: Enemy) {
  const r = rng(run);
  const mod = r.pick(ELITE_MOD_IDS);
  e.elite = mod;
  e.name = `${ELITE_MODS[mod].name} ${e.name}`;
  e.maxHp = e.hp = Math.round(e.hp * 1.7);
  e.damage = Math.round(e.damage * 1.2 * 10) / 10;
  if (mod === 'armored') e.armor = Math.round(e.armor * 1.6 + 4);
  if (mod === 'swift') e.dodge += 15;
  if (mod === 'enraged') e.damage = Math.round(e.damage * 1.25 * 10) / 10;
}

export function startCombat(run: Run, kind: CombatKind, regionId: string): CombatState {
  const r = rng(run);
  const enemies: Enemy[] = [];
  if (kind === 'boss') {
    enemies.push(makeBoss(run, regionId));
    if (run.act >= 2) enemies.push(makeEnemy(run, regionId, 'brute'));
  } else {
    const count = run.act === 1 ? r.int(2, 3) : r.int(3, 4);
    enemies.push(makeEnemy(run, regionId, 'brute'));
    let supports = 0;
    while (enemies.length < count) {
      const role = r.pick(['brute', 'archer', 'caster', 'support'] as const);
      if (role === 'support' && supports++ >= 1) continue;
      enemies.push(makeEnemy(run, regionId, role));
    }
    if (kind === 'elite') makeElite(run, enemies[0]);
  }

  const d = run.distance;
  const xp = Math.round((25 + 6 * d) * (kind === 'elite' ? 2 : kind === 'boss' ? 4 : 1));
  const gold = Math.round((8 + 2 * d) * (kind === 'elite' ? 2 : kind === 'boss' ? 4 : 1));

  const combat: CombatState = {
    kind,
    round: 0,
    phase: 'players',
    enemies,
    heroes: { p1: newHeroCombat(), p2: newHeroCombat() },
    teamMeter: 0,
    fleeAllowed: kind !== 'boss',
    regionId,
    xpReward: xp,
    goldReward: gold,
    floats: [],
    floatSeq: 0,
    enemiesFirst: false,
  };
  run.combat = combat;

  // Rows: the sturdier class goes front by default.
  const [a, b] = run.heroes;
  const frontPref = (h: Hero) => (h.cls === 'fighter' ? 3 : h.cls === 'cleric' ? 2 : h.cls === 'rogue' ? 1 : 0);
  combat.heroes[a.id].row = frontPref(a) >= frontPref(b) ? 'front' : 'back';
  combat.heroes[b.id].row = combat.heroes[a.id].row === 'front' ? 'back' : 'front';

  // Fight-start effects.
  for (const h of livingHeroes(run)) {
    const hc = combat.heroes[h.id];
    const dv = derive(h, hc);
    if (dv.startShield > 0) addStatus(hc.statuses, 'shield', STATUS_TURNS.shield, dv.startShield, h.id);
    if (h.curses.includes('bleedingHeart')) addStatus(hc.statuses, 'bleed', 3, Math.max(1, Math.round(dv.maxHp * 0.03)), 'enemy');
  }

  log(run, kind === 'boss' ? `${enemies[0].name} blocks the road!` : `Enemies ahead: ${enemies.map((e) => e.name).join(', ')}.`, 'info');

  // Initiative for elite and boss fights: 2d10 + best Agility (+3 with an Elf) vs DC.
  if (kind !== 'normal') {
    const best = Math.max(...livingHeroes(run).map((h) => checkBonus(run, h, 'agility')));
    const elf = run.heroes.some((h) => h.race === 'elf') ? 3 : 0;
    const dc = 12 + Math.floor(run.distance / 4);
    const roll = r.int(1, 10) + r.int(1, 10) + best + elf;
    if (roll < dc) {
      combat.enemiesFirst = true;
      log(run, `The enemy strikes first! (initiative ${roll} vs ${dc})`, 'bad');
    } else {
      log(run, `You seize the initiative. (${roll} vs ${dc})`, 'info');
    }
  }

  for (const e of enemies) rollIntent(run, e);
  if (combat.enemiesFirst) {
    enemyPhase(run);
    if (combat.phase === 'won' || combat.phase === 'lost') return combat;
  }
  startPlayerPhase(run);
  return combat;
}

export function initiativeOdds(run: Run): number {
  const best = Math.max(...livingHeroes(run).map((h) => checkBonus(run, h, 'agility')));
  const elf = run.heroes.some((h) => h.race === 'elf') ? 3 : 0;
  return prob2d10AtLeast(12 + Math.floor(run.distance / 4) - best - elf);
}

// ====================================================================
// Statuses
// ====================================================================

export function hasStatus(list: StatusInstance[], id: StatusId) {
  return list.some((s) => s.id === id);
}

function getStatus(list: StatusInstance[], id: StatusId) {
  return list.find((s) => s.id === id);
}

function removeStatus(list: StatusInstance[], id: StatusId) {
  const i = list.findIndex((s) => s.id === id);
  if (i >= 0) list.splice(i, 1);
}

export function addStatus(list: StatusInstance[], id: StatusId, turns: number, value: number, source?: HeroId | 'enemy', stackValue = false) {
  const cur = getStatus(list, id);
  if (cur) {
    cur.turns = Math.max(cur.turns, turns);
    if (id === 'shield' || stackValue) cur.value += value;
    else cur.value = Math.max(cur.value, value);
    cur.source = source ?? cur.source;
  } else {
    list.push({ id, turns, value, source });
  }
}

function harmful(id: StatusId) {
  return STATUSES[id].harmful;
}

export function cleanse(list: StatusInstance[]) {
  for (let i = list.length - 1; i >= 0; i--) if (harmful(list[i].id)) list.splice(i, 1);
}

function hasDebuff(list: StatusInstance[]) {
  return list.some((s) => harmful(s.id));
}

/** Debuff applied by the given hero (combo tracking). */
function debuffFrom(list: StatusInstance[], source: HeroId) {
  return list.some((s) => harmful(s.id) && s.source === source);
}

function tickDurations(list: StatusInstance[]) {
  for (let i = list.length - 1; i >= 0; i--) {
    list[i].turns -= 1;
    if (list[i].turns <= 0 || (list[i].id === 'shield' && list[i].value <= 0)) list.splice(i, 1);
  }
}

// ====================================================================
// Helpers
// ====================================================================

function C(run: Run) {
  return run.combat!;
}

function hc(run: Run, id: HeroId) {
  return C(run).heroes[id];
}

export function liveEnemies(run: Run) {
  return C(run).enemies.filter((e) => !e.dead);
}

function float(run: Run, targetId: string, text: string, kind: 'dmg' | 'heal' | 'crit' | 'miss' | 'status') {
  const c = C(run);
  c.floatSeq += 1;
  c.floats.push({ targetId, text, kind, seq: c.floatSeq });
  if (c.floats.length > 24) c.floats.splice(0, c.floats.length - 24);
}

function gainMeter(run: Run, amount: number, by?: Hero) {
  const c = C(run);
  const mult = by ? 1 + derive(by).meterGain / 100 : 1;
  c.teamMeter = clamp(c.teamMeter + Math.round(amount * mult), 0, METER_MAX);
}

/** Armor reduction. The constant grows with distance so Armor keeps the same value against tougher enemies. */
function armorFactor(armor: number, distance: number) {
  return 1 - armor / (armor + 40 * (1 + 0.12 * distance));
}

function weaponAvg(d: Derived) {
  return (d.weapon.damage[0] + d.weapon.damage[1]) / 2;
}

/** The stat an action scales with: abilities use the class's main stat, basic attacks the weapon's. */
function scalingStat(h: Hero, d: Derived, ability?: string) {
  const stat = ability ? CLASSES[h.cls].mainStat : d.weapon.stat;
  return d.stats[stat];
}

function heroHasLeg(d: Derived, id: string) {
  return d.legendaries.has(id);
}

export function ultimateCost(run: Run) {
  return run.heroes.some((h) => !h.dead && derive(h).legendaries.has('duosSigil')) ? 75 : METER_MAX;
}

// ====================================================================
// Damage: hero -> enemy
// ====================================================================

interface HitOpts {
  mult: number;
  ability?: string;
  melee: boolean;
  forceCrit?: boolean;
  noDodge?: boolean;
  /** Basic attack (gets row penalties and on-hit class effects). */
  basic?: boolean;
  extraPct?: number;
}

interface HitResult {
  damage: number;
  crit: boolean;
  dodged: boolean;
  killed: boolean;
}

export function heroBaseDamage(run: Run, h: Hero, ability?: string, roll = true): number {
  const d = derive(h, hc(run, h.id));
  const [lo, hi] = d.weapon.damage;
  const dice = roll ? rng(run).int(lo, hi) : (lo + hi) / 2;
  // Levels add a little damage on their own so a party with unlucky drops still keeps up.
  return dice + 1.2 * scalingStat(h, d, ability) + 0.8 * (h.level - 1);
}

function damageMods(run: Run, h: Hero, d: Derived, e: Enemy, o: HitOpts): number {
  const me = hc(run, h.id);
  let pct = d.damagePct + (o.extraPct ?? 0);
  if (hasStatus(me.statuses, 'blessed')) pct += 20;
  if (hasTalent(h, 't_opportunist') && hasDebuff(e.statuses)) pct += 20;
  if (e.row === 'front') pct += d.vsFront;
  else pct += d.vsBack;
  for (const v of d.vsStatus) if (hasStatus(e.statuses, v.status as StatusId)) pct += v.pct;
  if (heroHasLeg(d, 'spentStars')) pct += 5 * me.abilitiesUsed;
  let m = 1 + pct / 100;
  if (hasStatus(me.statuses, 'staggered')) m *= 0.7;
  if (hasStatus(me.statuses, 'weak')) m *= 0.75;
  if (o.basic && o.melee && me.row === 'back') m *= 0.7;
  return m;
}

function hitEnemy(run: Run, h: Hero, e: Enemy, o: HitOpts): HitResult {
  const r = rng(run);
  const me = hc(run, h.id);
  const d = derive(h, me);
  const res: HitResult = { damage: 0, crit: false, dodged: false, killed: false };
  if (e.dead) return res;

  const frozen = hasStatus(e.statuses, 'frozen');
  if (!o.noDodge && !frozen && r.chance(e.dodge / 100)) {
    res.dodged = true;
    float(run, e.uid, 'Miss', 'miss');
    log(run, `${e.name} dodges ${h.name}'s attack.`, 'info');
    return res;
  }

  let dmg = heroBaseDamage(run, h, o.ability) * o.mult;
  if (heroHasLeg(d, 'heartMountain')) dmg += d.armor * 0.5;
  dmg *= damageMods(run, h, d, e, o);

  // Exposed: next hit +50%.
  const exposed = getStatus(e.statuses, 'exposed');
  if (exposed) {
    dmg *= 1.5;
    removeStatus(e.statuses, 'exposed');
  }

  // Crit.
  const critChance = d.canCrit ? d.critChance : 0;
  if (o.forceCrit || r.chance(critChance / 100)) {
    res.crit = true;
    dmg *= d.critMult;
    if (frozen && heroHasLeg(d, 'frostLocket')) dmg *= 2;
    if (heroHasLeg(d, 'crownEchoes')) reduceLongestCooldown(me);
  }

  // Shatter: a melee hit on a Frozen enemy.
  if (frozen && o.melee) {
    const f = getStatus(e.statuses, 'frozen')!;
    const mult = hasTalent(h, 't_deepFreeze') || run.heroes.some((x) => x.id !== h.id && hasTalent(x, 't_deepFreeze') && f.source === x.id) ? 3 : 2;
    dmg *= mult;
    removeStatus(e.statuses, 'frozen');
    log(run, `Shatter! ${e.name} breaks apart (x${mult}).`, 'combo');
    float(run, e.uid, 'SHATTER', 'crit');
    if (f.source && f.source !== h.id && f.source !== 'enemy') comboHappened(run, h, 'Freeze + Shatter');
  }

  dmg *= armorFactor(e.armor, run.distance);
  dmg = Math.max(1, Math.round(dmg));
  dmg = absorbShield(e.statuses, dmg);
  res.damage = dmg;
  e.hp -= dmg;
  float(run, e.uid, `${res.crit ? '💥' : ''}${dmg}`, res.crit ? 'crit' : 'dmg');

  // Lifesteal.
  if (d.lifesteal > 0 && dmg > 0) healHero(run, h, Math.round((dmg * d.lifesteal) / 100), false);

  // Elite thorns.
  if (e.elite === 'thorned' && o.melee) damageHeroRaw(run, h, Math.max(1, Math.round(e.damage * 0.3)), `${e.name}'s thorns`);

  // On-hit statuses.
  if (!res.killed) {
    for (const oh of d.onHit) if (r.chance(oh.chance / 100)) applyToEnemy(run, h, e, oh.status, 1);
    if (o.basic && me.whetstone > 0) {
      me.whetstone -= 1;
      applyToEnemy(run, h, e, 'bleed', 1);
    }
    if (o.basic && h.cls === 'rogue') applyToEnemy(run, h, e, 'exposed', 1);
  }

  gainMeter(run, 6, h);
  if (e.hp <= 0) killEnemy(run, e, h);
  res.killed = !!e.dead;
  if (!res.killed) checkBossPhase(run, e);
  return res;
}

function absorbShield(list: StatusInstance[], dmg: number): number {
  const sh = getStatus(list, 'shield');
  if (!sh) return dmg;
  const absorbed = Math.min(sh.value, dmg);
  sh.value -= absorbed;
  if (sh.value <= 0) removeStatus(list, 'shield');
  return dmg - absorbed;
}

function killEnemy(run: Run, e: Enemy, by?: Hero) {
  e.hp = 0;
  e.dead = true;
  e.statuses = [];
  run.stats.kills += 1;
  log(run, `${e.name} falls${by ? ` to ${by.name}` : ''}.`, 'hero');
  if (by) {
    const d = derive(by, hc(run, by.id));
    if (heroHasLeg(d, 'whisperVeil') && hc(run, by.id).fromVanish) {
      hc(run, by.id).cooldowns.vanish = 0;
      log(run, 'Whisper of the Veil: Vanish is ready again.', 'combo');
    }
  }
}

function dotValue(run: Run, h: Hero, status: StatusId): number {
  const base = heroBaseDamage(run, h, undefined, false);
  const f = status === 'burn' ? 0.5 : status === 'poison' ? 0.35 : 0.3;
  return Math.max(1, Math.round(base * f));
}

function applyToEnemy(run: Run, h: Hero, e: Enemy, status: StatusId, valueMult = 1, turns?: number) {
  if (e.dead) return;
  const d = derive(h, hc(run, h.id));
  if (status === 'frozen' && e.boss && rng(run).chance(0.5)) {
    log(run, `${e.name} shakes off the frost.`, 'info');
    float(run, e.uid, 'Resist', 'status');
    return;
  }
  const value = ['poison', 'burn', 'bleed'].includes(status) ? Math.round(dotValue(run, h, status) * valueMult) : 0;
  const t = (turns ?? STATUS_TURNS[status]) + d.statusDuration;
  const stack = status === 'poison' && heroHasLeg(d, 'vialPlague');
  addStatus(e.statuses, status, t, value, h.id, stack);
  float(run, e.uid, STATUSES[status].icon, 'status');
}

function comboHappened(run: Run, h: Hero, name: string) {
  log(run, `Combo: ${name}!`, 'combo');
  gainMeter(run, 15, h);
}

function reduceLongestCooldown(me: HeroCombat) {
  let best: string | undefined;
  for (const [k, v] of Object.entries(me.cooldowns)) if (v > 0 && (!best || v > me.cooldowns[best])) best = k;
  if (best) me.cooldowns[best] -= 1;
}

// ====================================================================
// Damage and healing: heroes
// ====================================================================

function damageHeroRaw(run: Run, h: Hero, amount: number, from: string) {
  if (h.dead) return;
  const me = hc(run, h.id);
  amount = absorbShield(me.statuses, amount);
  h.hp -= amount;
  if (amount > 0) float(run, h.id, `${amount}`, 'dmg');
  log(run, `${from} hits ${h.name} for ${amount}.`, 'enemy');
  if (h.hp <= 0) killHero(run, h);
}

function killHero(run: Run, h: Hero) {
  h.hp = 0;
  h.dead = true;
  const me = hc(run, h.id);
  me.statuses = [];
  me.guarding = false;
  me.vanished = false;
  log(run, `${h.name} has fallen!`, 'bad');
  float(run, h.id, '💀', 'status');
}

export function healHero(run: Run, h: Hero, amount: number, allowTwin = true, from?: Hero): number {
  if (h.dead || amount <= 0) return 0;
  const d = derive(h, run.combat ? hc(run, h.id) : undefined);
  const healed = Math.max(0, Math.min(d.maxHp - h.hp, Math.round(amount * (1 + d.healingReceived / 100))));
  h.hp += healed;
  if (run.combat && healed > 0) float(run, h.id, `+${healed}`, 'heal');
  if (allowTwin && run.heroes.some((x) => !x.dead && derive(x).legendaries.has('twinHearts'))) {
    const o = getHero(run, other(h.id));
    if (!o.dead) healHero(run, o, Math.round(amount / 2), false, from);
  }
  return healed;
}

function heroStatusResisted(run: Run, h: Hero, status: StatusId): boolean {
  if (status === 'poison' && h.race === 'dwarf') return true;
  const d = derive(h, hc(run, h.id));
  return rng(run).chance(d.statusRes / 100);
}

/** Enemy attack on a hero. Handles Guard, Vanish, dodge, armor, shields, thorns. */
function enemyHitsHero(run: Run, e: Enemy, target: Hero, power: number, status?: StatusId): void {
  const r = rng(run);
  const c = C(run);
  let h = target;
  // Guard: the guarding hero takes the hit.
  const ally = getHero(run, other(h.id));
  const allyGuarding = !ally.dead && c.heroes[ally.id].guarding;
  if (allyGuarding) h = ally;
  const me = hc(run, h.id);
  if (me.vanished) {
    log(run, `${e.name} can't find ${h.name}.`, 'info');
    float(run, h.id, 'Hidden', 'miss');
    return;
  }
  const d = derive(h, me);
  const frozen = hasStatus(me.statuses, 'frozen');
  if (!frozen && r.chance((d.dodge + me.dodgeBuff) / 100)) {
    float(run, h.id, 'Dodge', 'miss');
    log(run, `${h.name} dodges ${e.name}.`, 'hero');
    if (heroHasLeg(d, 'ghoststep')) {
      log(run, `${h.name} counterattacks!`, 'hero');
      hitEnemy(run, h, e, { mult: 0.6, melee: false, noDodge: true });
    }
    return;
  }
  let dmg = e.damage * power;
  if (hasStatus(e.statuses, 'staggered')) dmg *= 0.7;
  if (hasStatus(e.statuses, 'weak')) dmg *= 0.75;
  if (e.boss && (e.phase ?? 1) >= 3) dmg *= 1.3;
  dmg *= armorFactor(d.armor, run.distance);
  if (hasTalent(h, 't_unbreakable') && h.hp < d.maxHp * 0.3) dmg *= 0.75;
  dmg = Math.max(1, Math.round(dmg));
  const afterShield = absorbShield(me.statuses, dmg);
  h.hp -= afterShield;
  float(run, h.id, afterShield > 0 ? `${afterShield}` : 'Blocked', afterShield > 0 ? 'dmg' : 'miss');
  log(run, `${e.name} hits ${h.name}${allyGuarding ? ' (guarding)' : ''} for ${afterShield}.`, 'enemy');
  gainMeter(run, 3);

  // Fighter + Cleric combo: a Blessed guard heals from the hits it takes.
  const blessed = getStatus(me.statuses, 'blessed');
  if (me.guarding && blessed && afterShield > 0 && h.hp > 0) {
    healHero(run, h, Math.round(afterShield * 0.5));
    if (blessed.source && blessed.source !== h.id) comboHappened(run, h, 'Blessed Guard');
  }

  if (e.elite === 'vampiric') e.hp = Math.min(e.maxHp, e.hp + Math.round(afterShield * 0.3));

  // Thorns on the hero hit back.
  if (d.thorns > 0 && !e.dead) {
    e.hp -= d.thorns;
    float(run, e.uid, `${d.thorns}`, 'dmg');
    if (e.hp <= 0) killEnemy(run, e, h);
  }

  if (h.hp <= 0) {
    killHero(run, h);
    return;
  }
  if (status && !heroStatusResisted(run, h, status)) {
    const value = ['poison', 'burn', 'bleed'].includes(status) ? Math.max(1, Math.round(e.damage * (status === 'burn' ? 0.5 : 0.35))) : 0;
    addStatus(me.statuses, status, STATUS_TURNS[status], value, 'enemy');
    float(run, h.id, STATUSES[status].icon, 'status');
  } else if (status) {
    float(run, h.id, 'Resist', 'status');
  }
}

// ====================================================================
// Enemy intents
// ====================================================================

function movesFor(e: Enemy): MoveDef[] {
  if (e.role === 'boss') {
    const region = REGIONS[e.defId.split('.')[0]];
    const sig = { ...region.boss.signature, weight: (e.phase ?? 1) >= 3 ? 3 : 1.5 };
    return [...BOSS_MOVES, sig];
  }
  return ROLE_MOVES[e.role];
}

function regionHazard(run: Run): StatusId {
  return REGIONS[C(run).regionId].hazard;
}

function pickHeroTarget(run: Run, e: Enemy, move: MoveDef): Hero | undefined {
  const r = rng(run);
  const c = C(run);
  const alive = livingHeroes(run).filter((h) => !c.heroes[h.id].vanished);
  if (alive.length === 0) return undefined;
  const marked = alive.find((h) => h.curses.includes('marked'));
  if (marked) return marked;
  if (move.focusWeak) return alive.reduce((a, b) => (a.hp / derive(a).maxHp <= b.hp / derive(b).maxHp ? a : b));
  if (move.melee || e.role === 'brute') {
    const front = alive.filter((h) => c.heroes[h.id].row === 'front');
    if (front.length) return r.pick(front);
  }
  return r.pick(alive);
}

function rollIntent(run: Run, e: Enemy) {
  const r = rng(run);
  const allies = liveEnemies(run).filter((x) => x.uid !== e.uid);
  let moves = movesFor(e);
  const hurt = allies.concat(e).filter((x) => x.hp < x.maxHp * 0.8);
  moves = moves.filter((m) => m.kind !== 'heal' || hurt.length > 0);
  moves = moves.filter((m) => m.kind !== 'shield' || allies.length > 0 || e.role !== 'support');
  const move = r.weighted(moves.map((m) => [m, m.weight] as const));
  const status: StatusId | undefined = move.status === 'region' ? regionHazard(run) : move.status;

  let intent: Intent;
  switch (move.kind) {
    case 'attack':
    case 'freeze': {
      const t = pickHeroTarget(run, e, move);
      intent = {
        moveId: move.id,
        target: t?.id ?? 'p1',
        amount: Math.round(e.damage * move.power),
        label: `${move.name}${status ? ` + ${STATUSES[status].name}` : ''}`,
        icon: move.icon,
      };
      break;
    }
    case 'attackAll':
      intent = { moveId: move.id, target: 'all', amount: Math.round(e.damage * move.power), label: `${move.name} (all)${status ? ` + ${STATUSES[status].name}` : ''}`, icon: move.icon };
      break;
    case 'heal': {
      const t = hurt.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
      intent = { moveId: move.id, target: t.uid, amount: supportAmount(e, move), label: move.name, icon: move.icon };
      break;
    }
    case 'shield': {
      const t = allies.length ? r.pick(allies) : e;
      intent = { moveId: move.id, target: t.uid, amount: supportAmount(e, move), label: move.name, icon: move.icon };
      break;
    }
    case 'summon':
      intent = { moveId: move.id, target: 'self', amount: 0, label: move.name, icon: move.icon };
      break;
    case 'raise':
      intent = { moveId: move.id, target: 'self', amount: 0, label: move.name, icon: move.icon };
      break;
    default:
      intent = { moveId: move.id, target: 'self', amount: 0, label: move.name, icon: move.icon };
  }
  e.intent = intent;
}

/** Heal or shield size: scales with the support enemy's own power. */
function supportAmount(e: Enemy, move: MoveDef) {
  return Math.round(e.damage * move.power * 12);
}

function findMove(e: Enemy, id: string): MoveDef {
  return movesFor(e).find((m) => m.id === id) ?? movesFor(e)[0];
}

function executeIntent(run: Run, e: Enemy) {
  const c = C(run);
  if (!e.intent) return;
  const move = findMove(e, e.intent.moveId);
  const status: StatusId | undefined = move.status === 'region' ? regionHazard(run) : move.status;
  switch (move.kind) {
    case 'attack':
    case 'freeze': {
      let t = run.heroes.find((h) => h.id === e.intent!.target);
      if (!t || t.dead || c.heroes[t.id].vanished) t = pickHeroTarget(run, e, move);
      if (!t) {
        log(run, `${e.name}'s ${move.name} finds no target.`, 'info');
        return;
      }
      log(run, `${e.name} uses ${move.name}.`, 'enemy');
      enemyHitsHero(run, e, t, move.power, status);
      break;
    }
    case 'attackAll':
      log(run, `${e.name} uses ${move.name}!`, 'enemy');
      for (const h of livingHeroes(run)) enemyHitsHero(run, e, h, move.power, status);
      break;
    case 'heal': {
      const t = liveEnemies(run).find((x) => x.uid === e.intent!.target) ?? e;
      const amt = supportAmount(e, move);
      t.hp = Math.min(t.maxHp, t.hp + amt);
      float(run, t.uid, `+${amt}`, 'heal');
      log(run, `${e.name} heals ${t === e ? 'itself' : t.name} for ${amt}.`, 'enemy');
      break;
    }
    case 'shield': {
      const t = liveEnemies(run).find((x) => x.uid === e.intent!.target) ?? e;
      const amt = supportAmount(e, move);
      addStatus(t.statuses, 'shield', 2, amt, 'enemy');
      float(run, t.uid, '🔰', 'status');
      log(run, `${e.name} shields ${t === e ? 'itself' : t.name} (${amt}).`, 'enemy');
      break;
    }
    case 'summon':
      summonAdds(run, e, 1);
      break;
    case 'raise': {
      const fallen = c.enemies.find((x) => x.dead && !x.boss && !x.flags?.raised);
      if (fallen) {
        fallen.dead = false;
        fallen.hp = Math.round(fallen.maxHp * 0.5);
        fallen.flags = { ...(fallen.flags ?? {}), raised: 1 };
        rollIntent(run, fallen);
        log(run, `${e.name} raises ${fallen.name} from the dead!`, 'bad');
      } else {
        summonAdds(run, e, 1);
      }
      break;
    }
  }
}

function summonAdds(run: Run, by: Enemy, n: number) {
  const c = C(run);
  const region = REGIONS[c.regionId];
  for (let i = 0; i < n; i++) {
    if (liveEnemies(run).length >= 5) break;
    const role = rng(run).pick(region.boss.summons);
    const add = makeEnemy(run, c.regionId, role);
    c.enemies.push(add);
    rollIntent(run, add);
    log(run, `${by.name} calls a ${add.name}!`, 'bad');
  }
}

function checkBossPhase(run: Run, e: Enemy) {
  if (!e.boss) return;
  const ratio = e.hp / e.maxHp;
  if ((e.phase ?? 1) === 1 && ratio <= 0.66) {
    e.phase = 2;
    log(run, `${e.name} enters phase 2!`, 'bad');
    summonAdds(run, e, 1 + Math.floor(run.act / 2));
  } else if (e.phase === 2 && ratio <= 0.33) {
    e.phase = 3;
    log(run, `${e.name} is enraged! (phase 3)`, 'bad');
    cleanse(e.statuses);
  }
}

// ====================================================================
// Turn flow
// ====================================================================

function tickDots(run: Run, list: StatusInstance[], onDamage: (n: number, label: string) => void, onHeal: (n: number) => void) {
  for (const s of [...list]) {
    if (s.id === 'poison' || s.id === 'burn' || s.id === 'bleed') onDamage(s.value, STATUSES[s.id].name);
    if (s.id === 'regen') onHeal(s.value);
  }
  void run;
}

function startPlayerPhase(run: Run) {
  const c = C(run);
  c.round += 1;
  c.phase = 'players';
  for (const h of run.heroes) {
    const me = c.heroes[h.id];
    me.mainUsed = 0;
    me.minorUsed = false;
    me.guarding = false;
    me.fromVanish = me.vanished;
    me.vanished = false;
    me.dodgeBuff = 0;
    if (h.dead) continue;
    const d = derive(h, me);
    me.mainAllowed = c.round === 1 && heroHasLeg(d, 'sprinters') ? 2 : 1;

    // Rooted Legguards.
    if (heroHasLeg(d, 'rootedLegguards') && c.round > 1 && !me.swappedThisTurn) addStatus(me.statuses, 'shield', 2, Math.round(d.maxHp * 0.06), h.id);
    me.swappedThisTurn = false;

    // Cooldowns tick (twice below 30% HP with the Helm of the Last Stand).
    const ticks = heroHasLeg(d, 'lastStand') && h.hp < d.maxHp * 0.3 ? 2 : 1;
    for (const k of Object.keys(me.cooldowns)) me.cooldowns[k] = Math.max(0, me.cooldowns[k] - ticks);

    // DoTs and regen.
    tickDots(
      run,
      me.statuses,
      (n, label) => {
        if (h.dead) return;
        h.hp -= n;
        float(run, h.id, `${n}`, 'dmg');
        log(run, `${h.name} takes ${n} from ${label}.`, 'enemy');
        if (h.hp <= 0) killHero(run, h);
      },
      (n) => healHero(run, h, n, false),
    );
    if (h.dead) continue;

    // Frozen heroes skip their turn.
    if (hasStatus(me.statuses, 'frozen')) {
      removeStatus(me.statuses, 'frozen');
      me.mainAllowed = 0;
      me.minorUsed = true;
      log(run, `${h.name} is frozen solid and loses the turn.`, 'bad');
    }
  }
  checkEnd(run);
}

function endCheckWin(run: Run): boolean {
  const c = C(run);
  if (liveEnemies(run).length === 0) {
    c.phase = 'won';
    return true;
  }
  return false;
}

function checkEnd(run: Run) {
  const c = C(run);
  if (c.phase === 'won' || c.phase === 'lost' || c.phase === 'fled') return;
  if (endCheckWin(run)) return;
  if (livingHeroes(run).length === 0) c.phase = 'lost';
}

function enemyPhase(run: Run) {
  const c = C(run);
  c.phase = 'enemies';
  for (const e of [...c.enemies]) {
    if (e.dead) continue;
    // DoTs.
    tickDots(
      run,
      e.statuses,
      (n, label) => {
        if (e.dead) return;
        e.hp -= n;
        float(run, e.uid, `${n}`, 'dmg');
        log(run, `${e.name} takes ${n} from ${label}.`, 'hero');
        if (e.hp <= 0) killEnemy(run, e);
        else checkBossPhase(run, e);
      },
      (n) => {
        e.hp = Math.min(e.maxHp, e.hp + n);
      },
    );
    if (e.dead) continue;
    if (e.elite === 'regenerating') e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.06));
    if (hasStatus(e.statuses, 'frozen')) {
      removeStatus(e.statuses, 'frozen');
      log(run, `${e.name} is frozen and skips its turn.`, 'hero');
      continue;
    }
    executeIntent(run, e);
    if (livingHeroes(run).length === 0) break;
  }
  for (const e of c.enemies) if (!e.dead) tickDurations(e.statuses);
  checkEnd(run);
  if (c.phase !== 'enemies') return;
  for (const e of liveEnemies(run)) rollIntent(run, e);
}

/** Ends the heroes' turn: enemies act, then a new round starts. */
export function endPlayerTurn(run: Run) {
  const c = C(run);
  if (c.phase !== 'players') return;
  for (const h of run.heroes) if (!h.dead) tickDurations(c.heroes[h.id].statuses);
  enemyPhase(run);
  if ((c.phase as string) === 'enemies') startPlayerPhase(run);
}

// ====================================================================
// Hero actions
// ====================================================================

export interface ActionCheck {
  ok: boolean;
  reason?: string;
}

export function canMain(run: Run, id: HeroId): ActionCheck {
  const c = run.combat;
  if (!c || c.phase !== 'players') return { ok: false, reason: 'Not your turn' };
  const h = getHero(run, id);
  if (h.dead) return { ok: false, reason: 'Fallen' };
  const me = c.heroes[id];
  if (me.mainUsed >= me.mainAllowed) return { ok: false, reason: 'Main action used' };
  return { ok: true };
}

export function canMinor(run: Run, id: HeroId): ActionCheck {
  const c = run.combat;
  if (!c || c.phase !== 'players') return { ok: false, reason: 'Not your turn' };
  if (getHero(run, id).dead) return { ok: false, reason: 'Fallen' };
  if (c.heroes[id].minorUsed) return { ok: false, reason: 'Minor action used' };
  return { ok: true };
}

/** Enemies a hero may target with a single-target action. Melee only reaches the front row while it stands. */
export function validEnemyTargets(run: Run, _id: HeroId, melee: boolean): Enemy[] {
  const live = liveEnemies(run);
  if (!melee) return live;
  const front = live.filter((e) => e.row === 'front');
  return front.length ? front : live;
}

export function isMeleeAction(run: Run, id: HeroId, abilityId?: string): boolean {
  const h = getHero(run, id);
  if (abilityId) {
    const a = ABILITIES[abilityId];
    if (abilityId === 'backstab') return false; // reaches the back row
    return !!a.melee && derive(h).weapon.melee;
  }
  return derive(h).weapon.melee;
}

function useMain(run: Run, id: HeroId) {
  C(run).heroes[id].mainUsed += 1;
}

function afterAction(run: Run) {
  checkEnd(run);
}

export function heroAttack(run: Run, id: HeroId, targetUid: string): boolean {
  if (!canMain(run, id).ok) return false;
  const h = getHero(run, id);
  const melee = isMeleeAction(run, id);
  const target = validEnemyTargets(run, id, melee).find((e) => e.uid === targetUid);
  if (!target) return false;
  useMain(run, id);
  log(run, `${h.name} attacks ${target.name}.`, 'hero');
  hitEnemy(run, h, target, { mult: 1, melee, basic: true });
  afterAction(run);
  return true;
}

export function abilityReady(run: Run, id: HeroId, abilityId: string): ActionCheck {
  const m = canMain(run, id);
  if (!m.ok) return m;
  const cd = C(run).heroes[id].cooldowns[abilityId] ?? 0;
  if (cd > 0) return { ok: false, reason: `Ready in ${cd}` };
  return { ok: true };
}

function putOnCooldown(run: Run, h: Hero, abilityId: string) {
  const me = hc(run, h.id);
  const d = derive(h, me);
  let cd = abilityCooldown(abilityId, d);
  const first = !me.firstAbilityUsed;
  me.firstAbilityUsed = true;
  me.abilitiesUsed += 1;
  const ally = getHero(run, other(h.id));
  if (first && ally.cls === h.cls) {
    log(run, `Twin ${CLASSES[h.cls].name}s: ${ABILITIES[abilityId].name} doesn't go on cooldown.`, 'combo');
    return;
  }
  if (first && h.race === 'gnome') cd = Math.max(0, cd - 1);
  if (hasTalent(h, 't_spellEcho') && rng(run).chance(0.2)) {
    log(run, 'Spell Echo: no cooldown!', 'combo');
    return;
  }
  // Cooldowns tick at the start of each turn: a cooldown of N means usable every N turns.
  me.cooldowns[abilityId] = cd;
}

export function heroAbility(run: Run, id: HeroId, abilityId: string, target?: string): boolean {
  if (!abilityReady(run, id, abilityId).ok) return false;
  const h = getHero(run, id);
  if (!h.abilities.includes(abilityId)) return false;
  const me = hc(run, id);
  const d = derive(h, me);
  const a = ABILITIES[abilityId];
  const ally = getHero(run, other(id));
  const r = rng(run);
  const melee = isMeleeAction(run, id, abilityId);

  // Validate targets first.
  let enemy: Enemy | undefined;
  let heroTarget: Hero | undefined;
  if (a.target === 'enemy') {
    enemy = validEnemyTargets(run, id, melee).find((e) => e.uid === target);
    if (!enemy) return false;
  }
  if (a.target === 'anyHero') {
    heroTarget = run.heroes.find((x) => x.id === target && !x.dead);
    if (!heroTarget) return false;
  }

  useMain(run, id);
  log(run, `${h.name} uses ${a.name}${enemy ? ` on ${enemy.name}` : heroTarget ? ` on ${heroTarget.name}` : ''}.`, 'hero');

  switch (abilityId) {
    case 'guard': {
      me.guarding = true;
      if (hasTalent(h, 't_sentinel')) addStatus(me.statuses, 'shield', 2, Math.round(d.maxHp * 0.15), id);
      break;
    }
    case 'cleave': {
      let targets: Enemy[];
      if (heroHasLeg(d, 'worldsplitter')) {
        targets = liveEnemies(run).filter((e) => e.row === 'front');
        if (!targets.includes(enemy!)) targets.unshift(enemy!);
      } else {
        const n = hasTalent(h, 't_wideCleave') ? 3 : 2;
        const rest = liveEnemies(run).filter((e) => e.uid !== enemy!.uid);
        rest.sort((x, y) => (x.row === enemy!.row ? -1 : 0) - (y.row === enemy!.row ? -1 : 0));
        targets = [enemy!, ...rest.slice(0, n - 1)];
      }
      for (const t of targets) {
        const res = hitEnemy(run, h, t, { mult: 0.8, melee: true, ability: abilityId });
        if (!res.dodged && !t.dead) applyToEnemy(run, h, t, 'staggered');
      }
      break;
    }
    case 'shieldBash': {
      const res = hitEnemy(run, h, enemy!, { mult: 1.1, melee, ability: abilityId });
      if (!res.dodged && !enemy!.dead) {
        applyToEnemy(run, h, enemy!, 'staggered', 1, 2);
        applyToEnemy(run, h, enemy!, 'weak');
      }
      break;
    }
    case 'secondWind': {
      healHero(run, h, Math.round(d.maxHp * 0.3));
      addStatus(me.statuses, 'shield', 2, Math.round(d.maxHp * 0.15), id);
      break;
    }
    case 'backstab': {
      let mult = 2.0;
      if (hasDebuff(enemy!.statuses)) mult += 0.5;
      if (debuffFrom(enemy!.statuses, ally.id)) {
        mult += 0.25;
        comboHappened(run, h, hasStatus(enemy!.statuses, 'staggered') ? 'Stagger + Backstab' : 'Setup + Backstab');
      }
      if (me.fromVanish && heroHasLeg(d, 'whisperVeil')) mult *= 1.5;
      hitEnemy(run, h, enemy!, { mult, melee: d.weapon.melee, ability: abilityId });
      break;
    }
    case 'vanish': {
      me.vanished = true;
      const blessed = getStatus(me.statuses, 'blessed');
      if (blessed && !ally.dead) {
        cleanse(hc(run, ally.id).statuses);
        if (blessed.source === ally.id) comboHappened(run, h, 'Blessed Vanish cleanses the ally');
        else log(run, `${ally.name} is cleansed.`, 'hero');
      }
      break;
    }
    case 'poisonBlade': {
      const res = hitEnemy(run, h, enemy!, { mult: 1.0, melee, ability: abilityId });
      if (!res.dodged && !enemy!.dead) applyToEnemy(run, h, enemy!, 'poison', 1.8, 4);
      break;
    }
    case 'fanOfKnives': {
      for (const t of liveEnemies(run)) {
        const res = hitEnemy(run, h, t, { mult: 0.55, melee: false, ability: abilityId });
        if (!res.dodged && !t.dead) applyToEnemy(run, h, t, 'bleed');
      }
      break;
    }
    case 'fireball': {
      const targets = liveEnemies(run);
      for (const t of targets) {
        const exposed = getStatus(t.statuses, 'exposed');
        if (exposed && exposed.source && exposed.source !== id) comboHappened(run, h, 'Exposed + Fireball crit');
        const res = hitEnemy(run, h, t, { mult: 0.75, melee: false, ability: abilityId, forceCrit: !!exposed });
        if (!res.dodged && !t.dead && hasTalent(h, 't_pyromancer')) applyToEnemy(run, h, t, 'burn');
      }
      if (heroHasLeg(d, 'longWinter')) {
        const live = liveEnemies(run);
        if (live.length) applyToEnemy(run, h, live.reduce((x, y) => (x.hp >= y.hp ? x : y)), 'frozen');
      }
      break;
    }
    case 'frostBind': {
      const res = hitEnemy(run, h, enemy!, { mult: 0.5, melee: false, ability: abilityId, noDodge: true });
      if (!enemy!.dead) applyToEnemy(run, h, enemy!, 'frozen');
      void res;
      break;
    }
    case 'chainLightning': {
      const others = r.sample(liveEnemies(run).filter((e) => e.uid !== enemy!.uid), 2);
      for (const t of [enemy!, ...others]) hitEnemy(run, h, t, { mult: 0.8, melee: false, ability: abilityId });
      break;
    }
    case 'arcaneShield': {
      const amt = Math.round(8 + 3 * d.stats.mind + weaponAvg(d) * 1.5);
      for (const x of livingHeroes(run)) addStatus(hc(run, x.id).statuses, 'shield', 2, amt, id);
      break;
    }
    case 'heal': {
      const amt = Math.round((weaponAvg(d) + 2.5 * d.stats.spirit) * 1.5 * (1 + d.healPower / 100));
      const healed = healHero(run, heroTarget!, amt, true, h);
      log(run, `${heroTarget!.name} recovers ${healed} HP.`, 'hero');
      if (hasTalent(h, 't_martyr')) addStatus(hc(run, heroTarget!.id).statuses, 'regen', 3, Math.max(1, Math.round(amt * 0.15)), id);
      if (heroHasLeg(d, 'dawnbreaker')) {
        const live = liveEnemies(run);
        if (live.length) {
          const weakest = live.reduce((x, y) => (x.hp <= y.hp ? x : y));
          weakest.hp -= amt;
          float(run, weakest.uid, `${amt}`, 'dmg');
          log(run, `Dawnbreaker sears ${weakest.name} for ${amt}.`, 'hero');
          if (weakest.hp <= 0) killEnemy(run, weakest, h);
        }
      }
      gainMeter(run, 4, h);
      break;
    }
    case 'bless': {
      const turns = 2 + (hasTalent(h, 't_divineFavor') ? 1 : 0) + d.statusDuration;
      addStatus(hc(run, heroTarget!.id).statuses, 'blessed', turns, 0, id);
      float(run, heroTarget!.id, '✨', 'status');
      if (heroTarget!.id !== id && heroTarget!.cls === 'mage') {
        const tc = hc(run, heroTarget!.id).cooldowns;
        for (const k of Object.keys(tc)) tc[k] = Math.max(0, tc[k] - 1);
        comboHappened(run, h, 'Bless the Mage: cooldowns -1');
      }
      break;
    }
    case 'smite': {
      const res = hitEnemy(run, h, enemy!, { mult: 1.3, melee, ability: abilityId });
      if (res.damage > 0) healHero(run, h, Math.round(res.damage / 3), false);
      break;
    }
    case 'sanctuary': {
      for (const x of livingHeroes(run)) {
        const dx = derive(x);
        addStatus(hc(run, x.id).statuses, 'shield', 2, Math.round(dx.maxHp * 0.1 + 2 * d.stats.spirit), id);
        addStatus(hc(run, x.id).statuses, 'regen', 3, Math.round(3 + d.stats.spirit), id);
      }
      break;
    }
    case 'purify': {
      cleanse(hc(run, heroTarget!.id).statuses);
      healHero(run, heroTarget!, Math.round(derive(heroTarget!).maxHp * 0.15), true, h);
      break;
    }
  }

  putOnCooldown(run, h, abilityId);
  afterAction(run);
  return true;
}

export function ultimateReady(run: Run, id: HeroId): ActionCheck {
  const m = canMain(run, id);
  if (!m.ok) return m;
  if (livingHeroes(run).length < 2) return { ok: false, reason: 'Needs both heroes' };
  if (C(run).teamMeter < ultimateCost(run)) return { ok: false, reason: 'Meter not full' };
  return { ok: true };
}

/** Duo ultimate: both heroes strike every enemy, then heal and cleanse. */
export function heroUltimate(run: Run, id: HeroId): boolean {
  if (!ultimateReady(run, id).ok) return false;
  const c = C(run);
  const h = getHero(run, id);
  const ally = getHero(run, other(id));
  useMain(run, id);
  c.teamMeter = 0;
  log(run, `DUO STRIKE! ${h.name} and ${ally.name} unleash everything!`, 'combo');
  for (const t of liveEnemies(run)) {
    hitEnemy(run, h, t, { mult: 1.0, melee: false, noDodge: true });
    if (!t.dead) hitEnemy(run, ally, t, { mult: 1.0, melee: false, noDodge: true });
  }
  c.teamMeter = 0;
  for (const x of livingHeroes(run)) {
    healHero(run, x, Math.round(derive(x).maxHp * 0.2), false);
    cleanse(hc(run, x.id).statuses);
  }
  afterAction(run);
  return true;
}

export function heroSwapRow(run: Run, id: HeroId): boolean {
  const c = C(run);
  if (c.phase !== 'players') return false;
  const h = getHero(run, id);
  if (h.dead) return false;
  const me = hc(run, id);
  const d = derive(h, me);
  const free = hasTalent(h, 't_shadowstep') || heroHasLeg(d, 'wanderers');
  if (!free && me.minorUsed) return false;
  if (!free) me.minorUsed = true;
  me.row = me.row === 'front' ? 'back' : 'front';
  me.swappedThisTurn = true;
  if (hasTalent(h, 't_shadowstep')) me.dodgeBuff = Math.max(me.dodgeBuff, 25);
  else if (heroHasLeg(d, 'wanderers')) me.dodgeBuff = Math.max(me.dodgeBuff, 20);
  log(run, `${h.name} moves to the ${me.row} row.`, 'hero');
  return true;
}

export function lockedBeltSlots(h: Hero): number[] {
  return h.curses.includes('butterfingers') ? [2] : [];
}

export function heroUseConsumable(run: Run, id: HeroId, beltIndex: number): boolean {
  if (!canMinor(run, id).ok) return false;
  const h = getHero(run, id);
  if (lockedBeltSlots(h).includes(beltIndex)) return false;
  const stack = h.belt[beltIndex];
  if (!stack) return false;
  const c = C(run);
  const me = hc(run, id);
  const d = derive(h, me);
  const def = CONSUMABLES[stack.id];
  if (stack.id === 'smokeBomb' && !c.fleeAllowed) return false;
  me.minorUsed = true;
  stack.qty -= 1;
  if (stack.qty <= 0) h.belt[beltIndex] = null;
  log(run, `${h.name} uses ${def.name}.`, 'hero');
  const scale = 1 + 0.12 * run.distance;
  switch (stack.id) {
    case 'potion':
      healHero(run, h, Math.round(d.maxHp * 0.35));
      break;
    case 'greaterPotion':
      healHero(run, h, Math.round(d.maxHp * 0.7));
      break;
    case 'antidote':
      for (const s of ['poison', 'burn', 'bleed', 'weak'] as StatusId[]) removeStatus(me.statuses, s);
      break;
    case 'bomb':
      for (const t of liveEnemies(run)) {
        const dmg = Math.max(1, Math.round(12 * scale * armorFactor(t.armor, run.distance)));
        t.hp -= absorbShield(t.statuses, dmg);
        float(run, t.uid, `${dmg}`, 'dmg');
        if (t.hp <= 0) killEnemy(run, t, h);
        else applyToEnemy(run, h, t, 'burn');
      }
      break;
    case 'smokeBomb':
      c.phase = 'fled';
      log(run, 'The party vanishes in a cloud of smoke.', 'info');
      return true;
    case 'elixir':
      me.elixir += 2;
      break;
    case 'whetstone':
      me.whetstone += 3;
      break;
    case 'wardScroll':
      for (const x of livingHeroes(run)) addStatus(hc(run, x.id).statuses, 'shield', 2, Math.round(10 * scale), id);
      break;
    case 'focusTonic': {
      let best: string | undefined;
      for (const [k, v] of Object.entries(me.cooldowns)) if (v > 0 && (!best || v > me.cooldowns[best])) best = k;
      if (best) me.cooldowns[best] = 0;
      break;
    }
    case 'meterDraught':
      c.teamMeter = clamp(c.teamMeter + 35, 0, METER_MAX);
      break;
  }
  afterAction(run);
  return true;
}

/** Flee cost: 15% of gold (min 5); with too little gold, a random bag item is lost instead. */
export function fleeCost(run: Run): number {
  return Math.max(5, Math.round(run.gold * 0.15));
}

export function flee(run: Run): boolean {
  const c = C(run);
  if (c.phase !== 'players' || !c.fleeAllowed) return false;
  const cost = fleeCost(run);
  if (run.gold >= cost) {
    run.gold -= cost;
    log(run, `The party flees, dropping ${cost} gold.`, 'bad');
  } else {
    const idx = run.bag.map((b, i) => (b?.type === 'item' ? i : -1)).filter((i) => i >= 0);
    if (idx.length) {
      const i = rng(run).pick(idx);
      const lost = run.bag[i];
      run.bag[i] = null;
      log(run, `The party flees, abandoning ${lost?.type === 'item' ? lost.item.name : 'gear'}.`, 'bad');
    } else {
      run.gold = 0;
      log(run, 'The party flees with empty pockets.', 'bad');
    }
  }
  c.phase = 'fled';
  return true;
}

// ====================================================================
// Previews (odds shown before acting)
// ====================================================================

export interface AttackPreview {
  hitChance: number;
  critChance: number;
  min: number;
  max: number;
  notes: string[];
}

export function attackPreview(run: Run, id: HeroId, targetUid: string, abilityId?: string): AttackPreview {
  const h = getHero(run, id);
  const me = hc(run, id);
  const d = derive(h, me);
  const e = C(run).enemies.find((x) => x.uid === targetUid)!;
  const mults: Record<string, number> = { cleave: 0.8, shieldBash: 1.1, backstab: 2.0, poisonBlade: 1, fanOfKnives: 0.55, fireball: 0.75, frostBind: 0.5, chainLightning: 0.8, smite: 1.3 };
  let mult = abilityId ? (mults[abilityId] ?? 1) : 1;
  const notes: string[] = [];
  if (abilityId === 'backstab' && hasDebuff(e.statuses)) mult += 0.5;
  const melee = isMeleeAction(run, id, abilityId);
  let m = mult * damageMods(run, h, d, e, { mult, melee, basic: !abilityId, ability: abilityId }) * armorFactor(e.armor, run.distance);
  if (hasStatus(e.statuses, 'exposed')) {
    m *= 1.5;
    notes.push('Exposed +50%');
  }
  if (hasStatus(e.statuses, 'frozen') && melee) {
    m *= 2;
    notes.push('Shatter x2');
  }
  const stat = scalingStat(h, d, abilityId);
  const extra = heroHasLeg(d, 'heartMountain') ? d.armor * 0.5 : 0;
  const lvl = 0.8 * (h.level - 1);
  const lo = Math.max(1, Math.round((d.weapon.damage[0] + 1.2 * stat + lvl + extra) * m));
  const hi = Math.max(1, Math.round((d.weapon.damage[1] + 1.2 * stat + lvl + extra) * m));
  const frozen = hasStatus(e.statuses, 'frozen');
  const noDodge = frozen || abilityId === 'frostBind';
  const forceCrit = abilityId === 'fireball' && hasStatus(e.statuses, 'exposed');
  if (!abilityId && melee && me.row === 'back') notes.push('Back row melee -30%');
  return {
    hitChance: noDodge ? 1 : 1 - e.dodge / 100,
    critChance: forceCrit ? 1 : d.critChance / 100,
    min: lo,
    max: hi,
    notes,
  };
}
