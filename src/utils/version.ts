/**
 * Dynamic Version Management Utility
 * Provides dynamic version fetching from package.json
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

interface PackageJson {
  name: string;
  version: string;
  description?: string;
}

let _cachedVersion: string | null = null;
let _cachedPackageJson: PackageJson | null = null;

/**
 * Get the current version from package.json
 */
export function getVersion(): string {
  if (_cachedVersion) {
    return _cachedVersion;
  }

  try {
    const packageJson = getPackageJson();
    _cachedVersion = packageJson.version;
    return _cachedVersion;
  } catch (error) {
    // Return 'latest' instead of '0.0.0' for better UX
    _cachedVersion = "latest";
    return _cachedVersion;
  }
}

/**
 * Get the package.json contents
 */
export function getPackageJson(): PackageJson {
  if (_cachedPackageJson) {
    return _cachedPackageJson;
  }

  try {
    // Try multiple possible paths for package.json
    const possiblePaths = [
      // When running from built dist/
      join(__dirname, "../../package.json"),
      // When running from source
      join(__dirname, "../../../package.json"),
      // Current working directory
      join(process.cwd(), "package.json"),
      // One level up from current working directory
      join(process.cwd(), "../package.json"),
      // For globally installed packages
      join(__dirname, "../../../../package.json"),
      join(__dirname, "../../../../../package.json"),
      // npm global install locations
      "/usr/local/lib/node_modules/@bonginkan/maria/package.json",
      "/usr/lib/node_modules/@bonginkan/maria/package.json",
      // User home npm global
      join(
        process.env.HOME || "",
        ".npm-global/lib/node_modules/@bonginkan/maria/package.json",
      ),
      join(
        process.env.HOME || "",
        ".nvm/versions/node",
        process.version,
        "lib/node_modules/@bonginkan/maria/package.json",
      ),
    ];

    let packageJsonPath: string | null = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        try {
          const content = readFileSync(path, "utf-8");
          const parsed = JSON.parse(content);
          // Verify it's the correct package
          if (parsed.name === "@bonginkan/maria") {
            packageJsonPath = path;
            break;
          }
        } catch {
          // Try next path
          continue;
        }
      }
    }

    if (!packageJsonPath) {
      throw new Error("package.json not found in any expected location");
    }

    const packageJsonContent = readFileSync(packageJsonPath, "utf-8");
    _cachedPackageJson = JSON.parse(packageJsonContent) as PackageJson;

    return _cachedPackageJson;
  } catch (error) {
    throw new Error(`Failed to read package.json: ${error}`);
  }
}

/**
 * Get formatted version string for display
 */
export function getFormattedVersion(): string {
  return `v${getVersion()}`;
}

/**
 * Get full application name with version
 */
export function getAppNameWithVersion(): string {
  try {
    const packageJson = getPackageJson();
    const name = packageJson.name || "MARIA";
    const displayName = name.includes("maria") ? "MARIA" : name;
    return `${displayName} ${getFormattedVersion()}`;
  } catch (error) {
    return `MARIA v${getVersion()}`;
  }
}

/**
 * Clear version cache (useful for tests)
 */
export function clearVersionCache(): void {
  _cachedVersion = null;
  _cachedPackageJson = null;
}

/**
 * Legacy compatibility functions
 */
export const VERSION = getVersion();
export default getVersion;
