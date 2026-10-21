import { useState } from 'preact/hooks';
import type { EquipSlot, HeroId } from '../../engine/types';
import { EQUIP_SLOTS, STATS } from '../../engine/types';
import { useGame } from '../store';
import { Modal, CLASS_ICON, STAT_LABEL, HpBar, XpBar, Curses } from '../components/bits';
import { ItemCard, ConsumableCard, slotIcon, itemIcon } from '../components/ItemView';
import { ABILITIES, BACKGROUNDS, CLASSES, RACES, TALENTS, xpToNext } from '../../engine/data/characters';
import { CONSUMABLES } from '../../engine/data/items';
import { abilityCooldown, derive } from '../../engine/character';
import { bagToBelt, beltToBag, discardBag, drinkOutOfCombat, equipFromBag, salvageBag, unequip } from '../../engine/run';
import { salvageValue } from '../../engine/items';
import { CompareModal } from '../components/Compare';

type Sel = { kind: 'bag'; index: number } | { kind: 'equip'; slot: EquipSlot } | { kind: 'belt'; index: number } | null;

const SLOT_LABEL: Record<EquipSlot, string> = { weapon: 'Weapon', head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Feet', trinket1: 'Trinket', trinket2: 'Trinket' };

export function Inventory({ onClose }: { onClose: () => void }) {
  const { run, act } = useGame();
  const [tab, setTab] = useState<HeroId>('p1');
  const [sel, setSel] = useState<Sel>(null);
  const [comparing, setComparing] = useState(false);
  const readOnly = run.screen === 'combat';
  const h = run.heroes.find((x) => x.id === tab)!;
  const d = derive(h);

  const selBag = sel?.kind === 'bag' ? run.bag[sel.index] : null;
  const selEquip = sel?.kind === 'equip' ? h.equipment[sel.slot] : null;
  const selBelt = sel?.kind === 'belt' ? h.belt[sel.index] : null;

  const doAct = (fn: Parameters<typeof act>[0]) => {
    act(fn);
    setSel(null);
  };

  return (
    <Modal title="Party and inventory" onClose={onClose}>
      <div class="row spread">
        <div class="tabbar">
          {run.heroes.map((x) => (
            <button class={tab === x.id ? 'selected' : ''} onClick={() => { setTab(x.id); setSel(null); }}>
              {CLASS_ICON[x.cls]} {x.name}
            </button>
          ))}
        </div>
        <div class="row small">
          <span class="badge gold">🪙 {run.gold}</span>
          <span class="badge">✦ {run.essence} essence</span>
          {readOnly && <span class="badge bad">In combat: view only</span>}
        </div>
      </div>

      <div class="row scroll" style={{ alignItems: 'flex-start', gap: '14px', maxHeight: '72vh' }}>
        {/* Character sheet */}
        <div class="col" style={{ flex: 1.15, minWidth: 0 }}>
          <div class="card col" style={{ gap: '6px' }}>
            <div class="row spread">
              <strong>
                {h.name} · Lv {h.level} {RACES[h.race].name} {CLASSES[h.cls].name}
              </strong>
              <span class="small muted">{BACKGROUNDS[h.background].name}</span>
            </div>
            <HpBar hp={h.hp} max={d.maxHp} />
            <XpBar hero={h} />
            <div class="tiny muted">
              XP {h.xp}/{xpToNext(h.level)}
            </div>
            <div class="row wrap">
              {STATS.map((s) => (
                <span class="badge gold">
                  {STAT_LABEL[s]} {d.stats[s]}
                </span>
              ))}
            </div>
            <div class="small muted">
              Damage {d.weapon.damage[0]}–{d.weapon.damage[1]} + {STAT_LABEL[d.weapon.stat]} · Armor {d.armor} · Dodge {d.dodge}% · Crit {d.critChance}% (x{d.critMult.toFixed(2)}) · Status res {d.statusRes}%
              {d.damagePct ? ` · +${d.damagePct}% damage` : ''}
              {d.lifesteal ? ` · ${d.lifesteal}% lifesteal` : ''}
              {d.thorns ? ` · ${d.thorns} thorns` : ''}
            </div>
            <Curses hero={h} />
          </div>

          <div class="slotgrid">
            {EQUIP_SLOTS.map((slot) => {
              const it = h.equipment[slot];
              return (
                <div class={`slot ${it ? `filled rb-${it.rarity}` : ''} ${sel?.kind === 'equip' && sel.slot === slot ? 'card selected' : ''}`} onClick={() => setSel({ kind: 'equip', slot })}>
                  <span class="si">{it ? itemIcon(it) : slotIcon(slot)}</span>
                  {it ? <span class={`r-${it.rarity}`}>{it.name}</span> : <span class="dim">{SLOT_LABEL[slot]}</span>}
                </div>
              );
            })}
            {h.belt.map((s, i) => (
              <div class={`slot ${s ? 'filled' : ''} ${sel?.kind === 'belt' && sel.index === i ? 'card selected' : ''}`} onClick={() => setSel({ kind: 'belt', index: i })}>
                <span class="si">{h.curses.includes('butterfingers') && i === 2 ? '🔒' : s ? CONSUMABLES[s.id].icon : '🧷'}</span>
                <span class="dim">{s ? `${CONSUMABLES[s.id].name} ×${s.qty}` : `Belt ${i + 1}`}</span>
              </div>
            ))}
          </div>

          <div class="card small col" style={{ gap: '4px' }}>
            <strong>Abilities</strong>
            {h.abilities.map((a) => (
              <div>
                {ABILITIES[a].icon} <strong>{ABILITIES[a].name}</strong> <span class="muted">(cooldown {abilityCooldown(a, d)})</span>: {ABILITIES[a].desc}
              </div>
            ))}
            {h.talents.length > 0 && (
              <>
                <strong style={{ marginTop: '4px' }}>Talents</strong>
                <div class="muted">{h.talents.map((t) => TALENTS[t].name).join(', ')}</div>
              </>
            )}
            <div class="tiny dim">
              {RACES[h.race].name}: {RACES[h.race].passive} · {BACKGROUNDS[h.background].name}: {BACKGROUNDS[h.background].perk}
            </div>
          </div>
        </div>

        {/* Bag + selection */}
        <div class="col" style={{ flex: 1, minWidth: 0 }}>
          <strong>Shared bag</strong>
          <div class="slotgrid">
            {run.bag.map((b, i) => (
              <div class={`slot ${b ? `filled ${b.type === 'item' ? `rb-${b.item.rarity}` : ''}` : ''} ${sel?.kind === 'bag' && sel.index === i ? 'card selected' : ''}`} onClick={() => setSel({ kind: 'bag', index: i })}>
                {b?.type === 'item' && (
                  <>
                    <span class="si">{itemIcon(b.item)}</span>
                    <span class={`r-${b.item.rarity}`}>{b.item.name}</span>
                  </>
                )}
                {b?.type === 'consumable' && (
                  <>
                    <span class="si">{CONSUMABLES[b.stack.id].icon}</span>
                    <span>
                      {CONSUMABLES[b.stack.id].name} ×{b.stack.qty}
                    </span>
                  </>
                )}
                {!b && <span class="dim">empty</span>}
              </div>
            ))}
          </div>

          {selBag?.type === 'item' && (
            <ItemCard item={selBag.item}>
              {!readOnly && (
                <div class="row wrap" style={{ marginTop: '8px' }}>
                  {selBag.item.slot === 'trinket' ? (
                    <>
                      <button class="small" onClick={() => doAct((r) => equipFromBag(r, tab, (sel as any).index, 'trinket1'))}>
                        Equip on {h.name} (trinket 1)
                      </button>
                      <button class="small" onClick={() => doAct((r) => equipFromBag(r, tab, (sel as any).index, 'trinket2'))}>
                        (trinket 2)
                      </button>
                    </>
                  ) : (
                    <button class="small" onClick={() => doAct((r) => equipFromBag(r, tab, (sel as any).index))}>
                      Equip on {h.name}
                    </button>
                  )}
                  <button class="small primary" onClick={() => setComparing(true)}>
                    ⚖️ Compare
                  </button>
                  <button class="small" onClick={() => doAct((r) => salvageBag(r, (sel as any).index))}>
                    ✦ Salvage (+{salvageValue(selBag.item)})
                  </button>
                  <button class="small ghost" onClick={() => doAct((r) => discardBag(r, (sel as any).index))}>
                    Drop
                  </button>
                </div>
              )}
              {(() => {
                const slot = selBag.item.slot === 'trinket' ? 'trinket1' : selBag.item.slot;
                const cur = h.equipment[slot as EquipSlot];
                return cur ? <div class="tiny muted" style={{ marginTop: '6px' }}>{h.name} wears: <span class={`r-${cur.rarity}`}>{cur.name}</span> (iLv {cur.power})</div> : null;
              })()}
            </ItemCard>
          )}
          {selBag?.type === 'consumable' && (
            <ConsumableCard stack={selBag.stack}>
              {!readOnly && (
                <div class="row wrap" style={{ marginTop: '8px' }}>
                  <button class="small" onClick={() => doAct((r) => bagToBelt(r, tab, (sel as any).index))}>
                    To {h.name}'s belt
                  </button>
                  {['potion', 'greaterPotion'].includes(selBag.stack.id) && (
                    <button class="small" disabled={h.dead} onClick={() => doAct((r) => drinkOutOfCombat(r, tab, 'bag', (sel as any).index))}>
                      {h.name} drinks
                    </button>
                  )}
                  <button class="small ghost" onClick={() => doAct((r) => discardBag(r, (sel as any).index))}>
                    Drop
                  </button>
                </div>
              )}
            </ConsumableCard>
          )}
          {selEquip && (
            <ItemCard item={selEquip}>
              {!readOnly && (
                <div class="row" style={{ marginTop: '8px' }}>
                  <button class="small" onClick={() => doAct((r) => unequip(r, tab, (sel as any).slot))}>
                    Unequip to bag
                  </button>
                </div>
              )}
            </ItemCard>
          )}
          {selBelt && (
            <ConsumableCard stack={selBelt}>
              {!readOnly && (
                <div class="row" style={{ marginTop: '8px' }}>
                  <button class="small" onClick={() => doAct((r) => beltToBag(r, tab, (sel as any).index))}>
                    Back to bag
                  </button>
                  {['potion', 'greaterPotion'].includes(selBelt.id) && (
                    <button class="small" disabled={h.dead} onClick={() => doAct((r) => drinkOutOfCombat(r, tab, 'belt', (sel as any).index))}>
                      Drink now
                    </button>
                  )}
                </div>
              )}
            </ConsumableCard>
          )}
          {!sel && <div class="small dim">Tap a slot to see the item and what you can do with it. Consumables must be on a belt to use them in combat (minor action).</div>}
        </div>
      </div>
      {comparing && selBag?.type === 'item' && (
        <CompareModal
          item={selBag.item}
          heroes={run.heroes}
          onClose={() => setComparing(false)}
          actions={
            readOnly
              ? undefined
              : (hh, slot) => (
                  <button
                    onClick={() => {
                      const idx = (sel as any).index;
                      setComparing(false);
                      doAct((r) => equipFromBag(r, hh.id, idx, slot));
                    }}
                  >
                    Equip on {hh.name}
                  </button>
                )
          }
        />
      )}
    </Modal>
  );
}
