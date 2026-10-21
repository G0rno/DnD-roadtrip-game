import type { EquipSlot, Hero, Item } from '../../engine/types';
import { compareEquip } from '../../engine/character';
import { LEGENDARIES } from '../../engine/data/items';
import { CLASS_ICON, Modal } from './bits';
import { ItemCard } from './ItemView';
import type { ComponentChildren } from 'preact';

function slotsFor(item: Item): EquipSlot[] {
  return item.slot === 'trinket' ? ['trinket1', 'trinket2'] : [item.slot];
}

function fmt(n: number, unit: string) {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}${unit}`;
}

function HeroCompare({ hero, item, slot }: { hero: Hero; item: Item; slot: EquipSlot }) {
  const { deltas, current } = compareEquip(hero, item, slot);
  const gains = deltas.filter((d) => d.after > d.before);
  const losses = deltas.filter((d) => d.after < d.before);
  const score = gains.length - losses.length;
  return (
    <div class="card col" style={{ gap: '6px' }}>
      <div class="row spread">
        <strong>
          {CLASS_ICON[hero.cls]} {hero.name}
          {slot.startsWith('trinket') ? ` · ${slot === 'trinket1' ? 'Trinket 1' : 'Trinket 2'}` : ''}
        </strong>
        {item.bestFor.includes(hero.cls) && <span class="badge gold">Best for {hero.name}</span>}
      </div>
      <div class="small muted">
        Replaces: {current ? <span class={`r-${current.rarity}`}>{current.name} (iLv {current.power})</span> : 'nothing (empty slot)'}
      </div>
      {deltas.length === 0 && <div class="small dim">No stat change.</div>}
      <div class="col" style={{ gap: '2px' }}>
        {deltas.map((d) => {
          const up = d.after > d.before;
          const diff = d.after - d.before;
          return (
            <div class="row small spread" style={{ color: up ? 'var(--green)' : 'var(--red)' }}>
              <span>{d.label}</span>
              <span>
                {fmt(d.before, d.unit)} → <strong>{fmt(d.after, d.unit)}</strong> ({up ? '+' : ''}
                {fmt(Math.round(diff * 10) / 10, d.unit)})
              </span>
            </div>
          );
        })}
      </div>
      {item.legendary && <div class="small r-legendary">Gains: ★ {LEGENDARIES[item.legendary].effect}</div>}
      {current?.legendary && <div class="small" style={{ color: 'var(--red)' }}>Loses: ★ {LEGENDARIES[current.legendary].effect}</div>}
      <div class="tiny dim">{score > 0 ? 'Mostly an upgrade' : score < 0 ? 'Mostly a downgrade' : deltas.length ? 'A trade-off' : ''}</div>
    </div>
  );
}

/** Side-by-side comparison of a new item against what each hero has equipped. */
export function CompareModal({ item, heroes, onClose, actions }: { item: Item; heroes: Hero[]; onClose: () => void; actions?: (hero: Hero, slot: EquipSlot) => ComponentChildren }) {
  return (
    <Modal title="Compare" onClose={onClose}>
      <div class="row scroll" style={{ alignItems: 'flex-start', gap: '14px', maxHeight: '74vh' }}>
        <div style={{ flex: 0.9, minWidth: 0 }}>
          <div class="small muted" style={{ marginBottom: '6px' }}>New item</div>
          <ItemCard item={item} />
        </div>
        {heroes.map((h) => (
          <div class="col" style={{ flex: 1, minWidth: 0 }}>
            {slotsFor(item).map((slot) => (
              <>
                <HeroCompare hero={h} item={item} slot={slot} />
                {actions?.(h, slot)}
              </>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
