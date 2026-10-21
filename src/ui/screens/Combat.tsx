import { useEffect, useRef, useState } from 'preact/hooks';
import type { Enemy, FloatText, Hero, HeroId } from '../../engine/types';
import { useGame } from '../store';
import { TopBar } from '../components/TopBar';
import { HpBar, Statuses, CLASS_ICON, ROLE_ICON, Modal, pct } from '../components/bits';
import { ABILITIES, CLASSES } from '../../engine/data/characters';
import { CONSUMABLES } from '../../engine/data/items';
import { ELITE_MODS, REGIONS } from '../../engine/data/enemies';
import { derive } from '../../engine/character';
import {
  abilityReady,
  attackPreview,
  canMain,
  canMinor,
  endPlayerTurn,
  flee,
  fleeCost,
  heroAbility,
  heroAttack,
  heroSwapRow,
  heroUltimate,
  heroUseConsumable,
  isMeleeAction,
  liveEnemies,
  lockedBeltSlots,
  ultimateCost,
  ultimateReady,
  validEnemyTargets,
  METER_MAX,
} from '../../engine/combat';
import { afterCombatAction } from '../../engine/run';
import { comboText } from './Create';

type Pending = { kind: 'attack' } | { kind: 'ability'; id: string } | { kind: 'ultimate' } | null;

