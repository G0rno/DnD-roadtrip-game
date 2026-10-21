import { useEffect, useRef, useState } from 'preact/hooks';
import type { CombatState, Enemy, FloatText, Hero, HeroId, Run } from '../../engine/types';
import { useGame } from '../store';
import { TopBar } from '../components/TopBar';
import { Modal, pct, CLASS_ICON } from '../components/bits';
import { Sprite } from '../components/Sprite';
import { Backdrop } from '../components/Backdrop';
import { ABILITIES, CLASSES } from '../../engine/data/characters';
import { CONSUMABLES } from '../../engine/data/items';
import { ELITE_MODS, REGIONS } from '../../engine/data/enemies';
import { STATUSES } from '../../engine/data/statuses';
import { derive } from '../../engine/character';
import { enemyLook, defaultLook, SPRITES } from '../sprites';
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
  lockedBeltSlots,
  ultimateCost,
  ultimateReady,
  validEnemyTargets,
  METER_MAX,
} from '../../engine/combat';
import { afterCombatAction } from '../../engine/run';
import { comboText } from './Create';
import { voice } from '../../audio/voice';
import { combatEventSegments, roundSegments } from '../../audio/narrate';
import { useSay } from '../useVoice';

type Pending = { kind: 'attack' } | { kind: 'ability'; id: string } | { kind: 'ultimate' } | null;

const isHeroId = (x: string | null): x is HeroId => x === 'p1' || x === 'p2';

/** HP still to be "played" for a combatant: damage not yet shown is added back, heals subtracted. */
function pendingDelta(c: CombatState, id: string, shownEv: number) {
  let d = 0;
  for (const f of c.floats) {
    if (f.targetId !== id || (f.ev ?? 0) <= shownEv) continue;
    if (f.kind === 'dmg' || f.kind === 'crit') d += f.amount ?? 0;
    if (f.kind === 'heal') d -= f.amount ?? 0;
  }
  return d;
}

