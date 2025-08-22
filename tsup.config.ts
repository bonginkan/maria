import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: false,
  target: 'node18',
  outDir: 'dist',
  external: [
    // Mark all dependencies as external to avoid bundling
    'chalk',
    'commander'
  ]
});