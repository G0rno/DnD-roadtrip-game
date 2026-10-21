import type {
  BagEntry,
  ConsumableId,
  ConsumableStack,
  CurseId,
  EquipSlot,
  AiEventDraft,
  Difficulty,
  EventState,
  SceneState,
  Hero,
  HeroId,
  Item,
  NodeType,
  PathNode,
  Rarity,
  Run,
  Stat,
} from './types';
import { RARITIES } from './types';
import { Rng, newSeed } from './rng';
import { hero as getHero, livingHeroes, log, rng, uid } from './util';
import {
  chooseTalent,
  createHero,
  derive,
  equipSlotFor,
  fixHp,
  gainXp,
  rollTalentOffer,
  spendStatPoint,
  type HeroDraft,
} from './character';
import { xpToNext } from './data/characters';
import { REGIONS, REGION_IDS } from './data/enemies';
import { BAG_SIZE, BELT_SIZE, CONSUMABLES, CONSUMABLE_IDS, STACK_MAX } from './data/items';
import { CURSES, CURSE_IDS } from './data/statuses';
import { EVENTS } from './data/events';
import {
  canUpgrade,
  forgeRerollCost,
  forgeUpgradeCost,
  generateItem,
  itemValue,
  rerollAffix,
  salvageValue,
  sellValue,
  upgradeItem,
} from './items';
import { startCombat } from './combat';
import { baseDc, dcFor, rollCheck } from './checks';
import {
  addJournal,
  chooseEventType,
  EVENT_TYPES,
  initStory,
  nodeKey,
  offlineEvent,
  rewardFor,
  story,
} from './story';

export const RUN_VERSION = 1;
export const NODES_PER_ACT = 10;
export const ACTS = 4;

// ====================================================================
// Run creation
// ====================================================================

export function pickRegions(r: Rng): string[] {
  const chosen: string[] = [];
  for (let act = 1; act <= ACTS; act++) {
    const options = REGION_IDS.filter((id) => REGIONS[id].acts.includes(act) && !chosen.includes(id));
    chosen.push(r.pick(options));
  }
  return chosen;
}

export function newRun(slot: number, seed = newSeed(), narrate = false): Run {
  const run: Run = {
    version: RUN_VERSION,
    slot,
    seed,
    rngState: seed,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    screen: 'create',
    heroes: [],
    gold: 0,
    essence: 0,
    bag: Array(BAG_SIZE).fill(null),
    distance: 0,
    act: 1,
    actNode: 0,
    regions: [],
    isNight: false,
    rerollTokens: 2,
    reviveCount: 0,
    wipesThisAct: 0,
    choices: [],
    pendingLoot: [],
    pendingConsumables: [],
    pendingGold: 0,
    pendingXp: 0,
    log: [],
    stats: { fights: 0, kills: 0, bossesKilled: 0, wipes: 0, revives: 0, startedAt: Date.now() },
    snapshots: {},
    uidCounter: 0,
  };
  run.regions = pickRegions(rng(run));
  if (narrate) {
    run.narrate = true;
    run.story = initStory();
  }
  return run;
}

export function finishCreation(run: Run, drafts: [HeroDraft, HeroDraft]) {
  const r = rng(run);
  const ids: HeroId[] = ['p1', 'p2'];
  run.heroes = drafts.map((d, i) => createHero(r, ids[i], d, () => uid(run)));
  run.gold = 30 + 50 * run.heroes.filter((h) => h.background === 'merchant').length;
  log(run, `${run.heroes[0].name} and ${run.heroes[1].name} set out on the road.`, 'info');
  log(run, `Act 1: ${regionName(run)}.`, 'info');
  run.choices = genChoices(run);
  run.screen = 'hub';
  if (run.narrate) openScene(run, { kind: 'runStart', status: 'pending', title: '', text: '', next: 'hub' });
  takeActSnapshot(run);
}

// ====================================================================
// Scenes (narration between steps)
// ====================================================================

export function openScene(run: Run, scene: SceneState) {
  run.scene = scene;
  run.screen = 'scene';
}

/** Fills the current scene with narration (from the AI, the buffer or a template). */
export function setSceneText(run: Run, title: string, text: string, summary?: string) {
  if (!run.scene) return;
  run.scene.title = title;
  run.scene.text = text;
  run.scene.summary = summary;
  run.scene.status = 'ready';
}

export function continueScene(run: Run) {
  const sc = run.scene;
  if (!sc || sc.status !== 'ready') return;
  const kinds = { node: 'scene', bossIntro: 'boss', runStart: 'intro', actIntro: 'act', ending: 'ending' } as const;
  addJournal(run, kinds[sc.kind], sc.title, sc.text, sc.summary);
  if (sc.key) delete story(run).buffer[sc.key];
  run.scene = undefined;
  if (sc.next === 'enterNode') enterNode(run);
  else if (sc.next === 'victory') run.screen = 'victory';
  else run.screen = 'hub';
}

export function regionId(run: Run): string {
  return run.regions[Math.min(run.act, ACTS) - 1];
}

export function regionName(run: Run): string {
  return REGIONS[regionId(run)].name;
}

// ====================================================================
// Snapshots
// ====================================================================

