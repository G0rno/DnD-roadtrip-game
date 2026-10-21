import { useState } from 'preact/hooks';
import type { EquipSlot, HeroId, Item } from '../../engine/types';
import { EQUIP_SLOTS } from '../../engine/types';
import { useGame } from '../store';
import { TopBar } from '../components/TopBar';
import { HeroSummary } from '../components/bits';
import { ItemCard } from '../components/ItemView';
import { chooseForge, forgeReroll, forgeUpgrade, leaveRest, restHeal } from '../../engine/run';
import { canUpgrade, describeAffix, forgeRerollCost, forgeUpgradeCost } from '../../engine/items';
import { useSay } from '../useVoice';
import { restSegments } from '../../audio/narrate';

type Ref = { heroId: HeroId; slot: EquipSlot } | { bagIndex: number };

export function Rest() {
  const { run, act } = useGame();
  const [sel, setSel] = useState<{ ref: Ref; item: Item } | null>(null);
  const mode = run.restMode;
  useSay(`rest:${run.seed}:${run.distance}`, restSegments);

  const items: { ref: Ref; item: Item; owner: string }[] = [];
  for (const h of run.heroes) for (const s of EQUIP_SLOTS) if (h.equipment[s]) items.push({ ref: { heroId: h.id, slot: s }, item: h.equipment[s]!, owner: h.name });
  run.bag.forEach((b, i) => b?.type === 'item' && items.push({ ref: { bagIndex: i }, item: b.item, owner: 'Bag' }));

  const dwarf = run.heroes.some((h) => h.race === 'dwarf');

  return (
    <>
      <TopBar title="Rest" />
      <div class="screen">
        <h2>🔥 A quiet campfire</h2>
        <div class="grid2">
          {run.heroes.map((h) => (
            <HeroSummary hero={h} />
          ))}
        </div>

        {!mode && (
          <div class="grid2 grow" style={{ alignContent: 'center' }}>
            <button class="node-card" onClick={() => act(restHeal)}>
              <span class="icon">🛌</span>
              <strong>Rest</strong>
              <span class="small">Heal 50% of max HP{dwarf ? ' (dwarves: +25%)' : ''}. Fallen heroes stay down.</span>
            </button>
            <button class="node-card" onClick={() => act(chooseForge)}>
              <span class="icon">⚒️</span>
              <strong>Forge</strong>
              <span class="small">Spend essence ({run.essence} ✦) to upgrade one item a tier (up to Epic) or reroll one affix.</span>
            </button>
          </div>
        )}

        {mode === 'rest' && (
          <div class="grow center col" style={{ justifyContent: 'center' }}>
            <div class="banner">The party wakes refreshed.</div>
            {run.pendingConsumables.length > 0 && <div class="muted">The outlander found supplies. They'll be in the loot.</div>}
          </div>
        )}

        {(mode === 'forge' || mode === 'forged') && (
          <div class="row grow" style={{ alignItems: 'stretch', minHeight: 0, gap: '14px' }}>
            <div class="col scroll" style={{ flex: 1 }}>
              <strong>Choose an item ({run.essence} ✦)</strong>
              {items.map((x) => (
                <ItemCard item={x.item} compact selected={sel?.item.uid === x.item.uid} onClick={() => mode === 'forge' && setSel(x)}>
                  <div class="tiny muted">{x.owner}</div>
                </ItemCard>
              ))}
            </div>
            <div class="col" style={{ flex: 1 }}>
              {mode === 'forged' && <div class="banner">The forge cools. One job per rest.</div>}
              {sel && (
                <ItemCard item={sel.item}>
                  {mode === 'forge' && (
                    <div class="col" style={{ marginTop: '8px', gap: '6px' }}>
                      {canUpgrade(sel.item) && (
                        <button class="primary" disabled={run.essence < forgeUpgradeCost(sel.item)} onClick={() => act((r) => forgeUpgrade(r, sel.ref))}>
                          ⬆ Upgrade to {sel.item.rarity === 'common' ? 'Rare' : 'Epic'} ({forgeUpgradeCost(sel.item)} ✦)
                        </button>
                      )}
                      {sel.item.affixes.map((a, i) => (
                        <button disabled={run.essence < forgeRerollCost(sel.item)} onClick={() => act((r) => forgeReroll(r, sel.ref, i))}>
                          🔄 Reroll "{describeAffix(a)}" ({forgeRerollCost(sel.item)} ✦)
                        </button>
                      ))}
                      {!canUpgrade(sel.item) && sel.item.affixes.length === 0 && <div class="muted small">Nothing to do with this one.</div>}
                    </div>
                  )}
                </ItemCard>
              )}
              {!sel && mode === 'forge' && <div class="muted small">Pick an item on the left.</div>}
            </div>
          </div>
        )}

        <div class="row spread">
          <span class="muted small">{run.heroes.some((h) => h.dead) ? 'A fallen hero can be revived after this node.' : ''}</span>
          <button class="primary big" onClick={() => act(leaveRest)}>
            {mode ? 'Back on the road →' : 'Skip →'}
          </button>
        </div>
      </div>
    </>
  );
}
