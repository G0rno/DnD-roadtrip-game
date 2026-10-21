import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { prob2d10AtLeast, checkOdds, rollCheck } from '../src/engine/checks';
import { generateItem, upgradeItem, rerollAffix } from '../src/engine/items';
import { createHero, derive, gainXp, randomDraft, rollTalentOffer, chooseTalent } from '../src/engine/character';
import {
  addToBag,
  chooseNode,
  finishCreation,
  newRun,
  reviveCosts,
  revive,
  canRevive,
  takeActSnapshot,
  afterCombatAction,
  lootDone,
} from '../src/engine/run';
import { botStep } from '../src/engine/bot';
import { endPlayerTurn, heroAttack, liveEnemies, startCombat, validEnemyTargets, isMeleeAction } from '../src/engine/combat';
import type { Run } from '../src/engine/types';
import { xpToNext } from '../src/engine/data/characters';

function setupRun(seed = 42): Run {
  const run = newRun(1, seed);
  finishCreation(run, [
    { name: 'Ana', race: 'human', cls: 'fighter', background: 'soldier', humanStat: 'might' },
    { name: 'Bo', race: 'elf', cls: 'mage', background: 'scholar' },
  ]);
  return run;
}

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng({ rngState: 7 });
    const b = new Rng({ rngState: 7 });
    expect([a.next(), a.int(1, 10), a.next()]).toEqual([b.next(), b.int(1, 10), b.next()]);
  });
  it('int stays in range', () => {
    const r = new Rng({ rngState: 1 });
    for (let i = 0; i < 1000; i++) {
      const v = r.int(1, 10);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
});

describe('skill checks', () => {
  it('computes 2d10 odds exactly', () => {
    expect(prob2d10AtLeast(2)).toBe(1);
    expect(prob2d10AtLeast(21)).toBe(0);
    expect(prob2d10AtLeast(20)).toBeCloseTo(0.01);
    expect(prob2d10AtLeast(11)).toBeCloseTo(0.55);
  });
  it('odds sum to 1 and rolls land in a tier', () => {
    const run = setupRun();
    const o = checkOdds(run, run.heroes[0], 'might', 14);
    expect(o.success + o.partial + o.failure).toBeCloseTo(1);
    const res = rollCheck(new Rng(run), run, 'p1', 'might', 14);
    expect(['critical', 'success', 'partial', 'failure']).toContain(res.tier);
    expect(res.total).toBe(res.dice[0] + res.dice[1] + res.bonus);
  });
});

describe('items', () => {
  it('generates valid items for every rarity', () => {
    const r = new Rng({ rngState: 99 });
    for (let i = 0; i < 500; i++) {
      const rarity = (['common', 'rare', 'epic', 'legendary'] as const)[i % 4];
      const it = generateItem(r, `x${i}`, { power: 1 + (i % 40), rarity });
      const expected = { common: 0, rare: 1, epic: 2, legendary: 2 }[rarity];
      expect(it.affixes.length).toBe(expected);
      expect(new Set(it.affixes.map((a) => a.id)).size).toBe(it.affixes.length);
      if (rarity === 'legendary') expect(it.legendary).toBeTruthy();
      for (const a of it.affixes) expect(Number.isFinite(a.value)).toBe(true);
    }
  });
  it('forge upgrades a tier and rerolls an affix', () => {
    const r = new Rng({ rngState: 3 });
    const it = generateItem(r, 'a', { power: 5, rarity: 'common', slot: 'chest' });
    upgradeItem(r, it);
    expect(it.rarity).toBe('rare');
    expect(it.affixes.length).toBe(1);
    upgradeItem(r, it);
    expect(it.rarity).toBe('epic');
    upgradeItem(r, it);
    expect(it.rarity).toBe('epic');
    const before = it.affixes[0].id;
    rerollAffix(r, it, 0);
    expect(it.affixes[0].id).not.toBe(before);
  });
});

describe('characters', () => {
  it('creates heroes with full HP and starting kit', () => {
    const r = new Rng({ rngState: 5 });
    let n = 0;
    const h = createHero(r, 'p1', { name: 'X', race: 'dwarf', cls: 'fighter', background: 'soldier' }, () => `u${n++}`);
    expect(h.stats.might).toBe(4);
    expect(h.hp).toBe(derive(h).maxHp);
    expect(h.equipment.weapon?.baseId).toBe('swordShield');
    expect(h.equipment.legs).toBeTruthy(); // soldier extra armor
    expect(h.belt[0]?.qty).toBe(2);
  });
  it('levels up, grants stat points every 3 levels and offers talents', () => {
    const r = new Rng({ rngState: 8 });
    let n = 0;
    const h = createHero(r, 'p1', randomDraft(r), () => `u${n++}`);
    let total = 0;
    for (let l = 1; l < 6; l++) total += xpToNext(l);
    gainXp(h, total);
    expect(h.level).toBe(6);
    expect(h.statPoints).toBe(2);
    expect(h.pendingLevelUps).toBe(5);
    const offer = rollTalentOffer(r, h);
    expect(offer.length).toBe(3);
    chooseTalent(h, offer[0]);
    expect(h.pendingLevelUps).toBe(4);
    expect(h.talents).toContain(offer[0]);
  });
});

describe('bag', () => {
  it('stacks consumables up to 3 per slot', () => {
    const run = setupRun();
    addToBag(run, { type: 'consumable', stack: { id: 'potion', qty: 2 } });
    addToBag(run, { type: 'consumable', stack: { id: 'potion', qty: 2 } });
    const stacks = run.bag.filter((b) => b?.type === 'consumable');
    expect(stacks.length).toBe(2);
  });
});

describe('combat', () => {
  it('melee can only target the front row while it stands', () => {
    const run = setupRun();
    startCombat(run, 'normal', run.regions[0]);
    const melee = validEnemyTargets(run, 'p1', isMeleeAction(run, 'p1'));
    const live = liveEnemies(run);
    if (live.some((e) => e.row === 'front')) expect(melee.every((e) => e.row === 'front')).toBe(true);
    const ranged = validEnemyTargets(run, 'p2', isMeleeAction(run, 'p2'));
    expect(ranged.length).toBe(live.length);
  });
  it('one main action per hero per turn', () => {
    const run = setupRun();
    startCombat(run, 'normal', run.regions[0]);
    const t = validEnemyTargets(run, 'p1', true)[0];
    expect(heroAttack(run, 'p1', t.uid)).toBe(true);
    const t2 = liveEnemies(run)[0];
    expect(heroAttack(run, 'p1', t2.uid)).toBe(false);
    endPlayerTurn(run);
  });
});

describe('run flow', () => {
  it('bot plays many runs without crashing and keeps numbers sane', () => {
    for (let s = 0; s < 12; s++) {
      const run = newRun(1, 1000 + s);
      const r = new Rng({ rngState: s + 1 });
      const a = randomDraft(r);
      finishCreation(run, [a, randomDraft(r, [a.name])]);
      for (let i = 0; i < 1500 && run.screen !== 'victory'; i++) {
        botStep(run);
        for (const h of run.heroes) {
          const max = derive(h).maxHp;
          expect(Number.isFinite(h.hp)).toBe(true);
          expect(h.hp).toBeLessThanOrEqual(max);
          expect(h.hp).toBeGreaterThanOrEqual(0);
        }
        expect(Number.isFinite(run.gold)).toBe(true);
        expect(run.gold).toBeGreaterThanOrEqual(0);
        if (run.combat) for (const e of run.combat.enemies) expect(Number.isFinite(e.hp)).toBe(true);
      }
      // Saves are plain JSON.
      const copy = JSON.parse(JSON.stringify(run));
      expect(copy).toEqual(run);
    }
  });

  it('a wipe rolls back to the act start and curses each player differently', () => {
    const run = setupRun(77);
    run.gold = 999;
    takeActSnapshot(run);
    run.gold = 5;
    run.choices = [{ type: 'fight' }];
    chooseNode(run, 0);
    for (const h of run.heroes) h.hp = 1;
    // Let enemies finish the party.
    for (let i = 0; i < 30 && run.screen === 'combat'; i++) {
      endPlayerTurn(run);
      for (const h of run.heroes) if (!h.dead) h.hp = 1;
      afterCombatAction(run);
    }
    expect(run.screen).toBe('wipe');
    expect(run.gold).toBe(999);
    const [a, b] = run.heroes;
    expect(a.curses.length).toBe(1);
    expect(b.curses.length).toBe(1);
    expect(a.curses[0]).not.toBe(b.curses[0]);
    expect(run.stats.wipes).toBe(1);
  });

  it('revive costs escalate and acolytes revive free once', () => {
    const run = setupRun();
    run.heroes[1].dead = true;
    run.heroes[1].hp = 0;
    const c0 = reviveCosts(run, 'p2');
    run.gold = 1000;
    expect(canRevive(run, 'p2', 'gold')).toBe(true);
    revive(run, 'p2', 'gold');
    expect(run.heroes[1].dead).toBe(false);
    run.heroes[1].dead = true;
    const c1 = reviveCosts(run, 'p2');
    expect(c1.gold).toBeGreaterThan(c0.gold);
    expect(c1.xp).toBeGreaterThan(c0.xp);

    const run2 = newRun(2, 9);
    finishCreation(run2, [
      { name: 'A', race: 'dwarf', cls: 'cleric', background: 'acolyte' },
      { name: 'B', race: 'gnome', cls: 'rogue', background: 'criminal' },
    ]);
    run2.heroes[1].dead = true;
    expect(canRevive(run2, 'p2', 'free')).toBe(true);
  });

  it('loot screen ends the node and moves on', () => {
    const run = setupRun();
    run.choices = [{ type: 'treasure' }];
    chooseNode(run, 0);
    expect(run.screen).toBe('loot');
    lootDone(run);
    expect(run.distance).toBe(1);
    expect(['hub', 'levelup']).toContain(run.screen);
  });
});
