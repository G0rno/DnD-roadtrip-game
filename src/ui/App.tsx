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
import { Scene } from './screens/Scene';
import { Journal } from './screens/Journal';
import { SettingsModal } from './screens/Settings';
import { Modal } from './components/bits';
import { genRecap } from '../ai/gm';
import { story } from '../engine/story';

export function App() {
  const [run, setRun] = useState<Run | null>(null);
  const [, setVersion] = useState(0);
  const [settings, setSettingsState] = useState<Settings>(loadSettings());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [recap, setRecap] = useState<string | null>(null);
  const [warned, setWarned] = useState(false);

  const openRun = (r: Run, resumed: boolean) => {
    setRun(r);
    setWarned(false);
    if (resumed && r.narrate && r.story?.journal.length) {
      setRecap('...');
      genRecap(r).then((t) => setRecap(t || null));
    }
  };

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
        if (!warned && run.story && run.story.cost.usd > settings.budgetWarnUsd) {
          setWarned(true);
          setToastMsg(`AI cost for this run passed $${settings.budgetWarnUsd}. Budget mode is in Settings.`);
        }
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
      openJournal: () => setShowJournal(true),
      openSettings: () => setShowSettings(true),
    };
  }, [run, settings, warned]);

  let screen;
  if (!run || !game) {
    screen = <Title onOpen={openRun} settings={settings} setSettings={(s) => { setSettingsState(s); saveSettings(s); }} toast={setToastMsg} openSettings={() => setShowSettings(true)} />;
  } else {
    switch (run.screen) {
      case 'create': screen = <Create />; break;
      case 'scene': screen = run.scene ? <Scene /> : <Hub />; break;
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
          {showJournal && <Journal onClose={() => setShowJournal(false)} />}
          {recap && (
            <Modal title="Previously..." onClose={() => setRecap(null)}>
              <div class="storytext">{recap === '...' ? 'The Game Master is remembering...' : recap}</div>
              {run && story(run).bible && <div class="tiny dim">{story(run).bible!.title}</div>}
              <button class="primary" onClick={() => setRecap(null)}>
                Back on the road
              </button>
            </Modal>
          )}
        </GameCtx.Provider>
      ) : (
        screen
      )}
      {showSettings && (
        <SettingsModal
          settings={settings}
          setSettings={(s) => {
            setSettingsState(s);
            saveSettings(s);
          }}
          run={run}
          onClose={() => setShowSettings(false)}
        />
      )}
      {toastMsg && <div class="toast">{toastMsg}</div>}
      <div class="rotate">Turn the iPad sideways to play.</div>
    </div>
  );
}