function serialize(run: Run): string {
  return JSON.stringify({ ...run, snapshots: {} });
}

export function takeActSnapshot(run: Run) {
  run.snapshots.actStart = serialize(run);
}

// ====================================================================
// Path (temporary stand-in for the Phase 3 map)
// ====================================================================

const NODE_WEIGHTS: [NodeType, number][] = [
  ['fight', 46],
  ['elite', 12],
  ['event', 18],
  ['rest', 9],
  ['shop', 8],
  ['treasure', 7],
];

export function genChoices(run: Run): PathNode[] {
  if (run.actNode >= NODES_PER_ACT) return [{ type: 'boss' }];
  const r = rng(run);
  const n = r.int(2, 3);
  const out: PathNode[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 50) {
    const t = r.weighted(NODE_WEIGHTS.filter(([t]) => !(run.actNode < 2 && t === 'elite') && !(run.actNode === 0 && t === 'rest')));
    if (out.some((o) => o.type === t) && out.length < 2 && guard < 20) continue;
    out.push({ type: t });
  }
  // Always offer at least one fight early in an act.
  if (run.actNode < 3 && !out.some((o) => o.type === 'fight')) out[0] = { type: 'fight' };
  return out;
}

export function chooseNode(run: Run, index: number) {
  const node = run.choices[index];
  if (!node || run.screen !== 'hub') return;
  run.snapshots.nodeStart = serialize(run);
  run.currentNode = node;
  // Narrated runs open with a short scene (events are scenes already).
  if (run.narrate && node.type !== 'event') {
    const key = nodeKey(run, node, index);
    const buffered = story(run).buffer[key];
    openScene(run, { kind: node.type === 'boss' ? 'bossIntro' : 'node', status: 'pending', title: '', text: '', next: 'enterNode', key });
    if (buffered) setSceneText(run, buffered.title, buffered.text, buffered.summary);
    return;
  }
  enterNode(run);
}

/** Starts the chosen node: a fight, an event, a rest, a shop or a treasure. */
export function enterNode(run: Run) {
  const node = run.currentNode;
  if (!node) return;
  const r = rng(run);
  switch (node.type) {
    case 'fight':
    case 'elite':
    case 'boss':
      startCombat(run, node.type === 'fight' ? 'normal' : node.type, regionId(run));
      run.screen = 'combat';
      afterCombatAction(run);
      break;
    case 'event':
      run.event = makeEvent(run);
      run.screen = 'event';
      break;
    case 'rest':
      run.screen = 'rest';
      run.restMode = undefined;
      break;
    case 'shop':
      run.shop = genShop(run);
      run.screen = 'shop';
      break;
    case 'treasure': {
      const n = r.chance(0.35) ? 2 : 1;
      for (let i = 0; i < n; i++) run.pendingLoot.push(generateItem(r, uid(run), { power: itemPower(run), source: 'treasure', night: run.isNight }));
      run.pendingGold += Math.round((10 + 3 * run.distance) * goldMult(run));
      log(run, 'You find a treasure cache.', 'loot');
      run.screen = 'loot';
      break;
    }
  }
}

export function itemPower(run: Run): number {
  return 1 + run.distance;
}

function goldMult(run: Run): number {
  return 1 + run.heroes.reduce((s, h) => s + derive(h).goldFind, 0) / 100;
}

// ====================================================================
// Combat resolution
// ====================================================================

/** Call after every combat action: handles victory, wipe and fleeing. */
export function afterCombatAction(run: Run) {
  const c = run.combat;
  if (!c || run.screen !== 'combat') return;
  if (c.phase === 'won') resolveVictory(run);
  else if (c.phase === 'lost') resolveWipe(run);
  else if (c.phase === 'fled') {
    run.combat = undefined;
    log(run, 'You escaped. No reward.', 'info');
    finishNode(run);
  }
}

function resolveVictory(run: Run) {
  const c = run.combat!;
  const r = rng(run);
  run.stats.fights += 1;
  const source = c.kind === 'normal' ? 'normal' : c.kind;
  const items = c.kind === 'normal' ? (r.chance(0.75) ? 1 : 0) : 2;
  for (let i = 0; i < items; i++) {
    run.pendingLoot.push(generateItem(r, uid(run), { power: itemPower(run), source, night: run.isNight }));
  }
  if (c.kind === 'boss' && !run.pendingLoot.some((i) => RARITIES.indexOf(i.rarity) >= 2)) {
    run.pendingLoot.push(generateItem(r, uid(run), { power: itemPower(run), rarity: r.chance(0.2) ? 'legendary' : 'epic' }));
  }
  if (r.chance(c.kind === 'normal' ? 0.3 : 0.6)) run.pendingConsumables.push({ id: r.pick(CONSUMABLE_IDS), qty: 1 });
  run.pendingGold += Math.round(c.goldReward * goldMult(run) * (0.85 + r.next() * 0.3));
  run.pendingXp += c.xpReward;

  // Tithe curse: gold lost after each fight.
  for (const h of run.heroes) {
    if (h.curses.includes('tithe')) {
      const lost = Math.round(run.gold * 0.08);
      run.gold -= lost;
      if (lost) log(run, `Tithe: the party loses ${lost} gold.`, 'bad');
    }
  }

  log(run, `Victory! +${c.xpReward} XP each.`, 'loot');
  if (run.narrate) run.pendingOutro = { kind: c.kind, enemies: [...new Set(c.enemies.map((e) => e.name))] };
  if (c.kind === 'boss') {
    run.stats.bossesKilled += 1;
    run.bossBeaten = true;
  }
  run.combat = undefined;
  run.screen = 'loot';
}

