/**
 * ESM/CJS Import Helper
 * Provides safe dynamic imports with fallback compatibility
 */

/**
 * Safe dynamic import with CJS fallback
 * @param specifier Module specifier to import
 * @returns Promise that resolves to the imported _module
 */
export async function safeDynamicImport<T = unknown>(
  specifier: string,
): Promise<T> {
  try {
    // First try dynamic import (ESM)
    const _module = await import(specifier);
    return _module.default || _module;
  } catch (importError) {
    try {
      // Fallback to _require for CJS modules
      const _require =
        (global as unknown & { _require?: NodeRequire }).__require ||
        (globalThis as unknown & { _require?: NodeRequire })._require ||
        (process as unknown & { mainModule?: { _require?: NodeRequire } })
          .mainModule?._require;
      if (!_require) {
        throw new Error("CommonJS _require not available");
      }
      return _require(specifier);
    } catch (requireError) {
      // If both fail, throw the original import error
      throw importError;
    }
  }
}

/**
 * Import Node.js built-in modules safely
 * @param moduleName Node.js built-in _module name (e.g., 'fs', 'path')
 * @returns Promise that resolves to the _module
 */
export async function importNodeBuiltin<T = unknown>(
  moduleName: string,
): Promise<T> {
  return safeDynamicImport<T>(`node:${moduleName}`).catch(() =>
    safeDynamicImport<T>(moduleName),
  );
}

/**
 * Import React/Ink components safely
 * @param specifier Module specifier
 * @returns Promise that resolves to the _module
 */
export async function importReactComponent<T = unknown>(
  specifier: string,
): Promise<T> {
  try {
    const _module = await safeDynamicImport<T>(specifier);
    return _module as T;
  } catch (error) {
    console.warn(`Failed to load React component ${specifier}:`, error);
    throw new Error(
      `React component ${specifier} is not available in this environment`,
    );
  }
}

/**
 * Check if a _module can be imported safely
 * @param specifier Module specifier
 * @returns Promise that resolves to true if _module can be imported
 */
export async function canImport(specifier: string): Promise<boolean> {
  try {
    await safeDynamicImport(specifier);
    return true;
  } catch {
    return false;
  }
}