export function Combat() {
  const { run, act, settings } = useGame();
  const c = run.combat!;
  const [actor, setActor] = useState<HeroId>(() => run.heroes.find((h) => canMain(run, h.id).ok)?.id ?? 'p1');
  const [pending, setPending] = useState<Pending>(null);
  const [confirmFlee, setConfirmFlee] = useState(false);
  const [showLog, setShowLog] = useState(false);

  // ----- Step-by-step playback of combat events -----
  const evTotal = c.evSeq ?? 0;
  const [shownEv, setShownEv] = useState(() => (c.round <= 1 && c.enemiesFirst ? 0 : evTotal));
  const [lunge, setLunge] = useState<string | null>(null);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const lastFloat = useRef(Math.max(0, ...c.floats.filter((f) => (f.ev ?? 0) <= shownEv).map((f) => f.seq)));
  const playing = shownEv < evTotal;
  const fast = settings.fastCombat;

  // Show floats that belong to events already played.
  useEffect(() => {
    const fresh = c.floats.filter((f) => f.seq > lastFloat.current && (f.ev ?? 0) <= shownEv);
    if (!fresh.length) return;
    lastFloat.current = Math.max(...fresh.map((f) => f.seq));
    setFloats((cur) => [...cur, ...fresh]);
    const t = setTimeout(() => setFloats((cur) => cur.filter((f) => !fresh.includes(f))), 1150);
    return () => clearTimeout(t);
  }, [shownEv, c.floatSeq]);

  // Advance playback one event at a time. With narration on, the next action waits until
  // the previous one has been read aloud, so the driver hears every action in order.
  const gate = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (shownEv >= evTotal) return;
    const next = (c.events ?? []).find((e) => e.seq > shownEv);
    if (!next) {
      setShownEv(evTotal);
      return;
    }
    const heroEvent = isHeroId(next.actor);
    const delay = heroEvent ? 40 : fast ? 260 : 620;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    gate.current.then(() => {
      if (cancelled) return;
      t = setTimeout(() => {
        if (cancelled) return;
        setShownEv(next.seq);
        setLunge(next.actor);
        if (!heroEvent && next.actor) {
          const e = c.enemies.find((x) => x.uid === next.actor);
          setBanner(e ? `${e.name}: ${next.label}` : next.label);
        } else if (!next.actor) setBanner(next.label);
        setTimeout(() => setLunge(null), 260);
        gate.current = voice.speak(combatEventSegments(run, next, c.floats), { interrupt: heroEvent });
      }, delay);
    });
    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
    };
  }, [shownEv, evTotal]);

  // Start of the heroes' turn: HP and what each enemy is about to do.
  useSay(!playing && c.phase === 'players' ? `round:${run.seed}:${run.distance}:${c.round}` : null, () => roundSegments(run), false);

  // When playback is done and the fight is over, move on.
  useEffect(() => {
    if (playing) return;
    if (c.phase === 'won' || c.phase === 'lost' || c.phase === 'fled') {
      setBanner(c.phase === 'won' ? 'Victory!' : c.phase === 'lost' ? 'The party falls...' : 'You escape!');
      const t = setTimeout(() => act(afterCombatAction), c.phase === 'fled' ? 500 : 1100);
      return () => clearTimeout(t);
    }
    if (c.phase === 'players') {
      const t = setTimeout(() => setBanner(null), 500);
      return () => clearTimeout(t);
    }
  }, [playing, c.phase]);

  const hero = run.heroes.find((h) => h.id === actor)!;
  const other = run.heroes.find((h) => h.id !== actor)!;
  const busy = playing || c.phase !== 'players';

  const doAct = (fn: () => void) => {
    if (busy) return;
    act(() => fn());
    setPending(null);
    if (run.combat && !canMain(run, actor).ok && canMain(run, other.id).ok) setActor(other.id);
  };

  const endTurn = () => {
    if (busy) return;
    setPending(null);
    setBanner('Enemy turn');
    act((r) => endPlayerTurn(r));
    const first = run.heroes.find((h) => !h.dead && canMain(run, h.id).ok);
    if (first) setActor(first.id);
  };

  const melee = pending?.kind === 'attack' ? isMeleeAction(run, actor) : pending?.kind === 'ability' ? isMeleeAction(run, actor, pending.id) : false;
  const enemyTargets =
    !busy && pending && (pending.kind === 'attack' || (pending.kind === 'ability' && ABILITIES[pending.id].target === 'enemy'))
      ? validEnemyTargets(run, actor, melee).map((e) => e.uid)
      : [];
  const heroTargeting = !busy && pending?.kind === 'ability' && ABILITIES[pending.id].target === 'anyHero';

  const tapEnemy = (e: Enemy) => {
    if (!enemyTargets.includes(e.uid)) return;
    if (pending?.kind === 'attack') doAct(() => heroAttack(run, actor, e.uid));
    else if (pending?.kind === 'ability') doAct(() => heroAbility(run, actor, pending.id, e.uid));
  };
  const tapHero = (h: Hero) => {
    if (heroTargeting && !h.dead && pending?.kind === 'ability') {
      doAct(() => heroAbility(run, actor, pending.id, h.id));
      return;
    }
    if (!h.dead) {
      setActor(h.id);
      setPending(null);
    }
  };

  const ultCost = ultimateCost(run);

  // ----- Positions on the battlefield -----
  const visibleEnemies = c.enemies.filter((e) => !e.dead || pendingDelta(c, e.uid, shownEv) !== 0 || floats.some((f) => f.targetId === e.uid));
  const placed: { id: string; x: number; y: number }[] = [];
  const place = (ids: string[], baseX: number, dir: number) => {
    const n = ids.length;
    ids.forEach((id, i) => {
      const y = n === 1 ? 80 : 58 + (i * 34) / Math.max(1, n - 1);
      const x = baseX + (n > 1 ? (i % 2 === 0 ? -1 : 1) * 3.2 * dir : 0);
      placed.push({ id, x, y });
    });
  };
  place(run.heroes.filter((h) => c.heroes[h.id].row === 'back').map((h) => h.id), 20, 1);
  place(run.heroes.filter((h) => c.heroes[h.id].row === 'front').map((h) => h.id), 37, 1);
  place(visibleEnemies.filter((e) => e.row === 'front').map((e) => e.uid), 63, -1);
  place(visibleEnemies.filter((e) => e.row === 'back').map((e) => e.uid), 81, -1);
  const pos = (id: string) => placed.find((p) => p.id === id) ?? { x: 50, y: 80 };

  // ----- Action detail -----
  let detailTitle = `${hero.name}'s turn`;
  let detailText = 'Pick an action below, then a target on the battlefield. Tap a hero to switch who acts.';
  let needsConfirm = false;
  if (pending?.kind === 'attack') {
    detailTitle = '⚔️ Attack';
    detailText = `Strike with ${derive(hero).weapon.name}.${melee ? ' Melee: front row only while it stands.' : ''} Tap a target.`;
  } else if (pending?.kind === 'ability') {
    const a = ABILITIES[pending.id];
    detailTitle = `${a.icon} ${a.name}`;
    detailText = a.desc + (a.target === 'enemy' ? ' Tap an enemy.' : a.target === 'anyHero' ? ' Tap a hero.' : '');
    needsConfirm = a.target === 'none' || a.target === 'self' || a.target === 'allEnemies';
  } else if (pending?.kind === 'ultimate') {
    detailTitle = '🌟 Duo Strike';
    detailText = "Both heroes hit every enemy (can't miss), then heal 20% and cleanse.";
    needsConfirm = true;
  } else if (hero.dead) {
    detailTitle = `${hero.name} has fallen`;
    detailText = 'Tap the other hero.';
  }

  const confirm = () => {
    if (pending?.kind === 'ability') doAct(() => heroAbility(run, actor, pending.id));
    if (pending?.kind === 'ultimate') doAct(() => heroUltimate(run, actor));
  };

  const swapFree = hero.talents.includes('t_shadowstep') || derive(hero).legendaries.has('wanderers');

  return (
    <>
      <TopBar title={c.kind === 'boss' ? 'BOSS' : c.kind === 'elite' ? 'ELITE' : `Round ${c.round}`} />
      <div class="scene">
        <Backdrop region={c.regionId} night={run.isNight || c.regionId === 'underdark'} />

        <div class="ticker" style={{ visibility: playing ? 'hidden' : 'visible' }}>
          {run.log.slice(-3).map((l) => (
            <div class={`l-${l.kind ?? 'info'}`}>{l.text}</div>
          ))}
        </div>
        <button class="small logbtn" onClick={() => setShowLog(true)}>
          📜 Log
        </button>
        {banner && <div class="scene-banner">{banner}</div>}

        {run.heroes.map((h) => {
          const p = pos(h.id);
          const hc = c.heroes[h.id];
          const d = derive(h, hc);
          const hp = Math.min(d.maxHp, Math.max(0, h.hp + pendingDelta(c, h.id, shownEv)));
          const shield = hc.statuses.find((s) => s.id === 'shield')?.value ?? 0;
          const myFloats = floats.filter((f) => f.targetId === h.id);
          const hit = myFloats.some((f) => f.kind === 'dmg' || f.kind === 'crit');
          const dead = h.dead && hp <= 0;
          return (
            <div
              class={`unit ${lunge === h.id ? 'lunge-r' : ''} ${hit ? 'shake' : ''} ${dead ? 'fallen' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: Math.round(p.y) }}
              onClick={() => tapHero(h)}
            >
              <Plate name={h.name} sub={`Lv ${h.level} ${CLASSES[h.cls].name}`} hp={hp} max={d.maxHp} shield={shield} statuses={hc.statuses} active={h.id === actor && !busy} />
              <div class="badges">
                {hc.guarding && <span class="badge gold">🛡️ Guard</span>}
                {hc.vanished && <span class="badge gold">🌫️ Hidden</span>}
              </div>
              <div class={`feet ${h.id === actor && !busy ? 'sel' : ''} ${heroTargeting && !h.dead ? 'friendly' : ''}`} />
              {dead ? <div class="grave">🪦</div> : <Sprite name={h.look ?? defaultLook(h.cls)} scale={5} />}
              <Floats floats={myFloats} />
            </div>
          );
        })}

        {visibleEnemies.map((e) => {
          const p = pos(e.uid);
          const look = enemyLook(e);
          const big = SPRITES[look.sprite]?.w > 16;
          const scale = e.boss ? 5.5 : big ? 3.8 : 4.6;
          const hp = Math.min(e.maxHp, Math.max(0, e.hp + pendingDelta(c, e.uid, shownEv)));
          const myFloats = floats.filter((f) => f.targetId === e.uid);
          const hit = myFloats.some((f) => f.kind === 'dmg' || f.kind === 'crit');
          const targetable = enemyTargets.includes(e.uid);
          const preview = targetable && pending && pending.kind !== 'ultimate' ? attackPreview(run, actor, e.uid, pending.kind === 'ability' ? pending.id : undefined) : null;
          const shield = e.statuses.find((s) => s.id === 'shield')?.value ?? 0;
          const frozen = e.statuses.some((s) => s.id === 'frozen');
          const fading = e.dead && hp <= 0;
          return (
            <div
              class={`unit ${lunge === e.uid ? 'lunge-l' : ''} ${hit ? 'shake' : ''} ${fading ? 'dying' : ''} ${targetable ? 'targetable' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, zIndex: Math.round(p.y) }}
              onClick={() => tapEnemy(e)}
            >
              {!busy && !e.dead && e.intent && <IntentChip run={run} e={e} frozen={frozen} />}
              <Plate
                name={e.name}
                sub={e.boss ? `Boss · phase ${e.phase}` : e.elite ? `Elite · ${ELITE_MODS[e.elite].name}` : e.role}
                hp={hp}
                max={e.maxHp}
                shield={shield}
                statuses={e.statuses}
                boss={e.boss}
                elite={!!e.elite}
              />
              {preview && (
                <div class="odds">
                  🎯 {pct(preview.hitChance)} · 💥 {pct(preview.critChance)} · {preview.min}–{preview.max}
                  {preview.notes.length ? ` · ${preview.notes.join(', ')}` : ''}
                </div>
              )}
              <div class={`feet ${targetable ? 'target' : ''}`} />
              <Sprite name={look.sprite} scale={scale} flip filter={[look.filter, e.elite ? 'drop-shadow(0 0 4px #f29a3c)' : ''].filter(Boolean).join(' ') || undefined} />
              <Floats floats={myFloats} />
            </div>
          );
        })}
      </div>

      {/* Bottom panel: party, actions, details */}
      <div class="bpanel">
        <div class="col" style={{ gap: '6px' }}>
          {run.heroes.map((h) => {
            const hc = c.heroes[h.id];
            const d = derive(h, hc);
            const hp = Math.min(d.maxHp, Math.max(0, h.hp + pendingDelta(c, h.id, shownEv)));
            return (
              <div class={`partyrow ${h.id === actor ? 'active' : ''} ${h.dead ? 'disabled' : ''}`} onClick={() => tapHero(h)}>
                <div class="row spread small">
                  <strong>
                    {CLASS_ICON[h.cls]} {h.name}
                  </strong>
                  <span class="row" style={{ gap: '5px' }}>
                    {Array.from({ length: Math.max(1, hc.mainAllowed) }, (_, i) => (
                      <span class={`pip ${i < hc.mainUsed || hc.mainAllowed === 0 ? 'used' : ''}`} title="Main action" />
                    ))}
                    <span class={`pip minor ${hc.minorUsed ? 'used' : ''}`} title="Minor action" />
                  </span>
                </div>
                <MiniHp hp={hp} max={d.maxHp} />
              </div>
            );
          })}
          <div class="small row spread">
            <span>
              Team meter {c.teamMeter}/{ultCost}
            </span>
          </div>
          <div class={`bar meter ${c.teamMeter >= ultCost ? 'full' : ''}`}>
            <div class="fill" style={{ width: `${(c.teamMeter / METER_MAX) * 100}%` }} />
          </div>
        </div>

        <div class="actgrid">
          <button class={`act ${pending?.kind === 'attack' ? 'selected' : ''}`} disabled={busy || !canMain(run, actor).ok} onClick={() => setPending({ kind: 'attack' })}>
            <span>⚔️ Attack</span>
          </button>
          {hero.abilities.map((id) => {
            const a = ABILITIES[id];
            const ready = abilityReady(run, actor, id);
            const cd = c.heroes[actor].cooldowns[id] ?? 0;
            return (
              <button class={`act ${pending?.kind === 'ability' && pending.id === id ? 'selected' : ''}`} disabled={busy || !ready.ok} onClick={() => setPending({ kind: 'ability', id })}>
                <span>
                  {a.icon} {a.name}
                </span>
                <span class={cd > 0 ? 'cdb' : 'ready'}>{cd > 0 ? cd : '●'}</span>
              </button>
            );
          })}
          <button class={`act ${pending?.kind === 'ultimate' ? 'selected' : ''} ${ultimateReady(run, actor).ok ? 'glow' : ''}`} disabled={busy || !ultimateReady(run, actor).ok} onClick={() => setPending({ kind: 'ultimate' })}>
            <span>🌟 Duo Strike</span>
          </button>
        </div>

        <div class="detail">
          <div class="row spread">
            <strong class="dtitle">{detailTitle}</strong>
            {pending && (
              <button class="small ghost" onClick={() => setPending(null)}>
                ✕ Cancel
              </button>
            )}
          </div>
          <div class="small dtext">{detailText}</div>
          {needsConfirm && (
            <button class="primary" disabled={busy} onClick={confirm}>
              Use {pending?.kind === 'ultimate' ? 'Duo Strike' : pending?.kind === 'ability' ? ABILITIES[pending.id].name : ''}
            </button>
          )}
          {!pending && <div class="tiny dim">{comboText(run.heroes[0].cls, run.heroes[1].cls)}</div>}
          <div class="grow" />
          <div class="row" style={{ gap: '6px' }}>
            {hero.belt.map((s, i) => {
              const locked = lockedBeltSlots(hero).includes(i);
              const disabled = busy || !s || locked || !canMinor(run, actor).ok || (s.id === 'smokeBomb' && !c.fleeAllowed);
              return (
                <button class="small belt" disabled={disabled} onClick={() => s && doAct(() => heroUseConsumable(run, actor, i))} title={s ? CONSUMABLES[s.id].desc : ''}>
                  {locked ? '🔒' : s ? `${CONSUMABLES[s.id].icon}×${s.qty}` : '·'}
                </button>
              );
            })}
            <button class="small" disabled={busy || hero.dead || (c.heroes[actor].minorUsed && !swapFree)} onClick={() => doAct(() => heroSwapRow(run, actor))}>
              ↔️ Row
            </button>
            <span class="grow" />
            {c.fleeAllowed && (
              <button class="small" disabled={busy} onClick={() => setConfirmFlee(true)}>
                🏃 Flee
              </button>
            )}
            <button class="primary" style={{ minWidth: '150px' }} disabled={busy} onClick={endTurn}>
              ⏭️ End turn
            </button>
          </div>
        </div>
      </div>

      {showLog && (
        <Modal title="Combat log" onClose={() => setShowLog(false)}>
          <div class="log scroll" style={{ maxHeight: '65vh', fontSize: '0.95rem' }}>
            {run.log.map((l) => (
              <div class={`l-${l.kind ?? 'info'}`}>{l.text}</div>
            ))}
          </div>
        </Modal>
      )}
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
      <div class="tiny dim" style={{ position: 'fixed', bottom: '2px', right: '10px', pointerEvents: 'none' }}>
        {REGIONS[c.regionId].name}
      </div>
    </>
  );
}