function resolveWipe(run: Run) {
  run.stats.wipes += 1;
  const prev = run;
  const snap = prev.snapshots.actStart;
  if (!snap) {
    run.screen = 'gameover';
    return;
  }
  const restored: Run = JSON.parse(snap);
  const r = rng(prev);
  // Curses: keep this act's curses, then each player gets a different new one.
  const taken: CurseId[] = [];
  for (const h of restored.heroes) {
    const old = prev.heroes.find((x) => x.id === h.id)!;
    h.curses = [...old.curses];
    const options = CURSE_IDS.filter((c) => !h.curses.includes(c) && !taken.includes(c));
    if (options.length) {
      const curse = r.pick(options);
      taken.push(curse);
      h.curses.push(curse);
    }
    fixHp(h);
  }
  // Keep run-wide counters; restore everything else.
  restored.stats = prev.stats;
  restored.reviveCount = prev.reviveCount;
  restored.uidCounter = prev.uidCounter;
  restored.rngState = prev.rngState;
  restored.wipesThisAct = prev.wipesThisAct + 1;
  restored.snapshots = { actStart: snap };
  restored.log = [...prev.log];
  restored.slot = prev.slot;
  restored.choices = genChoices(restored);
  restored.screen = 'wipe';
  restored.notice = restored.heroes
    .map((h) => (h.curses.length ? `${h.name} is cursed: ${CURSES[h.curses[h.curses.length - 1]].name}` : h.name))
    .join(' · ');
  Object.keys(run).forEach((k) => delete (run as any)[k]);
  Object.assign(run, restored);
  log(run, 'The party has fallen... You wake at the start of the act, cursed.', 'bad');
}

// ====================================================================
// Node flow
// ====================================================================

/** Moves to the next screen after a node: loot, revive, level-up, then the path. */
export function advance(run: Run) {
  if (run.pendingLoot.length || run.pendingConsumables.length || run.pendingGold || run.pendingXp) {
    run.screen = 'loot';
    return;
  }
  if (run.heroes.some((h) => h.dead) && !run.skipRevive) {
    run.screen = 'revive';
    return;
  }
  if (run.heroes.some((h) => h.pendingLevelUps > 0 || h.statPoints > 0)) {
    for (const h of run.heroes) if (h.pendingLevelUps > 0 && !h.talentOffer) h.talentOffer = rollTalentOffer(rng(run), h);
    run.screen = 'levelup';
    return;
  }
  if (run.bossBeaten) {
    run.bossBeaten = false;
    completeAct(run);
    return;
  }
  run.screen = 'hub';
}

export function finishNode(run: Run) {
  run.distance += 1;
  run.actNode += 1;
  run.currentNode = undefined;
  run.event = undefined;
  run.shop = undefined;
  run.restMode = undefined;
  run.skipRevive = false;
  run.choices = genChoices(run);
  advance(run);
}

function completeAct(run: Run) {
  for (const h of run.heroes) h.curses = [];
  if (run.act >= ACTS) {
    run.screen = 'victory';
    log(run, 'The final boss is defeated! The road is yours.', 'loot');
    if (run.narrate) openScene(run, { kind: 'ending', status: 'pending', title: '', text: '', next: 'victory' });
    return;
  }
  run.act += 1;
  run.actNode = 0;
  run.wipesThisAct = 0;
  run.rerollTokens += 1;
  if (run.heroes.some((h) => derive(h).legendaries.has('gamblersCoin'))) run.rerollTokens += 1;
  run.choices = genChoices(run);
  run.notice = `Act ${run.act}: ${regionName(run)}`;
  log(run, `Act ${run.act} begins: ${regionName(run)}. Curses lifted.`, 'info');
  run.screen = 'hub';
  story(run).eventBuffer = [];
  if (run.narrate) {
    run.notice = undefined;
    openScene(run, { kind: 'actIntro', status: 'pending', title: '', text: '', next: 'hub' });
  }
  takeActSnapshot(run);
}

// ====================================================================
// Loot
// ====================================================================

export function collectLootCurrency(run: Run) {
  if (run.pendingGold) {
    run.gold += run.pendingGold;
    log(run, `+${run.pendingGold} gold.`, 'loot');
    run.pendingGold = 0;
  }
  if (run.pendingXp) {
    for (const h of run.heroes) {
      const lv = gainXp(h, run.pendingXp);
      if (lv) log(run, `${h.name} reaches level ${h.level}!`, 'loot');
    }
    run.pendingXp = 0;
  }
}

export function lootTake(run: Run, index: number): boolean {
  const it = run.pendingLoot[index];
  if (!it || !addToBag(run, { type: 'item', item: it })) return false;
  run.pendingLoot.splice(index, 1);
  return true;
}

