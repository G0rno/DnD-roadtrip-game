import { useGame } from '../store';
import { TopBar } from '../components/TopBar';
import { ItemCard, ConsumableCard } from '../components/ItemView';
import { CLASS_ICON } from '../components/bits';
import { bagFree, lootDiscardConsumable, lootDone, lootEquip, lootSalvage, lootTake, lootTakeConsumable } from '../../engine/run';
import { equipSlotFor } from '../../engine/character';
import { salvageValue } from '../../engine/items';

export function Loot() {
  const { run, act, openInventory } = useGame();
  const leftover = run.pendingLoot.reduce((s, i) => s + salvageValue(i), 0);
  const nothing = !run.pendingLoot.length && !run.pendingConsumables.length;

  return (
    <>
      <TopBar title="Loot" />
      <div class="screen">
        <div class="row spread">
          <h2>Spoils</h2>
          <div class="row">
            {run.pendingGold > 0 && <span class="badge gold">+{run.pendingGold} gold</span>}
            {run.pendingXp > 0 && <span class="badge good">+{run.pendingXp} XP each</span>}
            <span class="badge">Bag space: {bagFree(run)}</span>
          </div>
        </div>
        <div class="grow scroll col">
          {nothing && <div class="muted center" style={{ marginTop: '40px' }}>No items this time.</div>}
          <div class="grid2">
            {run.pendingLoot.map((it, i) => (
              <ItemCard item={it}>
                <div class="col" style={{ gap: '6px', marginTop: '8px' }}>
                  {run.heroes.map((h) => {
                    const slot = equipSlotFor(h, it);
                    const cur = h.equipment[slot];
                    return (
                      <div class="row small">
                        <button class="small" onClick={() => act((r) => lootEquip(r, h.id, i))}>
                          {CLASS_ICON[h.cls]} Equip on {h.name}
                        </button>
                        <span class="muted grow">
                          now: {cur ? <span class={`r-${cur.rarity}`}>{cur.name} (iLv {cur.power})</span> : 'empty'}
                        </span>
                      </div>
                    );
                  })}
                  <div class="row">
                    <button class="small" disabled={bagFree(run) === 0} onClick={() => act((r) => lootTake(r, i))}>
                      🎒 To bag
                    </button>
                    <button class="small" onClick={() => act((r) => lootSalvage(r, i))}>
                      ✦ Salvage (+{salvageValue(it)})
                    </button>
                  </div>
                </div>
              </ItemCard>
            ))}
            {run.pendingConsumables.map((cst, i) => (
              <ConsumableCard stack={cst}>
                <div class="row" style={{ marginTop: '6px' }}>
                  <button class="small" onClick={() => act((r) => lootTakeConsumable(r, i))} disabled={bagFree(run) === 0}>
                    🎒 Take
                  </button>
                  <button class="small ghost" onClick={() => act((r) => lootDiscardConsumable(r, i))}>
                    Leave it
                  </button>
                </div>
              </ConsumableCard>
            ))}
          </div>
        </div>
        <div class="row spread">
          <button onClick={openInventory}>🎒 Inventory</button>
          <button class="primary big" onClick={() => act(lootDone)}>
            Continue{leftover > 0 ? ` (salvage the rest: +${leftover} ✦)` : ''} →
          </button>
        </div>
      </div>
    </>
  );
}
