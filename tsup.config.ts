import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  treeshake: true,
  target: 'node18',
  platform: 'node',
  shims: true,
  keepNames: true,
  bundle: true,
  skipNodeModulesBundle: false,
  onSuccess: 'chmod +x dist/cli.js',
});