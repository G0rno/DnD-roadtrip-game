import type { ComponentChildren } from 'preact';
import type { Hero, StatusInstance } from '../../engine/types';
import { STATUSES, CURSES } from '../../engine/data/statuses';
import { CLASSES, RACES, xpToNext } from '../../engine/data/characters';
import { derive } from '../../engine/character';

export const CLASS_ICON: Record<string, string> = { fighter: '🛡️', rogue: '🗡️', mage: '🔮', cleric: '✝️' };
export const ROLE_ICON: Record<string, string> = { brute: '👹', archer: '🏹', caster: '🧙', support: '🕯️', boss: '💀' };
export const NODE_INFO: Record<string, { icon: string; name: string; desc: string }> = {
  fight: { icon: '⚔️', name: 'Fight', desc: 'A band of enemies' },
  elite: { icon: '☠️', name: 'Elite', desc: 'A tougher fight, better loot' },
  event: { icon: '❓', name: 'Event', desc: 'A skill check on the road' },
  rest: { icon: '🔥', name: 'Rest', desc: 'Heal, or use the Forge' },
  shop: { icon: '🪙', name: 'Shop', desc: 'Buy and sell' },
  treasure: { icon: '💰', name: 'Treasure', desc: 'Free loot' },
  boss: { icon: '👑', name: 'Act Boss', desc: 'The lieutenant of this region' },
};
export const STAT_LABEL: Record<string, string> = { might: 'Might', agility: 'Agility', mind: 'Mind', spirit: 'Spirit' };

export function HpBar({ hp, max, shield = 0 }: { hp: number; max: number; shield?: number }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const cls = pct > 60 ? 'ok' : pct > 30 ? 'mid' : '';
  const sh = Math.min(100, (shield / max) * 100);
  return (
    <div class={`bar hp ${cls}`}>
      <div class="fill" style={{ width: `${pct}%` }} />
      {shield > 0 && <div class="shieldfill" style={{ width: `${sh}%` }} />}
      <div class="label">
        {Math.max(0, Math.round(hp))} / {max}
        {shield > 0 ? `  🔰${shield}` : ''}
      </div>
    </div>
  );
}

export function XpBar({ hero }: { hero: Hero }) {
  const need = xpToNext(hero.level);
  return (
    <div class="bar xp" title={`${hero.xp} / ${need} XP`}>
      <div class="fill" style={{ width: `${Math.min(100, (hero.xp / need) * 100)}%` }} />
    </div>
  );
}

export function Statuses({ list }: { list: StatusInstance[] }) {
  if (!list.length) return null;
  return (
    <div class="row wrap" style={{ gap: '4px' }}>
      {list.map((s) => (
        <span class={`badge status ${STATUSES[s.id].harmful ? 'bad' : 'good'}`} title={`${STATUSES[s.id].name}: ${STATUSES[s.id].desc}`}>
          {STATUSES[s.id].icon}
          <span class="tiny">{STATUSES[s.id].name}</span>
          {s.id !== 'shield' && <sub>{s.turns}</sub>}
        </span>
      ))}
    </div>
  );
}

export function Curses({ hero }: { hero: Hero }) {
  if (!hero.curses.length) return null;
  return (
    <div class="row wrap" style={{ gap: '4px' }}>
      {hero.curses.map((c) => (
        <span class="badge bad" title={CURSES[c].desc}>
          ☠ {CURSES[c].name}
        </span>
      ))}
    </div>
  );
}

export function HeroSummary({ hero, children }: { hero: Hero; children?: ComponentChildren }) {
  const d = derive(hero);
  return (
    <div class={`card ${hero.dead ? 'disabled' : ''}`}>
      <div class="row">
        <div class="portrait" style={{ fontSize: '1.8rem' }}>
          {hero.dead ? '💀' : CLASS_ICON[hero.cls]}
        </div>
        <div class="grow col" style={{ gap: '4px' }}>
          <div class="row spread">
            <strong>{hero.name}</strong>
            <span class="muted small">
              Lv {hero.level} {RACES[hero.race].name} {CLASSES[hero.cls].name}
            </span>
          </div>
          <HpBar hp={hero.hp} max={d.maxHp} />
          <XpBar hero={hero} />
        </div>
      </div>
      <Curses hero={hero} />
      {children}
    </div>
  );
}

export function Modal({ children, onClose, title }: { children: ComponentChildren; onClose?: () => void; title?: string }) {
  return (
    <div class="modal-back" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div class="modal panel">
        {(title || onClose) && (
          <div class="row spread">
            <h2>{title}</h2>
            {onClose && (
              <button class="small" onClick={onClose}>
                Close ✕
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
