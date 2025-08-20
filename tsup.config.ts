import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts', 'src/bin/maria.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  splitting: false,
  treeshake: true,
  external: ['react-devtools-core', 'react', 'ink'],
  target: 'node18',
  platform: 'node',
  shims: true,
  keepNames: true,
  bundle: true,
  skipNodeModulesBundle: false,
  metafile: true,
  onSuccess: 'chmod +x dist/cli.js',
  esbuildOptions(options) {
    // Fix ESM/CJS interop issues
    options.banner = {
      js: `#!/usr/bin/env node
"use strict";

// ESM/CJS Compatibility Fix
const { createRequire } = require('module');
const __require = createRequire(import.meta.url || __filename);
global.__require = __require;

// Dynamic import wrapper for CJS compatibility
if (typeof globalThis.importDynamic === 'undefined') {
  globalThis.importDynamic = async (specifier) => {
    try {
      return await import(specifier);
    } catch (e) {
      // Fallback to require for CJS modules
      try {
        return __require(specifier);
      } catch (e2) {
        throw e; // Throw original import error
      }
    }
  };
}
      `.trim()
    };

    // Resolve import.meta.url for CJS - remove problematic define
    // options.define = {
    //   ...options.define,
    //   'import.meta.url': '"file://" + __filename',
    // };

    // Better module resolution
    options.conditions = ['node', 'import', 'require'];
    options.mainFields = ['module', 'main'];
  },
});