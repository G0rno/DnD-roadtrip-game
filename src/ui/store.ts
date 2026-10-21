import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Run } from '../engine/types';
import type { Settings } from '../engine/save';

export interface Game {
  run: Run;
  /** Mutate the run, autosave, re-render. */
  act: (fn: (run: Run) => void) => void;
  quit: () => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  toast: (msg: string) => void;
  openInventory: () => void;
  openMenu: () => void;
}

export const GameCtx = createContext<Game | null>(null);

export function useGame(): Game {
  const g = useContext(GameCtx);
  if (!g) throw new Error('No game');
  return g;
}
