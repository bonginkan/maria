/**
 * ESM/CJS Import Helper
 * Provides safe dynamic imports with fallback compatibility
 */

/**
 * Safe dynamic import with CJS fallback
 * @param specifier Module specifier to import
 * @returns Promise that resolves to the imported module
 */
export async function safeDynamicImport<T = unknown>(specifier: string): Promise<T> {
  try {
    // First try dynamic import (ESM)
    const module = await import(specifier);
    return module.default || module;
  } catch (importError) {
    try {
      // Fallback to require for CJS modules
      const require =
        (global as unknown & { __require?: NodeRequire }).__require ||
        (globalThis as unknown & { require?: NodeRequire }).require ||
        (process as unknown & { mainModule?: { require?: NodeRequire } }).mainModule?.require;
      if (!require) {
        throw new Error('CommonJS require not available');
      }
      return require(specifier);
    } catch (requireError) {
      // If both fail, throw the original import error
      throw importError;
    }
  }
}

/**
 * Import Node.js built-in modules safely
 * @param moduleName Node.js built-in module name (e.g., 'fs', 'path')
 * @returns Promise that resolves to the module
 */
export async function importNodeBuiltin<T = unknown>(moduleName: string): Promise<T> {
  return safeDynamicImport<T>(`node:${moduleName}`).catch(() => safeDynamicImport<T>(moduleName));
}

/**
 * Import React/Ink components safely
 * @param specifier Module specifier
 * @returns Promise that resolves to the module
 */
export async function importReactComponent<T = unknown>(specifier: string): Promise<T> {
  try {
    const module = await safeDynamicImport<T>(specifier);
    return module as T;
  } catch (error) {
    console.warn(`Failed to load React component ${specifier}:`, error);
    throw new Error(`React component ${specifier} is not available in this environment`);
  }
}

/**
 * Check if a module can be imported safely
 * @param specifier Module specifier
 * @returns Promise that resolves to true if module can be imported
 */
export async function canImport(specifier: string): Promise<boolean> {
  try {
    await safeDynamicImport(specifier);
    return true;
  } catch {
    return false;
  }
}
