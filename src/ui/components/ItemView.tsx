import type { ComponentChildren } from 'preact';
import type { ConsumableStack, Item } from '../../engine/types';
import { CONSUMABLES, LEGENDARIES, RARITY_INFO, WEAPONS } from '../../engine/data/items';
import { CLASSES } from '../../engine/data/characters';
import { describeAffix } from '../../engine/items';
import { STAT_LABEL } from './bits';

const SLOT_ICON: Record<string, string> = { weapon: '⚔️', head: '⛑️', chest: '🥋', legs: '👖', feet: '🥾', trinket: '💍' };
const SLOT_NAME: Record<string, string> = { weapon: 'Weapon', head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Feet', trinket: 'Trinket' };

export function slotIcon(slot: string) {
  return SLOT_ICON[slot.replace(/\d/, '')] ?? '•';
}

export function itemIcon(item: Item) {
  if (item.slot === 'weapon') return WEAPONS[item.baseId]?.icon ?? '⚔️';
  return SLOT_ICON[item.slot];
}

export function baseLines(item: Item): string[] {
  const b = item.base;
  const out: string[] = [];
  if (b.damage) out.push(`${b.damage[0]}–${b.damage[1]} damage (${STAT_LABEL[WEAPONS[item.baseId].stat]}, ${WEAPONS[item.baseId].melee ? 'melee' : 'ranged'})`);
  if (b.armor) out.push(`${b.armor} Armor`);
  if (b.dodge) out.push(`${b.dodge > 0 ? '+' : ''}${b.dodge}% dodge`);
  if (b.maxHp) out.push(`+${b.maxHp} max HP`);
  if (b.statusRes) out.push(`+${b.statusRes}% status resistance`);
  if (b.critChance) out.push(`+${b.critChance}% crit chance`);
  return out;
}

export function ItemCard({ item, children, compact, selected, onClick }: { item: Item; children?: ComponentChildren; compact?: boolean; selected?: boolean; onClick?: () => void }) {
  return (
    <div class={`item rb-${item.rarity} ${selected ? 'card selected' : ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div class="row spread">
        <span class={`iname r-${item.rarity}`}>
          {itemIcon(item)} {item.name}
        </span>
        <span class="tiny muted">
          {RARITY_INFO[item.rarity].name} · {SLOT_NAME[item.slot]}
          {item.weight ? ` · ${item.weight}` : ''} · iLv {item.power}
        </span>
      </div>
      {!compact && (
        <>
          <ul>
            {baseLines(item).map((l) => (
              <li class="muted">{l}</li>
            ))}
            {item.affixes.map((a) => (
              <li>{describeAffix(a)}</li>
            ))}
          </ul>
          {item.legendary && <div class="leg">★ {LEGENDARIES[item.legendary].effect}</div>}
          {item.bestFor.length > 0 && <div class="tiny dim">Best for: {item.bestFor.map((c) => CLASSES[c].name).join(', ')}</div>}
        </>
      )}
      {children}
    </div>
  );
}

export function ConsumableCard({ stack, children }: { stack: ConsumableStack; children?: ComponentChildren }) {
  const def = CONSUMABLES[stack.id];
  return (
    <div class="item">
      <div class="row spread">
        <span class="iname">
          {def.icon} {def.name} {stack.qty > 1 ? `×${stack.qty}` : ''}
        </span>
      </div>
      <div class="small muted">{def.desc}</div>
      {children}
    </div>
  );
}
