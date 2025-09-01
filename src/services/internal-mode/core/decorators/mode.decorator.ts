/**
 * Mode decorator for mode plugin registration
 */

import "reflect-_metadata";
import { METADATA_KEYS, ModeCategory, ModeConfig } from "../types";

// Global mode registry
const _modeRegistry = new Map<string, any>();

/**
 * @Mode decorator - Marks a class as a mode plugin
 */
export function Mode(_config: ModeConfig) {
  return function <T extends { new (...args: unknown[]): Record<string, any> }>(
    constructor: T,
  ) {
    // Store mode configuration
    Reflect.defineMetadata(METADATA_KEYS.MODE, _config, constructor);

    // Register in global mode registry
    _modeRegistry.set(config.name, constructor);

    console.log(
      `[Mode Decorator] Registered mode: ${config.name} (${config.category})`,
    );

    // Add mode properties to the class
    return class extends constructor {
      modeConfig = _config;
      modeName = config.name;
      modeCategory = config.category;
      modeSymbol = config.symbol;
      modeColor = config.color;
    };
  };
}

/**
 * @Category decorator - Groups modes by category
 */
export function Category(category: ModeCategory) {
  return function (target: unknown) {
    const _metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || object;
    _metadata.category = category;
    Reflect.defineMetadata(METADATA_KEYS.MODE, _metadata, target);
  };
}

/**
 * @Trigger decorator - Defines mode triggers
 */
export function Trigger(...patterns: string[]) {
  return function (target: unknown) {
    const _metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || object;
    _metadata.triggers = [...(_metadata.triggers || []), ...patterns];
    Reflect.defineMetadata(METADATA_KEYS.MODE, _metadata, target);
  };
}

/**
 * @Priority decorator - Sets mode priority
 */
export function Priority(priority: number) {
  return function (target: unknown) {
    const _metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || object;
    _metadata.priority = priority;
    Reflect.defineMetadata(METADATA_KEYS.MODE, _metadata, target);
  };
}

/**
 * @Symbol decorator - Sets mode symbol
 */
export function Symbol(symbol: string) {
  return function (target: unknown) {
    const _metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || object;
    _metadata.symbol = symbol;
    Reflect.defineMetadata(METADATA_KEYS.MODE, _metadata, target);
  };
}

/**
 * @Color decorator - Sets mode color
 */
export function Color(color: string) {
  return function (target: unknown) {
    const _metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || object;
    _metadata.color = color;
    Reflect.defineMetadata(METADATA_KEYS.MODE, _metadata, target);
  };
}

/**
 * @Alias decorator - Adds mode aliases
 */
export function Alias(...aliases: string[]) {
  return function (target: unknown) {
    const _metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || object;
    _metadata.aliases = [...(_metadata.aliases || []), ...aliases];
    Reflect.defineMetadata(METADATA_KEYS.MODE, _metadata, target);
  };
}

/**
 * Get all registered modes
 */
export function getRegisteredModes(): Map<string, any> {
  return new Map(_modeRegistry);
}

/**
 * Get modes by category
 */
export function getModesByCategory(category: ModeCategory): unknown[] {
  const modes: unknown[] = [];

  _modeRegistry.forEach((ModeClass) => {
    const _config = Reflect.getMetadata(METADATA_KEYS.MODE, ModeClass);
    if (_config && _config.category === category) {
      modes.push(ModeClass);
    }
  });

  return modes;
}

/**
 * Clear mode registry (for testing)
 */
export function clearModeRegistry(): void {
  _modeRegistry.clear();
}
