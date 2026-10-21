import { useGame } from '../store';
import { TopBar } from '../components/TopBar';
import { ItemCard, ConsumableCard } from '../components/ItemView';
import { bagFree, buyPrice, leaveShop, shopBuy, shopReroll, shopRerollCost, shopSell } from '../../engine/run';
import { sellValue } from '../../engine/items';
import { CONSUMABLES } from '../../engine/data/items';

export function Shop() {
  const { run, act, openInventory } = useGame();
  const shop = run.shop!;
  return (
    <>
      <TopBar title="Shop" />
      <div class="screen">
        <div class="row spread">
          <h2>🪙 A traveling merchant</h2>
          <div class="row">
            <button disabled={shop.rerolled || run.gold < shopRerollCost(run)} onClick={() => act(shopReroll)}>
              🔄 New stock ({shopRerollCost(run)} gold){shop.rerolled ? ' · used' : ''}
            </button>
          </div>
        </div>
        <div class="row grow" style={{ alignItems: 'stretch', minHeight: 0, gap: '14px' }}>
          <div class="col scroll" style={{ flex: 1.4 }}>
            <strong>For sale</strong>
            <div class="grid2">
              {shop.stock.map((entry, i) => {
                if (!entry) return <div class="item dim center">Sold</div>;
                const price = buyPrice(run, entry, i);
                const btn = (
                  <button class="small primary" style={{ marginTop: '6px' }} disabled={run.gold < price || bagFree(run) === 0} onClick={() => act((r) => shopBuy(r, i))}>
                    Buy for {price} gold
                  </button>
                );
                return 'uid' in entry ? <ItemCard item={entry}>{btn}</ItemCard> : <ConsumableCard stack={entry}>{btn}</ConsumableCard>;
              })}
            </div>
          </div>
          <div class="col scroll" style={{ flex: 1 }}>
            <strong>Sell from the bag (25% of value)</strong>
            {run.bag.every((b) => !b) && <div class="muted small">The bag is empty.</div>}
            {run.bag.map((b, i) => {
              if (!b) return null;
              const value = b.type === 'item' ? sellValue(b.item) : Math.max(1, Math.round(CONSUMABLES[b.stack.id].price * 0.25)) * b.stack.qty;
              const btn = (
                <button class="small" style={{ marginTop: '6px' }} onClick={() => act((r) => shopSell(r, i))}>
                  Sell for {value} gold
                </button>
              );
              return b.type === 'item' ? <ItemCard item={b.item} compact>{btn}</ItemCard> : <ConsumableCard stack={b.stack}>{btn}</ConsumableCard>;
            })}
          </div>
        </div>
        <div class="row spread">
          <button onClick={openInventory}>🎒 Inventory</button>
          <button class="primary big" onClick={() => act(leaveShop)}>
            Leave the shop →
          </button>
        </div>
      </div>
    </>
  );
}
