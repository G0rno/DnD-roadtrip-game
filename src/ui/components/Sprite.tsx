import { ATLAS_SIZE, ATLAS_URL, SPRITES } from '../sprites';

/**
 * An animated pixel sprite. Frames advance through the global CSS variable --f (0..3),
 * driven by one ticker in main.tsx, so hundreds of sprites cost nothing.
 */
export function Sprite({ name, scale = 4, flip = false, filter, still = false, class: cls = '' }: { name: string; scale?: number; flip?: boolean; filter?: string; still?: boolean; class?: string }) {
  const s = SPRITES[name] ?? SPRITES.knight_m;
  const x = -s.x * scale;
  const y = -s.y * scale;
  const fw = s.w * scale;
  return (
    <div
      class={`sprite ${cls}`}
      style={{
        width: `${fw}px`,
        height: `${s.h * scale}px`,
        backgroundImage: `url(${ATLAS_URL})`,
        backgroundSize: `${ATLAS_SIZE * scale}px ${ATLAS_SIZE * scale}px`,
        backgroundPosition: still ? `${x}px ${y}px` : `calc(${x}px - var(--f, 0) * ${fw}px) ${y}px`,
        transform: flip ? 'scaleX(-1)' : undefined,
        filter,
      }}
    />
  );
}