export function Combat() {
  const { run, act } = useGame();
  const c = run.combat!;
  const [actor, setActor] = useState<HeroId>(() => run.heroes.find((h) => canMain(run, h.id).ok)?.id ?? 'p1');
  const [pending, setPending] = useState<Pending>(null);
  const [confirmFlee, setConfirmFlee] = useState(false);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const lastSeq = useRef(c.floatSeq);
  const [enemyTurnBanner, setEnemyTurnBanner] = useState(false);

  // Show new floating numbers for ~1.2s.
  useEffect(() => {
    if (c.floatSeq > lastSeq.current) {
      const fresh = c.floats.filter((f) => f.seq > lastSeq.current);
      lastSeq.current = c.floatSeq;
      setFloats((cur) => [...cur, ...fresh]);
      const t = setTimeout(() => setFloats((cur) => cur.filter((f) => !fresh.includes(f))), 1200);
      return () => clearTimeout(t);
    }
  });

  const hero = run.heroes.find((h) => h.id === actor)!;
  const other = run.heroes.find((h) => h.id !== actor)!;

  const doAct = (fn: () => void) => {
    act((r) => {
      fn();
      afterCombatAction(r);
    });
    setPending(null);
    // Auto-switch to the other hero when this one is done.
    if (run.combat && !canMain(run, actor).ok && canMain(run, other.id).ok) setActor(other.id);
  };

  const endTurn = () => {
    setPending(null);
    setEnemyTurnBanner(true);
    setTimeout(() => setEnemyTurnBanner(false), 900);
    act((r) => {
      endPlayerTurn(r);
      afterCombatAction(r);
    });
    const first = run.heroes.find((h) => !h.dead && canMain(run, h.id).ok);
    if (first) setActor(first.id);
  };

  const melee = pending?.kind === 'attack' ? isMeleeAction(run, actor) : pending?.kind === 'ability' ? isMeleeAction(run, actor, pending.id) : false;
  const enemyTargets =
    pending && (pending.kind === 'attack' || (pending.kind === 'ability' && ABILITIES[pending.id].target === 'enemy'))
      ? validEnemyTargets(run, actor, melee).map((e) => e.uid)
      : [];
  const heroTargeting = pending?.kind === 'ability' && ABILITIES[pending.id].target === 'anyHero';

  const clickEnemy = (e: Enemy) => {
    if (!enemyTargets.includes(e.uid)) return;
    if (pending?.kind === 'attack') doAct(() => heroAttack(run, actor, e.uid));
    else if (pending?.kind === 'ability') doAct(() => heroAbility(run, actor, pending.id, e.uid));
  };
  const clickHero = (h: Hero) => {
    if (heroTargeting && !h.dead && pending?.kind === 'ability') {
      doAct(() => heroAbility(run, actor, pending.id, h.id));
      return;
    }
    if (!h.dead) {
      setActor(h.id);
      setPending(null);
    }
  };

  const chooseAbility = (id: string) => {
    const a = ABILITIES[id];
    if (pending?.kind === 'ability' && pending.id === id && (a.target === 'none' || a.target === 'self' || a.target === 'allEnemies')) {
      doAct(() => heroAbility(run, actor, id));
      return;
    }
    setPending({ kind: 'ability', id });
  };

  const front = c.enemies.filter((e) => e.row === 'front' && !e.dead);
  const back = c.enemies.filter((e) => e.row === 'back' && !e.dead);
  const region = REGIONS[c.regionId];
  const ultCost = ultimateCost(run);

  let info = '';
  if (pending?.kind === 'attack') info = `Attack with ${derive(hero).weapon.name}${melee ? ' (melee: front row only while it stands)' : ''}. Choose a target.`;
  if (pending?.kind === 'ability') {
    const a = ABILITIES[pending.id];
    info = `${a.icon} ${a.name}: ${a.desc}`;
    if (a.target === 'enemy') info += ' Choose an enemy.';
    else if (a.target === 'anyHero') info += ' Choose a hero.';
    else info += ' Tap again to use.';
  }
  if (pending?.kind === 'ultimate') info = `DUO STRIKE: both heroes hit every enemy (can't miss), then heal 20% and cleanse. Tap again to unleash.`;

  return (
    <>
      <TopBar title={c.kind === 'boss' ? 'BOSS' : c.kind === 'elite' ? 'ELITE' : `Round ${c.round}`} />
      <div class="combat">
        <div class="heroes">
          {run.heroes.map((h) => (
            <HeroCard
              hero={h}
              active={h.id === actor}
              targetable={heroTargeting && !h.dead}
              floats={floats.filter((f) => f.targetId === h.id)}
              onClick={() => clickHero(h)}
            />
          ))}
          <div class="panel tight log grow">
            {run.log.slice(-14).map((l) => (
              <div class={`l-${l.kind ?? 'info'}`}>{l.text}</div>
            ))}
          </div>
          <div class="row">
            {c.fleeAllowed && (
              <button onClick={() => setConfirmFlee(true)}>🏃 Flee</button>
            )}
            <button class="primary big grow" onClick={endTurn} disabled={c.phase !== 'players'}>
              ⏭️ End turn
            </button>
          </div>
        </div>

        <div class="combat-info">
          <div class="grow">
            <div class="row spread small">
              <span>
                Team meter {c.teamMeter}/{ultCost}
              </span>
              <span class="muted tiny">{comboText(run.heroes[0].cls, run.heroes[1].cls)}</span>
            </div>
            <div class={`bar meter ${c.teamMeter >= ultCost ? 'full' : ''}`}>
              <div class="fill" style={{ width: `${(c.teamMeter / METER_MAX) * 100}%` }} />
            </div>
            <div class={`small ${info ? 'preview' : 'dim'}`} style={{ minHeight: '28px', marginTop: '6px' }}>
              {info || `${hero.name}: tap Attack or an ability, then a target. Tap a hero card to switch who acts.`}
            </div>
          </div>
        </div>

        <div class="field" style={{ position: 'relative' }}>
          {enemyTurnBanner && <div class="banner" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>Enemy turn</div>}
          <div class="rowcol">
            <div class="rowlabel">Front row</div>
            {front.map((e) => (
              <EnemyCard e={e} run={run} actor={actor} pending={pending} targetable={enemyTargets.includes(e.uid)} floats={floats.filter((f) => f.targetId === e.uid)} onClick={() => clickEnemy(e)} />
            ))}
          </div>
          <div class="rowcol">
            <div class="rowlabel">Back row</div>
            {back.map((e) => (
              <EnemyCard e={e} run={run} actor={actor} pending={pending} targetable={enemyTargets.includes(e.uid)} floats={floats.filter((f) => f.targetId === e.uid)} onClick={() => clickEnemy(e)} />
            ))}
            {back.length === 0 && <div class="dim small center">empty</div>}
          </div>
        </div>

        <div class="actionbar">
          <div class="col" style={{ gap: '2px', justifyContent: 'center', width: '110px' }}>
            <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {CLASS_ICON[hero.cls]} {hero.name}
            </strong>
            <span class="tiny muted">is acting</span>
          </div>
          <button class={`ab ${pending?.kind === 'attack' ? 'selected' : ''}`} disabled={!canMain(run, actor).ok} onClick={() => setPending({ kind: 'attack' })}>
            <span class="ic">⚔️</span>Attack
          </button>
          {hero.abilities.map((id) => {
            const a = ABILITIES[id];
            const ready = abilityReady(run, actor, id);
            const cd = c.heroes[actor].cooldowns[id] ?? 0;
            return (
              <button class={`ab ${pending?.kind === 'ability' && pending.id === id ? 'selected' : ''}`} disabled={!ready.ok} onClick={() => chooseAbility(id)}>
                {cd > 0 && <span class="cd">{cd}</span>}
                <span class="ic">{a.icon}</span>
                {a.name}
              </button>
            );
          })}
          <button
            class={`ab ${pending?.kind === 'ultimate' ? 'selected' : ''} ${ultimateReady(run, actor).ok ? 'primary' : ''}`}
            disabled={!ultimateReady(run, actor).ok}
            onClick={() => (pending?.kind === 'ultimate' ? doAct(() => heroUltimate(run, actor)) : setPending({ kind: 'ultimate' }))}
          >
            <span class="ic">🌟</span>Duo Strike
          </button>
          <div class="sep" />
          {hero.belt.map((s, i) => {
            const locked = lockedBeltSlots(hero).includes(i);
            const disabled = !s || locked || !canMinor(run, actor).ok || (s.id === 'smokeBomb' && !c.fleeAllowed);
            return (
              <button class="ab" disabled={disabled} onClick={() => s && doAct(() => heroUseConsumable(run, actor, i))} title={s ? CONSUMABLES[s.id].desc : ''}>
                <span class="ic">{locked ? '🔒' : s ? CONSUMABLES[s.id].icon : '·'}</span>
                <span class="tiny">{locked ? 'Locked' : s ? `${CONSUMABLES[s.id].name.split(' ').slice(-1)[0]} ×${s.qty}` : 'Empty'}</span>
              </button>
            );
          })}
          <button class="ab" disabled={hero.dead || c.phase !== 'players' || (c.heroes[actor].minorUsed && !hero.talents.includes('t_shadowstep') && !derive(hero).legendaries.has('wanderers'))} onClick={() => doAct(() => heroSwapRow(run, actor))}>
            <span class="ic">↔️</span>Swap row
          </button>
          <div class="sep" />
          {pending && (
            <button class="ab" onClick={() => setPending(null)}>
              <span class="ic">✕</span>Cancel
            </button>
          )}
        </div>
      </div>
      {confirmFlee && (
        <Modal title="Flee this fight?" onClose={() => setConfirmFlee(false)}>
          <div>
            No reward, and it costs {fleeCost(run)} gold{run.gold < fleeCost(run) ? ' (not enough gold: you drop a random item from the bag instead)' : ''}.
          </div>
          <div class="row">
            <button
              class="danger"
              onClick={() => {
                setConfirmFlee(false);
                doAct(() => flee(run));
              }}
            >
              Flee
            </button>
            <button onClick={() => setConfirmFlee(false)}>Stay and fight</button>
          </div>
        </Modal>
      )}
      <div class="tiny dim" style={{ position: 'fixed', bottom: '4px', right: '10px' }}>
        {region.name} · {liveEnemies(run).length} enemies
      </div>
    </>
  );
}