export function lootSalvage(run: Run, index: number) {
  const it = run.pendingLoot[index];
  if (!it) return;
  run.essence += salvageValue(it);
  run.pendingLoot.splice(index, 1);
}

export function lootEquip(run: Run, heroId: HeroId, index: number, slot?: EquipSlot) {
  const it = run.pendingLoot[index];
  if (!it) return;
  const h = getHero(run, heroId);
  const s = slot ?? equipSlotFor(h, it);
  const old = h.equipment[s];
  h.equipment[s] = it;
  run.pendingLoot.splice(index, 1);
  if (old) run.pendingLoot.push(old);
  fixHp(h);
}

export function lootTakeConsumable(run: Run, index: number): boolean {
  const c = run.pendingConsumables[index];
  if (!c || !addToBag(run, { type: 'consumable', stack: { ...c } })) return false;
  run.pendingConsumables.splice(index, 1);
  return true;
}

export function lootDiscardConsumable(run: Run, index: number) {
  run.pendingConsumables.splice(index, 1);
}

/** Leaves the loot screen. Anything not taken is salvaged automatically. */
export function lootDone(run: Run) {
  run.pendingOutro = undefined;
  collectLootCurrency(run);
  for (const it of run.pendingLoot) run.essence += salvageValue(it);
  run.pendingLoot = [];
  run.pendingConsumables = [];
  if (run.currentNode) finishNode(run);
  else advance(run);
}

// ====================================================================
// Bag, belt and equipment
// ====================================================================

export function addToBag(run: Run, entry: BagEntry): boolean {
  if (entry.type === 'consumable') {
    let left = entry.stack.qty;
    for (const b of run.bag) {
      if (left <= 0) break;
      if (b?.type === 'consumable' && b.stack.id === entry.stack.id && b.stack.qty < STACK_MAX) {
        const add = Math.min(STACK_MAX - b.stack.qty, left);
        b.stack.qty += add;
        left -= add;
      }
    }
    while (left > 0) {
      const i = run.bag.indexOf(null);
      if (i < 0) return false;
      const add = Math.min(STACK_MAX, left);
      run.bag[i] = { type: 'consumable', stack: { id: entry.stack.id, qty: add } };
      left -= add;
    }
    return true;
  }
  const i = run.bag.indexOf(null);
  if (i < 0) return false;
  run.bag[i] = entry;
  return true;
}

export function bagFree(run: Run): number {
  return run.bag.filter((b) => !b).length;
}

export function equipFromBag(run: Run, heroId: HeroId, bagIndex: number, slot?: EquipSlot) {
  const b = run.bag[bagIndex];
  if (b?.type !== 'item') return;
  const h = getHero(run, heroId);
  const s = slot ?? equipSlotFor(h, b.item);
  const old = h.equipment[s];
  h.equipment[s] = b.item;
  run.bag[bagIndex] = old ? { type: 'item', item: old } : null;
  fixHp(h);
}

export function unequip(run: Run, heroId: HeroId, slot: EquipSlot): boolean {
  const h = getHero(run, heroId);
  const it = h.equipment[slot];
  if (!it || !addToBag(run, { type: 'item', item: it })) return false;
  delete h.equipment[slot];
  fixHp(h);
  return true;
}

export function salvageBag(run: Run, bagIndex: number) {
  const b = run.bag[bagIndex];
  if (b?.type !== 'item') return;
  run.essence += salvageValue(b.item);
  run.bag[bagIndex] = null;
}

export function discardBag(run: Run, bagIndex: number) {
  run.bag[bagIndex] = null;
}

/** Moves a consumable stack from the bag to a belt slot (stacks up to 3). */
export function bagToBelt(run: Run, heroId: HeroId, bagIndex: number): boolean {
  const b = run.bag[bagIndex];
  if (b?.type !== 'consumable') return false;
  const h = getHero(run, heroId);
  const locked = h.curses.includes('butterfingers') ? [2] : [];
  for (let i = 0; i < BELT_SIZE && b.stack.qty > 0; i++) {
    if (locked.includes(i)) continue;
    const s = h.belt[i];
    if (s && s.id === b.stack.id && s.qty < STACK_MAX) {
      const add = Math.min(STACK_MAX - s.qty, b.stack.qty);
      s.qty += add;
      b.stack.qty -= add;
    }
  }
  for (let i = 0; i < BELT_SIZE && b.stack.qty > 0; i++) {
    if (locked.includes(i)) continue;
    if (!h.belt[i]) {
      h.belt[i] = { id: b.stack.id, qty: b.stack.qty };
      b.stack.qty = 0;
    }
  }
  if (b.stack.qty <= 0) run.bag[bagIndex] = null;
  return true;
}

export function beltToBag(run: Run, heroId: HeroId, beltIndex: number): boolean {
  const h = getHero(run, heroId);
  const s = h.belt[beltIndex];
  if (!s || !addToBag(run, { type: 'consumable', stack: { ...s } })) return false;
  h.belt[beltIndex] = null;
  return true;
}

