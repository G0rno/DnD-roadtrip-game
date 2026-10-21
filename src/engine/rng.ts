// Seeded RNG (mulberry32). Its state lives inside the saved run, so a reload continues the same sequence.

export interface RngHolder {
  rngState: number;
}

export class Rng {
  constructor(private holder: RngHolder) {}

  /** Float in [0, 1). */
  next(): number {
    let t = (this.holder.rngState = (this.holder.rngState + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [v, w] of entries) {
      r -= w;
      if (r < 0) return v;
    }
    return entries[entries.length - 1][0];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Pick n distinct elements. */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle([...arr]).slice(0, n);
  }
}

export function newSeed(): number {
  return (Math.random() * 2 ** 31) | 0;
}
