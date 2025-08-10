import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs'],  // CJSのみに変更してdynamic require問題を回避
  dts: true,
  clean: true,
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  splitting: false,
  treeshake: true,
  external: [],
  noExternal: [/.*/],
  target: 'node18',
  platform: 'node',
  shims: true,  // shimsを有効にしてNode.js builtinsを使用可能に
  keepNames: true,
  bundle: true,
  skipNodeModulesBundle: false,
  metafile: true,
  onSuccess: 'chmod +x dist/cli.js',
  esbuildOptions(options) {
    // CommonJS互換性の向上
  },
});