import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Relative base so the build works on GitHub Pages (/<repo>/) and locally.
export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { target: 'es2020', outDir: 'dist' },
  test: { include: ['tests/**/*.test.ts'] },
} as any);
