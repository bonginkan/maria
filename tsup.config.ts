import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  splitting: false,
  treeshake: true,
  external: [],
  noExternal: [],
  target: 'node18',
  platform: 'node',
  shims: false,
  keepNames: true,
  bundle: true,
  skipNodeModulesBundle: true,
  metafile: true,
  onSuccess: 'chmod +x dist/cli.js',
  esbuildOptions(options) {
    options.footer = {
      js: `if (require.main === module) { require('./cli').main(); }`,
    };
  },
});
EOF < /dev/null