import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Run } from '../engine/types';
import { loadSettings, recordRunEnd, saveRun, saveSettings, type Settings } from '../engine/save';
import { GameCtx, type Game } from './store';
import { Title } from './screens/Title';
import { Create } from './screens/Create';
import { Hub } from './screens/Hub';
import { Combat } from './screens/Combat';
import { Loot } from './screens/Loot';
import { Inventory } from './screens/Inventory';
import { Shop } from './screens/Shop';
import { Rest } from './screens/Rest';
import { EventScreen } from './screens/Event';
import { Revive } from './screens/Revive';
import { LevelUp } from './screens/LevelUp';
import { Wipe, End } from './screens/Notices';
import { Menu } from './screens/Menu';

export function App() {
  const [run, setRun] = useState<Run | null>(null);
  const [, setVersion] = useState(0);
  const [settings, setSettingsState] = useState<Settings>(loadSettings());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Record finished runs in the hall of fame once.
  useEffect(() => {
    if (run && (run.screen === 'victory' || run.screen === 'gameover') && !run.recorded) {
      recordRunEnd(run, run.screen === 'victory' ? 'victory' : 'wipe');
      run.recorded = true;
      saveRun(run);
    }
  });

  const game: Game | null = useMemo(() => {
    if (!run) return null;
    return {
      run,
      act: (fn) => {
        try {
          fn(run);
        } catch (e) {
          console.error(e);
          setToastMsg(`Something went wrong: ${(e as Error).message}`);
        }
        if (!saveRun(run)) setToastMsg('Could not save on this device. Export a backup soon.');
        setVersion((v) => v + 1);
      },
      quit: () => {
        saveRun(run);
        setRun(null);
        setShowInventory(false);
        setShowMenu(false);
      },
      settings,
      setSettings: (s) => {
        setSettingsState(s);
        saveSettings(s);
      },
      toast: setToastMsg,
      openInventory: () => setShowInventory(true),
      openMenu: () => setShowMenu(true),
    };
  }, [run, settings]);

  let screen;
  if (!run || !game) {
    screen = <Title onOpen={(r) => setRun(r)} settings={settings} setSettings={(s) => { setSettingsState(s); saveSettings(s); }} toast={setToastMsg} />;
  } else {
    switch (run.screen) {
      case 'create': screen = <Create />; break;
      case 'hub': screen = <Hub />; break;
      case 'combat': screen = <Combat />; break;
      case 'loot': screen = <Loot />; break;
      case 'shop': screen = <Shop />; break;
      case 'rest': screen = <Rest />; break;
      case 'event': screen = <EventScreen />; break;
      case 'revive': screen = <Revive />; break;
      case 'levelup': screen = <LevelUp />; break;
      case 'wipe': screen = <Wipe />; break;
      case 'victory':
      case 'gameover': screen = <End />; break;
      default: screen = <Hub />;
    }
  }

  return (
    <div class={`app ${settings.nightMode ? 'night' : ''}`}>
      {game ? (
        <GameCtx.Provider value={game}>
          {screen}
          {showInventory && <Inventory onClose={() => setShowInventory(false)} />}
          {showMenu && <Menu onClose={() => setShowMenu(false)} />}
        </GameCtx.Provider>
      ) : (
        screen
      )}
      {toastMsg && <div class="toast">{toastMsg}</div>}
      <div class="rotate">Turn the iPad sideways to play.</div>
    </div>
  );
}