function MiniHp({ hp, max, shield = 0 }: { hp: number; max: number; shield?: number }) {
  const p = Math.max(0, Math.min(100, (hp / max) * 100));
  const cls = p > 60 ? 'ok' : p > 30 ? 'mid' : '';
  return (
    <div class={`bar hp slim ${cls}`}>
      <div class="fill" style={{ width: `${p}%` }} />
      {shield > 0 && <div class="shieldfill" style={{ width: `${Math.min(100, (shield / max) * 100)}%` }} />}
      <div class="label">
        {Math.round(hp)}/{max}
        {shield > 0 ? ` 🔰${shield}` : ''}
      </div>
    </div>
  );
}

function Plate({ name, sub, hp, max, shield, statuses, active, boss, elite }: { name: string; sub: string; hp: number; max: number; shield: number; statuses: { id: keyof typeof STATUSES; turns: number }[]; active?: boolean; boss?: boolean; elite?: boolean }) {
  return (
    <div class={`plate ${active ? 'active' : ''} ${boss ? 'boss' : ''} ${elite ? 'elite' : ''}`}>
      <div class="pname">
        <span>{name}</span>
        <span class="psub">{sub}</span>
      </div>
      <MiniHp hp={hp} max={max} shield={shield} />
      {statuses.length > 0 && (
        <div class="pstat">
          {statuses.map((s) => (
            <span class={STATUSES[s.id].harmful ? 'bad' : 'good'} title={`${STATUSES[s.id].name}: ${STATUSES[s.id].desc}`}>
              {STATUSES[s.id].icon}
              {s.id !== 'shield' && <sub>{s.turns}</sub>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function IntentChip({ run, e, frozen }: { run: Run; e: Enemy; frozen: boolean }) {
  const it = e.intent!;
  if (frozen) return <div class="ichip support">❄️ Frozen: skips turn</div>;
  const support = it.moveId === 'mend' || it.moveId === 'ward' || it.target === 'self' || run.combat!.enemies.some((x) => x.uid === it.target);
  const target = it.target === 'all' ? 'all' : run.heroes.find((h) => h.id === it.target)?.name ?? (it.target === e.uid ? 'self' : run.combat!.enemies.find((x) => x.uid === it.target)?.name);
  return (
    <div class={`ichip ${support ? 'support' : ''}`}>
      {it.icon} {it.label}
      {it.amount > 0 && <strong> {support ? `+${it.amount}` : it.amount}</strong>}
      {target && it.target !== 'self' && <span class="muted"> → {target}</span>}
    </div>
  );
}

function Floats({ floats }: { floats: FloatText[] }) {
  return (
    <div class="floats">
      {floats.map((f, i) => (
        <div key={f.seq} class={`float ${f.kind}`} style={{ marginLeft: `${(i % 3) * 20 - 20}px` }}>
          {f.text}
        </div>
      ))}
    </div>
  );
}