/** Potions can be drunk outside combat (from the belt or the bag). */
export function drinkOutOfCombat(run: Run, heroId: HeroId, from: 'belt' | 'bag', index: number): boolean {
  const h = getHero(run, heroId);
  if (h.dead) return false;
  const stack: ConsumableStack | null | undefined = from === 'belt' ? h.belt[index] : run.bag[index]?.type === 'consumable' ? (run.bag[index] as { type: 'consumable'; stack: ConsumableStack }).stack : null;
  if (!stack || !['potion', 'greaterPotion', 'antidote'].includes(stack.id)) return false;
  const d = derive(h);
  if (stack.id === 'potion') h.hp = Math.min(d.maxHp, h.hp + Math.round(d.maxHp * 0.35 * (1 + d.healingReceived / 100)));
  if (stack.id === 'greaterPotion') h.hp = Math.min(d.maxHp, h.hp + Math.round(d.maxHp * 0.7 * (1 + d.healingReceived / 100)));
  stack.qty -= 1;
  if (stack.qty <= 0) {
    if (from === 'belt') h.belt[index] = null;
    else run.bag[index] = null;
  }
  log(run, `${h.name} drinks a ${CONSUMABLES[stack.id].name}.`, 'hero');
  return true;
}

// ====================================================================
// Level-ups
// ====================================================================

export function levelUpChoose(run: Run, heroId: HeroId, talentId: string) {
  const h = getHero(run, heroId);
  if (!h.talentOffer?.includes(talentId)) return;
  chooseTalent(h, talentId);
  log(run, `${h.name} learns ${talentId.replace(/^[tg]_/, '')}.`, 'hero');
  if (h.pendingLevelUps > 0) h.talentOffer = rollTalentOffer(rng(run), h);
}

export function levelUpReroll(run: Run, heroId: HeroId) {
  const h = getHero(run, heroId);
  if (h.race !== 'human' || h.humanRerollUsed || !h.talentOffer) return;
  h.talentOffer = rollTalentOffer(rng(run), h);
  h.humanRerollUsed = true;
}

export function levelUpStat(run: Run, heroId: HeroId, stat: Stat) {
  spendStatPoint(getHero(run, heroId), stat);
}

export function levelUpDone(run: Run) {
  if (run.heroes.some((h) => h.pendingLevelUps > 0 || h.statPoints > 0)) return;
  advance(run);
}

// ====================================================================
// Revive (escalating cost)
// ====================================================================

export type ReviveMethod = 'xp' | 'hp' | 'item' | 'gold' | 'free';

export function reviveStep(run: Run): number {
  const acolyte = run.heroes.some((h) => h.background === 'acolyte');
  return Math.max(0, run.reviveCount - (acolyte ? 1 : 0));
}

export function reviveFree(run: Run): boolean {
  return run.reviveCount === 0 && run.heroes.some((h) => h.background === 'acolyte');
}

export function reviveCosts(run: Run, fallenId: HeroId) {
  const step = reviveStep(run);
  const fallen = getHero(run, fallenId);
  const helper = run.heroes.find((h) => h.id !== fallenId)!;
  const minRarity: Rarity = RARITIES[Math.min(3, step)];
  return {
    step,
    xp: Math.round(xpToNext(fallen.level) * 0.25 * (step + 1)),
    hpPct: Math.min(60, 15 * (step + 1)),
    hp: Math.round(derive(helper).maxHp * Math.min(0.6, 0.15 * (step + 1))),
    minRarity,
    gold: (step + 1) * (25 + 3 * run.distance),
  };
}

/** Items eligible for an item sacrifice (bag or equipped by the living hero). */
export function reviveItemOptions(run: Run, fallenId: HeroId): { where: 'bag' | EquipSlot; index: number; item: Item }[] {
  const { minRarity } = reviveCosts(run, fallenId);
  const min = RARITIES.indexOf(minRarity);
  const out: { where: 'bag' | EquipSlot; index: number; item: Item }[] = [];
  run.bag.forEach((b, i) => {
    if (b?.type === 'item' && RARITIES.indexOf(b.item.rarity) >= min) out.push({ where: 'bag', index: i, item: b.item });
  });
  return out;
}

export function canRevive(run: Run, fallenId: HeroId, method: ReviveMethod): boolean {
  const fallen = getHero(run, fallenId);
  if (!fallen.dead) return false;
  const helper = run.heroes.find((h) => h.id !== fallenId)!;
  const c = reviveCosts(run, fallenId);
  switch (method) {
    case 'free':
      return reviveFree(run);
    case 'xp':
      return true;
    case 'hp':
      return !helper.dead && helper.hp > c.hp;
    case 'gold':
      return run.gold >= c.gold;
    case 'item':
      return reviveItemOptions(run, fallenId).length > 0;
  }
}

