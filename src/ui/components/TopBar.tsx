import { useGame } from '../store';
import { regionName, NODES_PER_ACT, bagFree } from '../../engine/run';

export function TopBar({ title }: { title?: string }) {
  const { run, openInventory, openMenu } = useGame();
  return (
    <div class="topbar">
      <span class="title">
        Act {run.act} · {regionName(run)}
      </span>
      <span class="muted small">
        Node {Math.min(run.actNode + 1, NODES_PER_ACT + 1)}/{NODES_PER_ACT + 1} · {run.distance * 10} leagues
      </span>
      {title && <span class="badge gold">{title}</span>}
      <span class="grow" />
      <span class="badge gold" title="Gold">
        🪙 {run.gold}
      </span>
      <span class="badge" title="Essence (for the Forge)">
        ✦ {run.essence}
      </span>
      <span class="badge" title="Shared reroll tokens">
        🎲 {run.rerollTokens}
      </span>
      <button class="small" onClick={openInventory}>
        🎒 Bag {run.bag.length - bagFree(run)}/{run.bag.length}
      </button>
      <button class="small" onClick={openMenu}>
        ☰
      </button>
    </div>
  );
}
