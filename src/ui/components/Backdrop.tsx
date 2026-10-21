import { useMemo } from 'preact/hooks';
import { Rng } from '../../engine/rng';
import type { JSX } from 'preact';

// Procedural region backdrops (SVG). Deterministic per region, so a region always looks the same.

interface Palette {
  sky: [string, string];
  far: string;
  mid: string;
  near: string;
  ground: [string, string];
  arena: string;
  accent?: string;
}

const PALETTES: Record<string, Palette> = {
  forest: { sky: ['#1f3330', '#7f9f84'], far: '#3d5a4c', mid: '#28402f', near: '#1a2a1f', ground: ['#3c4f2a', '#2a3820'], arena: '#5d7040' },
  marsh: { sky: ['#232c30', '#6f7f70'], far: '#45554c', mid: '#2e3c33', near: '#1d2722', ground: ['#34402e', '#232c22'], arena: '#4f5c3f', accent: '#5e7a74' },
  goblin: { sky: ['#3b2a2c', '#d4985a'], far: '#7a5a48', mid: '#5c4434', near: '#3c2c22', ground: ['#7a6040', '#56422c'], arena: '#93774f' },
  ashen: { sky: ['#160c0c', '#6e2a19'], far: '#3a2420', mid: '#251615', near: '#150c0b', ground: ['#3d2b26', '#241917'], arena: '#56403a', accent: '#ff7a2f' },
  north: { sky: ['#1b2840', '#9bb4cf'], far: '#7d91aa', mid: '#4d6079', near: '#2c3a4d', ground: ['#d7e1ea', '#aab9c8'], arena: '#eef3f7' },
  desert: { sky: ['#3d2b1d', '#eab76d'], far: '#c48f55', mid: '#a8743f', near: '#7c5530', ground: ['#d0a465', '#b08548'], arena: '#e0bb7f' },
  underdark: { sky: ['#0c0a10', '#231c2e'], far: '#2a2236', mid: '#1b1624', near: '#120f18', ground: ['#2d2736', '#1b1722'], arena: '#3d3549', accent: '#7af0c8' },
  cursed: { sky: ['#0f1020', '#3c3a58'], far: '#2e2d44', mid: '#1f1e30', near: '#141322', ground: ['#2c2b38', '#1c1b26'], arena: '#3e3c4e', accent: '#d9dcf5' },
};

function ridge(r: Rng, baseY: number, amp: number, step: number, jag = 0.5): string {
  let d = `M0 600 L0 ${baseY}`;
  for (let x = 0; x <= 1200 + step; x += step) {
    const y = baseY - r.next() * amp * (r.chance(jag) ? 1 : 0.4);
    d += ` L${x} ${y.toFixed(0)}`;
  }
  return d + ' L1200 600 Z';
}

function hills(r: Rng, baseY: number, amp: number, n: number): string {
  let d = `M0 600 L0 ${baseY}`;
  const step = 1200 / n;
  for (let i = 0; i < n; i++) {
    const x1 = i * step + step / 2;
    const y1 = baseY - amp * (0.5 + r.next() * 0.5);
    d += ` Q${x1.toFixed(0)} ${y1.toFixed(0)} ${((i + 1) * step).toFixed(0)} ${baseY}`;
  }
  return d + ' L1200 600 Z';
}

function pines(r: Rng, n: number, baseY: number, h: number, color: string, snow?: string): JSX.Element[] {
  const out: JSX.Element[] = [];
  for (let i = 0; i < n; i++) {
    const x = r.next() * 1240 - 20;
    const hh = h * (0.7 + r.next() * 0.6);
    const w = hh * 0.42;
    const y = baseY + r.next() * 14;
    out.push(<polygon points={`${x},${y - hh} ${x - w},${y} ${x + w},${y}`} fill={color} />);
    if (snow) out.push(<polygon points={`${x},${y - hh} ${x - w * 0.3},${y - hh * 0.7} ${x + w * 0.3},${y - hh * 0.7}`} fill={snow} />);
  }
  return out;
}

function roundTrees(r: Rng, n: number, baseY: number, h: number, color: string, trunk: string): JSX.Element[] {
  const out: JSX.Element[] = [];
  for (let i = 0; i < n; i++) {
    const x = r.next() * 1240 - 20;
    const s = h * (0.7 + r.next() * 0.6);
    out.push(<rect x={x - s * 0.06} y={baseY - s * 0.5} width={s * 0.12} height={s * 0.5} fill={trunk} />);
    out.push(<circle cx={x} cy={baseY - s * 0.7} r={s * 0.35} fill={color} />);
    out.push(<circle cx={x - s * 0.2} cy={baseY - s * 0.55} r={s * 0.25} fill={color} />);
    out.push(<circle cx={x + s * 0.2} cy={baseY - s * 0.55} r={s * 0.25} fill={color} />);
  }
  return out;
}