export function revive(run: Run, fallenId: HeroId, method: ReviveMethod, bagIndex?: number): boolean {
  if (!canRevive(run, fallenId, method)) return false;
  const fallen = getHero(run, fallenId);
  const helper = run.heroes.find((h) => h.id !== fallenId)!;
  const c = reviveCosts(run, fallenId);
  switch (method) {
    case 'xp':
      fallen.xp = Math.max(0, fallen.xp - c.xp);
      break;
    case 'hp':
      helper.hp -= c.hp;
      break;
    case 'gold':
      run.gold -= c.gold;
      break;
    case 'item': {
      const opts = reviveItemOptions(run, fallenId);
      const pick = opts.find((o) => o.index === bagIndex) ?? opts[0];
      run.bag[pick.index] = null;
      break;
    }
  }
  fallen.dead = false;
  fallen.hp = Math.round(derive(fallen).maxHp * 0.5);
  run.reviveCount += 1;
  run.stats.revives += 1;
  log(run, `${fallen.name} is back on their feet.`, 'loot');
  advance(run);
  return true;
}

export function skipRevive(run: Run) {
  run.skipRevive = true;
  advance(run);
}

// ====================================================================
// Rest and Forge
// ====================================================================

export function restHeal(run: Run) {
  if (run.screen !== 'rest' || run.restMode) return;
  run.restMode = 'rest';
  for (const h of livingHeroes(run)) {
    const d = derive(h);
    const pct = 0.5 * (h.race === 'dwarf' ? 1.25 : 1);
    h.hp = Math.min(d.maxHp, h.hp + Math.round(d.maxHp * pct));
  }
  log(run, 'The party rests by the fire.', 'info');
  if (run.heroes.some((h) => h.background === 'outlander')) {
    const id = rng(run).pick(['potion', 'antidote', 'bomb', 'wardScroll'] as ConsumableId[]);
    run.pendingConsumables.push({ id, qty: 1 });
    log(run, `The outlander forages a ${CONSUMABLES[id].name}.`, 'loot');
  }
}

export function chooseForge(run: Run) {
  if (run.screen !== 'rest' || run.restMode) return;
  run.restMode = 'forge';
}

type ItemRef = { heroId: HeroId; slot: EquipSlot } | { bagIndex: number };

export function itemByRef(run: Run, ref: ItemRef): Item | undefined {
  if ('bagIndex' in ref) {
    const b = run.bag[ref.bagIndex];
    return b?.type === 'item' ? b.item : undefined;
  }
  return getHero(run, ref.heroId).equipment[ref.slot];
}

export function forgeUpgrade(run: Run, ref: ItemRef): boolean {
  if (run.restMode !== 'forge') return false;
  const it = itemByRef(run, ref);
  if (!it || !canUpgrade(it)) return false;
  const cost = forgeUpgradeCost(it);
  if (run.essence < cost) return false;
  run.essence -= cost;
  upgradeItem(rng(run), it);
  run.restMode = 'forged';
  log(run, `The forge glows: ${it.name}.`, 'loot');
  return true;
}

export function forgeReroll(run: Run, ref: ItemRef, affixIndex: number): boolean {
  if (run.restMode !== 'forge') return false;
  const it = itemByRef(run, ref);
  if (!it || !it.affixes[affixIndex]) return false;
  const cost = forgeRerollCost(it);
  if (run.essence < cost) return false;
  run.essence -= cost;
  rerollAffix(rng(run), it, affixIndex);
  run.restMode = 'forged';
  log(run, `The forge reshapes ${it.name}.`, 'loot');
  return true;
}

export function leaveRest(run: Run) {
  finishNode(run);
}

// ====================================================================
// Shop
// ====================================================================

function hasLeg(run: Run, id: string) {
  return run.heroes.some((h) => derive(h).legendaries.has(id));
}

export function genShop(run: Run) {
  const r = rng(run);
  const stock: (Item | ConsumableStack | null)[] = [];
  for (let i = 0; i < 5; i++) stock.push(generateItem(r, uid(run), { power: itemPower(run) + 1, source: 'shop' }));
  stock.push({ id: 'potion', qty: 3 });
  stock.push({ id: r.pick(CONSUMABLE_IDS.filter((c) => c !== 'potion')), qty: 2 });
  return { stock, rerolled: false };
}

export function priceFactor(run: Run) {
  return run.heroes.some((h) => h.background === 'merchant') ? 0.85 : 1;
}

export function buyPrice(run: Run, entry: Item | ConsumableStack, index?: number): number {
  const base = 'uid' in entry ? itemValue(entry) : CONSUMABLES[entry.id].price * (1 + Math.floor(run.distance / 10) * 0.25);
  let p = Math.round(base * priceFactor(run));
  if (index === 0 && 'uid' in entry && hasLeg(run, 'merchantSeal') && !run.shop?.halfPriceUsed) p = Math.round(p / 2);
  return p;
}

export function shopRerollCost(run: Run): number {
  return hasLeg(run, 'merchantSeal') ? 0 : 15 + 2 * run.distance;
}

export function shopBuy(run: Run, index: number): boolean {
  const shop = run.shop;
  const entry = shop?.stock[index];
  if (!shop || !entry) return false;
  const price = buyPrice(run, entry, index);
  if (run.gold < price) return false;
  if ('uid' in entry) {
    if (!addToBag(run, { type: 'item', item: entry })) return false;
    shop.stock[index] = null;
    if (index === 0 && hasLeg(run, 'merchantSeal')) shop.halfPriceUsed = true;
  } else {
    if (!addToBag(run, { type: 'consumable', stack: { id: entry.id, qty: 1 } })) return false;
    entry.qty -= 1;
    if (entry.qty <= 0) shop.stock[index] = null;
  }
  run.gold -= price;
  return true;
}