function Floats({ floats }: { floats: FloatText[] }) {
  return (
    <div class="floats">
      {floats.map((f, i) => (
        <div key={f.seq} class={`float ${f.kind}`} style={{ marginLeft: `${(i % 3) * 22 - 22}px` }}>
          {f.text}
        </div>
      ))}
    </div>
  );
}

function HeroCard({ hero, active, targetable, floats, onClick }: { hero: Hero; active: boolean; targetable: boolean; floats: FloatText[]; onClick: () => void }) {
  const { run } = useGame();
  const c = run.combat!;
  const hc = c.heroes[hero.id];
  const d = derive(hero, hc);
  const shield = hc.statuses.find((s) => s.id === 'shield')?.value ?? 0;
  const hit = floats.some((f) => f.kind === 'dmg' || f.kind === 'crit');
  return (
    <div class={`fighter-card ${active ? 'active' : ''} ${targetable ? 'targetable friendly' : ''} ${hero.dead ? 'dead' : ''} ${hit ? 'hit' : ''}`} onClick={onClick}>
      <Floats floats={floats} />
      <div class="row">
        <div class="portrait">{hero.dead ? '💀' : CLASS_ICON[hero.cls]}</div>
        <div class="grow col" style={{ gap: '3px' }}>
          <div class="row spread">
            <span class="name">{hero.name}</span>
            <span class="badge">{hc.row === 'front' ? 'Front' : 'Back'}</span>
          </div>
          <div class="tiny muted">
            Lv {hero.level} {CLASSES[hero.cls].name} · Dodge {d.dodge + hc.dodgeBuff}% · Crit {d.critChance}% · Armor {d.armor}
          </div>
          <HpBar hp={hero.hp} max={d.maxHp} shield={shield} />
        </div>
      </div>
      <div class="row spread" style={{ marginTop: '5px' }}>
        <div class="row" style={{ gap: '6px' }}>
          <div class="pips" title="Main action">
            {Array.from({ length: Math.max(1, hc.mainAllowed) }, (_, i) => (
              <span class={`pip ${i < hc.mainUsed || hc.mainAllowed === 0 ? 'used' : ''}`} />
            ))}
          </div>
          <span class={`pip minor ${hc.minorUsed ? 'used' : ''}`} title="Minor action" />
          {hc.guarding && <span class="badge gold">🛡️ Guarding</span>}
          {hc.vanished && <span class="badge gold">🌫️ Hidden</span>}
        </div>
        <div class="row tiny muted" style={{ gap: '6px' }}>
          {hero.abilities.map((a) => (
            <span title={ABILITIES[a].name}>
              {ABILITIES[a].icon}
              {(hc.cooldowns[a] ?? 0) > 0 ? hc.cooldowns[a] : '✓'}
            </span>
          ))}
        </div>
      </div>
      <Statuses list={hc.statuses} />
    </div>
  );
}

