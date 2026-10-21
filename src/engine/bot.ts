// A simple autoplayer used by tests and the balance simulation. Not used by the game itself.
import type { HeroId, Run } from './types';
import { STATS } from './types';
import { CLASSES } from './data/characters';
import { RARITY_INFO } from './data/items';
import { derive } from './character';
import {
  abilityReady,
  attackPreview,
  canMinor,
  endPlayerTurn,
  heroAbility,
  heroAttack,
  heroUltimate,
  heroUseConsumable,
  isMeleeAction,
  liveEnemies,
  ultimateReady,
  validEnemyTargets,
} from './combat';
import { ABILITIES } from './data/characters';
import {
  afterCombatAction,
  canRevive,
  chooseNode,
  dismissNotice,
  eventAccept,
  eventDone,
  eventRoll,
  levelUpChoose,
  levelUpDone,
  levelUpStat,
  lootDone,
  lootEquip,
  lootTake,
  restHeal,
  leaveRest,
  leaveShop,
  revive,
  skipRevive,
  bagToBelt,
  continueScene,
  setSceneText,
} from './run';
import { checkOdds } from './checks';

function itemScore(power: number, rarity: keyof typeof RARITY_INFO) {
  return power + RARITY_INFO[rarity].affixes * 3 + (rarity === 'legendary' ? 6 : 0);
}

export function botCombatTurn(run: Run) {
  const c = run.combat!;
  for (const id of ['p1', 'p2'] as HeroId[]) {
    const h = run.heroes.find((x) => x.id === id)!;
    if (h.dead || c.phase !== 'players') continue;
    const d = derive(h);
    // Potion when low.
    if (h.hp < d.maxHp * 0.35 && canMinor(run, id).ok) {
      const i = h.belt.findIndex((s) => s && (s.id === 'potion' || s.id === 'greaterPotion'));
      if (i >= 0) heroUseConsumable(run, id, i);
    }
    if (c.phase !== 'players') return;
    if (ultimateReady(run, id).ok) {
      heroUltimate(run, id);
      continue;
    }
    let acted = false;
    for (const ab of h.abilities) {
      if (!abilityReady(run, id, ab).ok) continue;
      const a = ABILITIES[ab];
      if (ab === 'heal' || ab === 'purify') {
        const target = run.heroes.filter((x) => !x.dead).sort((x, y) => x.hp / derive(x).maxHp - y.hp / derive(y).maxHp)[0];
        if (target.hp / derive(target).maxHp < 0.6) acted = heroAbility(run, id, ab, target.id);
      } else if (ab === 'bless') {
        const ally = run.heroes.find((x) => x.id !== id && !x.dead);
        acted = heroAbility(run, id, ab, (ally ?? h).id);
      } else if (ab === 'guard') {
        const ally = run.heroes.find((x) => x.id !== id && !x.dead);
        if (ally && ally.hp / derive(ally).maxHp < 0.5) acted = heroAbility(run, id, ab);
      } else if (ab === 'vanish' || ab === 'secondWind') {
        if (h.hp / d.maxHp < 0.35) acted = heroAbility(run, id, ab);
      } else if (a.target === 'enemy') {
        const t = validEnemyTargets(run, id, isMeleeAction(run, id, ab)).sort((x, y) => x.hp - y.hp)[0];
        if (t) acted = heroAbility(run, id, ab, t.uid);
      } else {
        acted = heroAbility(run, id, ab);
      }
      if (acted) break;
    }
    if (!acted && c.phase === 'players') {
      const targets = validEnemyTargets(run, id, isMeleeAction(run, id));
      const t = targets.sort((x, y) => x.hp - y.hp)[0];
      if (t) {
        attackPreview(run, id, t.uid);
        heroAttack(run, id, t.uid);
      }
    }
    if (liveEnemies(run).length === 0) break;
  }
  if (c.phase === 'players') endPlayerTurn(run);
  afterCombatAction(run);
}

/** Plays one step of the run for whichever screen is showing. */
export function botStep(run: Run) {
  switch (run.screen) {
    case 'hub': {
      if (run.notice) run.notice = undefined;
      // Prefer fights, avoid elites when hurt.
      const hurt = run.heroes.some((h) => h.dead || h.hp < derive(h).maxHp * 0.5);
      let idx = run.choices.findIndex((n) => (hurt ? n.type === 'rest' : n.type === 'elite' && run.distance % 3 === 0));
      if (idx < 0 && !hurt) idx = run.choices.findIndex((n) => n.type === 'fight');
      if (idx < 0) idx = run.choices.findIndex((n) => n.type !== 'elite');
      if (idx < 0) idx = 0;
      chooseNode(run, idx);
      break;
    }
    case 'combat':
      botCombatTurn(run);
      break;
    case 'loot': {
      while (run.pendingLoot.length) {
        const it = run.pendingLoot[0];
        const target = run.heroes.find((h) => it.bestFor.includes(h.cls)) ?? run.heroes[0];
        const slot = it.slot === 'trinket' ? (target.equipment.trinket1 ? 'trinket2' : 'trinket1') : it.slot;
        const cur = target.equipment[slot];
        if (!cur || itemScore(it.power, it.rarity) > itemScore(cur.power, cur.rarity)) {
          lootEquip(run, target.id, 0, slot);
          if (run.pendingLoot[run.pendingLoot.length - 1] === cur) {
            run.pendingLoot.pop();
          }
        } else if (!lootTake(run, 0)) {
          break;
        }
      }
      // Move potions to belts.
      lootDone(run);
      run.bag.forEach((b, i) => {
        if (b?.type === 'consumable') bagToBelt(run, run.heroes[i % 2].id, i);
      });
      break;
    }
    case 'revive': {
      const fallen = run.heroes.find((h) => h.dead)!;
      const order = ['free', 'gold', 'item', 'xp'] as const;
      const m = order.find((m) => canRevive(run, fallen.id, m));
      if (m) revive(run, fallen.id, m);
      else skipRevive(run);
      break;
    }
    case 'levelup':
      for (const h of run.heroes) {
        while (h.statPoints > 0) levelUpStat(run, h.id, CLASSES[h.cls].mainStat);
        while (h.pendingLevelUps > 0 && h.talentOffer) levelUpChoose(run, h.id, h.talentOffer[0]);
      }
      levelUpDone(run);
      break;
    case 'event': {
      const ev = run.event!;
      if (!ev.result) {
        let best = { p: -1, h: 'p1' as HeroId, i: 0 };
        for (const h of run.heroes.filter((x) => !x.dead))
          ev.options.forEach((o, i) => {
            const p = o.stat === 'none' ? 1 : checkOdds(run, h, o.stat, o.dc).success;
            if (p > best.p) best = { p, h: h.id, i };
          });
        eventRoll(run, best.h, best.i);
      } else if (!ev.outcomeText) eventAccept(run);
      else eventDone(run);
      break;
    }
    case 'rest':
      restHeal(run);
      leaveRest(run);
      break;
    case 'shop':
      leaveShop(run);
      break;
    case 'wipe':
      dismissNotice(run);
      break;
    case 'scene':
      if (run.scene && run.scene.status !== 'ready') setSceneText(run, 'Scene', '...');
      continueScene(run);
      break;
    default:
      break;
  }
  void STATS;
}