export function shopSell(run: Run, bagIndex: number): boolean {
  const b = run.bag[bagIndex];
  if (!b) return false;
  const value = b.type === 'item' ? sellValue(b.item) : Math.max(1, Math.round(CONSUMABLES[b.stack.id].price * 0.25)) * b.stack.qty;
  run.gold += value;
  run.bag[bagIndex] = null;
  return true;
}

export function shopReroll(run: Run): boolean {
  const shop = run.shop;
  if (!shop || shop.rerolled) return false;
  const cost = shopRerollCost(run);
  if (run.gold < cost) return false;
  run.gold -= cost;
  run.shop = { ...genShop(run), rerolled: true };
  return true;
}

export function leaveShop(run: Run) {
  finishNode(run);
}

// ====================================================================
// Events (skill checks)
// ====================================================================

function makeEvent(run: Run): EventState {
  if (run.narrate) {
    const type = chooseEventType(run);
    if (type === 'villain') story(run).villainBeats[run.act] = (story(run).villainBeats[run.act] ?? 0) + 1;
    const ev: EventState = { templateId: type, title: '', text: '', options: [], status: 'pending', type, reward: rewardFor(run, type), penalty: EVENT_TYPES[type].penalty };
    // Use a pre-written event of the same type if the buffer has one.
    const buf = story(run).eventBuffer;
    const i = buf.findIndex((d) => d.type === type && d.region === regionId(run));
    if (i >= 0) {
      applyEventDraft(run, ev, buf[i]);
      buf.splice(i, 1);
    }
    return ev;
  }
  const t = rng(run).pick(EVENTS);
  const dc = baseDc(run.distance);
  return {
    templateId: t.id,
    title: t.title,
    text: t.text,
    options: t.options.map((o) => ({ stat: o.stat, label: o.label, dc: dc + o.diff })),
    status: 'ready',
    reward: t.reward,
    penalty: t.penalty,
  };
}

/** Fills an event with a scene written by the AI (or an offline template). */
export function applyEventDraft(run: Run, ev: EventState, d: AiEventDraft) {
  ev.title = d.title;
  ev.text = d.text;
  ev.summary = d.summary;
  ev.npc = d.npc?.name ? d.npc : undefined;
  ev.options = d.choices.slice(0, 4).map((c) => ({ stat: c.stat, label: c.label, difficulty: c.difficulty, dc: dcFor(run, c.difficulty) }));
  if (!ev.options.length) ev.options = offlineEvent(run, ev.type ?? 'social').choices.map((c) => ({ stat: c.stat, label: c.label, difficulty: c.difficulty, dc: dcFor(run, c.difficulty) }));
  ev.status = 'ready';
  if (ev.npc && !story(run).npcsMet.some((n) => n.name === ev.npc!.name)) story(run).npcsMet.push({ name: ev.npc.name, role: ev.npc.role, note: ev.npc.description });
}

export function setEventDraft(run: Run, d: AiEventDraft) {
  if (run.event && run.event.status === 'pending') applyEventDraft(run, run.event, d);
}

/** "Something else": the GM mapped the players' idea to a check; add it as a choice. */
export function addFreeTextOption(run: Run, label: string, stat: Stat | 'none', difficulty: Difficulty): number {
  const ev = run.event;
  if (!ev || ev.result) return -1;
  ev.options = ev.options.filter((o) => !o.freeText);
  ev.options.push({ stat, label, difficulty, dc: dcFor(run, difficulty), freeText: true });
  return ev.options.length - 1;
}

export function eventRoll(run: Run, heroId: HeroId, optionIndex: number) {
  const ev = run.event;
  if (!ev || ev.result || ev.status === 'pending') return;
  const opt = ev.options[optionIndex];
  if (!opt || getHero(run, heroId).dead) return;
  ev.chosen = optionIndex;
  if (opt.stat === 'none') {
    ev.result = { heroId, stat: 'spirit', dice: [0, 0], bonus: 0, total: 0, dc: 0, tier: 'success', rerolled: false, noRoll: true };
    return;
  }
  ev.result = rollCheck(rng(run), run, heroId, opt.stat, opt.dc);
}

export function eventReroll(run: Run) {
  const ev = run.event;
  if (!ev?.result || ev.outcomeText || run.rerollTokens <= 0 || ev.result.noRoll) return;
  if (ev.result.tier === 'success' || ev.result.tier === 'great') return;
  const opt = ev.options[ev.chosen!];
  if (opt.stat === 'none') return;
  run.rerollTokens -= 1;
  ev.result = rollCheck(rng(run), run, ev.result.heroId, opt.stat, opt.dc, true);
}

const TIER_WORDS = { great: 'Great success', success: 'Success', partial: 'Partial success', failure: 'Failure', bad: 'Bad failure' };