function sceneFor(region: string): JSX.Element {
  const p = PALETTES[region] ?? PALETTES.forest;
  const r = new Rng({ rngState: [...region].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) | 0 });
  const layers: JSX.Element[] = [];
  const add = (...els: (JSX.Element | JSX.Element[])[]) => els.forEach((e) => (Array.isArray(e) ? layers.push(...e) : layers.push(e)));

  switch (region) {
    case 'forest':
      add(<path d={hills(r, 330, 80, 5)} fill={p.far} />);
      add(pines(r, 26, 360, 140, p.mid));
      add(roundTrees(r, 7, 395, 170, p.near, '#120d0a'));
      break;
    case 'marsh':
      add(<path d={hills(r, 340, 40, 4)} fill={p.far} />);
      add(roundTrees(r, 6, 370, 120, p.mid, '#141a16'));
      for (let i = 0; i < 9; i++) add(<ellipse cx={r.next() * 1200} cy={392 + r.next() * 30} rx={60 + r.next() * 90} ry={6 + r.next() * 5} fill={p.accent} opacity={0.5} />);
      for (let i = 0; i < 70; i++) {
        const x = r.next() * 1200;
        add(<rect x={x} y={360 + r.next() * 30} width={3} height={20 + r.next() * 30} fill={p.near} />);
      }
      break;
    case 'goblin':
      add(<path d={hills(r, 300, 90, 4)} fill={p.far} />);
      add(<path d={hills(r, 350, 60, 6)} fill={p.mid} />);
      for (let i = 0; i < 4; i++) {
        const x = 120 + r.next() * 960;
        add(<polygon points={`${x},300 ${x - 40},362 ${x + 40},362`} fill={p.near} />);
        add(<line x1={x} y1={300} x2={x} y2={282} stroke={p.near} stroke-width={3} />);
        add(<rect x={x} y={282} width={16} height={9} fill="#9b3b2a" />);
      }
      break;
    case 'ashen':
      add(<path d={ridge(r, 250, 160, 70, 0.7)} fill={p.far} />);
      add(<path d={ridge(r, 330, 110, 50, 0.6)} fill={p.mid} />);
      add(<ellipse cx={850} cy={250} rx={140} ry={40} fill={p.accent} opacity={0.18} />);
      for (let i = 0; i < 5; i++) add(<path d={`M${200 + i * 220} 600 L${230 + i * 220} 395 L${250 + i * 220} 600 Z`} fill={p.accent} opacity={0.25} />);
      break;
    case 'north':
      add(<path d={ridge(r, 240, 150, 90, 0.8)} fill={p.far} />);
      add(<path d={ridge(r, 240, 150, 90, 0.8)} fill="#ffffff" opacity={0.18} />);
      add(pines(r, 22, 380, 120, p.mid, '#e8f0f7'));
      break;
    case 'desert':
      add(<path d={hills(r, 320, 70, 3)} fill={p.far} />);
      add(<path d={hills(r, 360, 40, 5)} fill={p.mid} />);
      for (let i = 0; i < 5; i++) {
        const x = 150 + i * 220 + r.next() * 60;
        const h = 60 + r.next() * 90;
        add(<rect x={x} y={370 - h} width={26} height={h} fill={p.near} />);
        add(<rect x={x - 6} y={370 - h} width={38} height={10} fill={p.near} />);
      }
      add(<circle cx={950} cy={130} r={46} fill="#fff1c9" opacity={0.85} />);
      break;
    case 'underdark':
      for (let i = 0; i < 26; i++) {
        const x = r.next() * 1200;
        const h = 60 + r.next() * 150;
        add(<polygon points={`${x - 20},0 ${x + 20},0 ${x},${h}`} fill={p.mid} />);
      }
      for (let i = 0; i < 14; i++) {
        const x = r.next() * 1200;
        const h = 40 + r.next() * 90;
        add(<polygon points={`${x - 22},395 ${x + 22},395 ${x},${395 - h}`} fill={p.near} />);
      }
      for (let i = 0; i < 18; i++) add(<circle cx={r.next() * 1200} cy={380 + r.next() * 20} r={3 + r.next() * 3} fill={p.accent} opacity={0.6} />);
      break;
    case 'cursed':
      add(<circle cx={880} cy={120} r={60} fill={p.accent} opacity={0.9} />);
      add(<path d="M120 380 L120 220 L150 220 L150 190 L170 190 L170 220 L260 220 L260 160 L285 130 L310 160 L310 220 L380 220 L380 190 L400 190 L400 380 Z" fill={p.far} />);
      add(<path d={hills(r, 380, 30, 6)} fill={p.mid} />);
      for (let i = 0; i < 6; i++) {
        const x = r.next() * 1200;
        add(<path d={`M${x} 395 L${x} 300 M${x} 330 L${x - 25} 305 M${x} 315 L${x + 22} 290`} stroke={p.near} stroke-width={5} fill="none" />);
      }
      add(<rect x={0} y={360} width={1200} height={60} fill="#c9cce8" opacity={0.08} />);
      break;
  }

  return (
    <>
      <defs>
        <linearGradient id={`sky-${region}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={p.sky[0]} />
          <stop offset="1" stop-color={p.sky[1]} />
        </linearGradient>
        <linearGradient id={`ground-${region}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={p.ground[0]} />
          <stop offset="1" stop-color={p.ground[1]} />
        </linearGradient>
        <radialGradient id={`arena-${region}`}>
          <stop offset="0" stop-color={p.arena} stop-opacity="0.9" />
          <stop offset="1" stop-color={p.arena} stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="600" fill={`url(#sky-${region})`} />
      {layers}
      <rect y="390" width="1200" height="210" fill={`url(#ground-${region})`} />
      <ellipse cx="600" cy="490" rx="560" ry="105" fill={`url(#arena-${region})`} />
    </>
  );
}

export function Backdrop({ region, night }: { region: string; night?: boolean }) {
  const scene = useMemo(() => sceneFor(region), [region]);
  return (
    <svg class="backdrop" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" style={night ? { filter: 'brightness(0.55) saturate(0.7) hue-rotate(200deg)' } : undefined}>
      {scene}
    </svg>
  );
}
