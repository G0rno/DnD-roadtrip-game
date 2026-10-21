// Keeps the screen awake while playing, so speech doesn't stop when the iPad would auto-lock.
type Lock = { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void };

let lock: Lock | null = null;
let wanted = false;

async function acquire() {
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } };
  if (!wanted || lock || !nav.wakeLock || document.visibilityState !== 'visible') return;
  try {
    lock = await nav.wakeLock.request('screen');
    lock.addEventListener('release', () => {
      lock = null;
    });
  } catch {
    /* not allowed right now; retried on the next tap or when the app comes back */
  }
}

export function setKeepAwake(on: boolean) {
  wanted = on;
  if (on) acquire();
  else if (lock) {
    lock.release().catch(() => {});
    lock = null;
  }
}

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => acquire());
  window.addEventListener('pointerdown', () => acquire());
}