/** Applies the coded reward or penalty for the rolled tier. The GM only narrates it afterwards. */
export function eventAccept(run: Run) {
  const ev = run.event;
  if (!ev?.result || ev.outcomeText) return;
  const tier = ev.result.tier;
  const h = getHero(run, ev.result.heroId);
  const r = rng(run);
  const mult = { great: 2, success: 1, partial: 0.5, failure: 0, bad: 0 }[tier];
  const penaltyMult = { great: 0, success: 0, partial: 0.5, failure: 1, bad: 2 }[tier];
  const facts: string[] = [];
  const template = EVENTS.find((e) => e.id === ev.templateId);
  const lines: string[] = [];
  if (template) lines.push(tier === 'failure' || tier === 'bad' ? template.failure : tier === 'partial' ? template.partial : template.success);
  else lines.push(`${TIER_WORDS[tier]}.`);
  if (tier === 'great') facts.push('Great success: double reward.');

  if (mult > 0) {
    switch (ev.reward) {
      case 'gold': {
        const g = Math.round((20 + 4 * run.distance) * mult * goldMult(run));
        run.pendingGold += g;
        facts.push(`The party gains ${g} gold.`);
        break;
      }
      case 'item': {
        const n = tier === 'great' ? 2 : 1;
        for (let i = 0; i < n; i++) run.pendingLoot.push(generateItem(r, uid(run), { power: itemPower(run), source: tier === 'partial' ? 'normal' : 'treasure' }));
        facts.push(`The party finds ${n === 2 ? 'two items' : 'an item'}.`);
        break;
      }
      case 'xp': {
        const xp = Math.round((15 + 4 * run.distance) * mult);
        run.pendingXp += xp;
        facts.push(`Everyone gains ${xp} XP.`);
        break;
      }
      case 'consumable': {
        const id = r.pick(CONSUMABLE_IDS);
        run.pendingConsumables.push({ id, qty: tier === 'great' ? 2 : 1 });
        facts.push(`The party gets ${tier === 'great' ? 'two' : 'a'} ${CONSUMABLES[id].name}.`);
        break;
      }
      case 'reroll':
        if (tier !== 'partial') {
          run.rerollTokens += tier === 'great' ? 2 : 1;
          facts.push('The party gains a reroll token.');
        }
        break;
      case 'heal':
        for (const x of livingHeroes(run)) {
          const d = derive(x);
          x.hp = Math.min(d.maxHp, x.hp + Math.round(d.maxHp * 0.4 * mult));
        }
        facts.push(`The party heals ${Math.round(40 * mult)}% of their HP.`);
        break;
      case 'liftCurse': {
        const cursed = run.heroes.filter((x) => x.curses.length);
        const n = tier === 'great' ? 2 : tier === 'partial' ? 1 : 1;
        for (let i = 0; i < n && cursed.length; i++) {
          const x = cursed[i % cursed.length];
          const c = x.curses.shift();
          if (c) facts.push(`${x.name}'s curse (${CURSES[c].name}) is lifted.`);
        }
        break;
      }
    }
  }
  if (penaltyMult > 0) {
    if (ev.penalty === 'damage') {
      const dmg = Math.round(derive(h).maxHp * 0.12 * penaltyMult);
      h.hp = Math.max(1, h.hp - dmg);
      facts.push(`${h.name} loses ${dmg} HP.`);
    }
    if (ev.penalty === 'gold' && tier !== 'partial') {
      const g = Math.min(run.gold, Math.round((10 + 2 * run.distance) * penaltyMult));
      run.gold -= g;
      facts.push(`The party loses ${g} gold.`);
    }
  }
  const opt = ev.options[ev.chosen!];
  if (ev.type === 'moral' || ev.type === 'villain') {
    const s = story(run);
    s.flags.push({ act: run.act, text: `${ev.title}: ${opt.label} (${TIER_WORDS[tier].toLowerCase()})` });
    if (s.flags.length > 12) s.flags.shift();
  }
  ev.outcomeFacts = `${h.name} chose: "${opt.label}". ${ev.result.noRoll ? 'No roll needed.' : `${TIER_WORDS[tier]}.`} ${facts.join(' ')}`.trim();
  ev.outcomeText = [...lines, ...facts].join(' ');
  log(run, `${ev.title}: ${TIER_WORDS[tier].toLowerCase()}.`, tier === 'failure' || tier === 'bad' ? 'bad' : 'loot');
}

/** Replaces the plain outcome text with the GM's narration. */
export function setEventNarration(run: Run, text: string) {
  if (!run.event?.outcomeText) return;
  run.event.outcomeText = text;
  run.event.outcomeNarrated = true;
}

export function eventDone(run: Run) {
  const ev = run.event;
  if (!ev?.outcomeText) return;
  if (run.narrate) addJournal(run, 'event', ev.title, `${ev.text}\n\n${ev.outcomeText}`, `${ev.summary ?? ev.title} → ${ev.outcomeFacts ?? ''}`.slice(0, 220));
  finishNode(run);
}

// ====================================================================
// Misc
// ====================================================================

export function dismissNotice(run: Run) {
  run.notice = undefined;
  if (run.screen === 'wipe') run.screen = 'hub';
}

export function score(run: Run) {
  return run.distance * 10 + run.stats.bossesKilled * 100;
}

export function heroById(run: Run, id: HeroId): Hero {
  return getHero(run, id);
}