function EnemyCard({ e, run, actor, pending, targetable, floats, onClick }: { e: Enemy; run: any; actor: HeroId; pending: Pending; targetable: boolean; floats: FloatText[]; onClick: () => void }) {
  const shield = e.statuses.find((s) => s.id === 'shield')?.value ?? 0;
  const hit = floats.some((f) => f.kind === 'dmg' || f.kind === 'crit');
  const intent = e.intent;
  const support = intent && (intent.moveId === 'mend' || intent.moveId === 'ward' || intent.target === 'self');
  const targetName = intent && (intent.target === 'all' ? 'everyone' : run.heroes.find((h: Hero) => h.id === intent.target)?.name ?? run.combat.enemies.find((x: Enemy) => x.uid === intent.target)?.name);
  const preview = targetable && pending && pending.kind !== 'ultimate' ? attackPreview(run, actor, e.uid, pending.kind === 'ability' ? pending.id : undefined) : null;
  const frozen = e.statuses.some((s) => s.id === 'frozen');
  return (
    <div class={`fighter-card ${targetable ? 'targetable' : ''} ${hit ? 'hit' : ''}`} onClick={onClick} style={e.boss ? { borderColor: 'var(--r-legendary)' } : undefined}>
      <Floats floats={floats} />
      {intent && (
        <div class={`intent ${support ? 'support' : ''}`}>
          <span>{frozen ? '❄️' : intent.icon}</span>
          <span class="grow">
            {frozen ? 'Frozen: skips its turn' : intent.label}
            {!frozen && targetName && intent.target !== 'self' ? ` → ${intent.target === e.uid ? 'itself' : targetName}` : ''}
          </span>
          {!frozen && intent.amount > 0 && <strong>{support ? `+${intent.amount}` : `≈${intent.amount}`}</strong>}
        </div>
      )}
      <div class="row">
        <div class="portrait">{e.boss ? REGIONS[e.defId.split('.')[0]].boss.icon : ROLE_ICON[e.role]}</div>
        <div class="grow col" style={{ gap: '3px' }}>
          <div class="row spread">
            <span class="name">{e.name}</span>
            <span class="tiny muted">
              {e.boss ? `Phase ${e.phase}` : e.role}
              {e.elite ? ` · ${ELITE_MODS[e.elite].desc}` : ''}
            </span>
          </div>
          <HpBar hp={e.hp} max={e.maxHp} shield={shield} />
          <div class="tiny dim">
            Armor {e.armor} · Dodge {e.dodge}%
          </div>
        </div>
      </div>
      <Statuses list={e.statuses} />
      {preview && (
        <div class="preview">
          Hit {pct(preview.hitChance)} · Crit {pct(preview.critChance)} · {preview.min}–{preview.max} dmg
          {preview.notes.length > 0 && ` · ${preview.notes.join(', ')}`}
        </div>
      )}
    </div>
  );
}
