import { useState } from 'preact/hooks';
import { useGame } from '../store';
import { TopBar } from '../components/TopBar';
import { HeroSummary } from '../components/bits';
import { ItemCard } from '../components/ItemView';
import { canRevive, revive, reviveCosts, reviveFree, reviveItemOptions, skipRevive } from '../../engine/run';
import { RARITY_INFO } from '../../engine/data/items';

export function Revive() {
  const { run, act } = useGame();
  const fallen = run.heroes.find((h) => h.dead)!;
  const helper = run.heroes.find((h) => h.id !== fallen.id)!;
  const c = reviveCosts(run, fallen.id);
  const [pickItem, setPickItem] = useState(false);
  const items = reviveItemOptions(run, fallen.id);

  return (
    <>
      <TopBar title="Revive" />
      <div class="screen">
        <h2>💀 {fallen.name} has fallen</h2>
        <div class="muted">
          Bring them back now. Each revive this run costs more than the last (revives so far: {run.reviveCount}).
        </div>
        <div class="grid2">
          <HeroSummary hero={fallen} />
          <HeroSummary hero={helper} />
        </div>
        <div class="grid3 grow" style={{ alignContent: 'start' }}>
          {reviveFree(run) && (
            <button class="node-card primary" onClick={() => act((r) => revive(r, fallen.id, 'free'))}>
              <span class="icon">🙏</span>
              <strong>Acolyte's prayer</strong>
              <span class="small">The first revive of the run is free.</span>
            </button>
          )}
          <button class="node-card" disabled={!canRevive(run, fallen.id, 'gold')} onClick={() => act((r) => revive(r, fallen.id, 'gold'))}>
            <span class="icon">🪙</span>
            <strong>Pay {c.gold} gold</strong>
            <span class="small">A healer on the road.</span>
          </button>
          <button class="node-card" disabled={!canRevive(run, fallen.id, 'xp')} onClick={() => act((r) => revive(r, fallen.id, 'xp'))}>
            <span class="icon">📉</span>
            <strong>Lose {c.xp} XP</strong>
            <span class="small">{fallen.name} loses progress toward the next level (never a level).</span>
          </button>
          <button class="node-card" disabled={!canRevive(run, fallen.id, 'hp')} onClick={() => act((r) => revive(r, fallen.id, 'hp'))}>
            <span class="icon">🩸</span>
            <strong>{helper.name} gives {c.hp} HP</strong>
            <span class="small">{c.hpPct}% of {helper.name}'s max HP.</span>
          </button>
          <button class="node-card" disabled={!canRevive(run, fallen.id, 'item')} onClick={() => setPickItem(true)}>
            <span class="icon">💎</span>
            <strong>Sacrifice an item</strong>
            <span class="small">{RARITY_INFO[c.minRarity].name} or better, from the bag.</span>
          </button>
          <button class="node-card" disabled>
            <span class="icon">🗺️</span>
            <strong>Revive adventure</strong>
            <span class="small">A short solo quest. Arrives with the AI Game Master (Phase 4).</span>
          </button>
        </div>
        {pickItem && (
          <div class="col">
            <strong>Pick the item to sacrifice</strong>
            <div class="grid3">
              {items.map((o) => (
                <ItemCard item={o.item} compact onClick={() => act((r) => revive(r, fallen.id, 'item', o.index))} />
              ))}
            </div>
          </div>
        )}
        <div class="row spread">
          <span class="small muted">The revived hero comes back at 50% HP.</span>
          <button class="big" onClick={() => act(skipRevive)}>
            Not now (continue alone) →
          </button>
        </div>
      </div>
    </>
  );
}
