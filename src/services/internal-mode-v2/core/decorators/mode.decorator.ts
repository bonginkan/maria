/**
 * Mode decorator for mode plugin registration
 */

import 'reflect-metadata';
import { ModeConfig, ModeCategory, METADATA_KEYS } from '../types';

// Global mode registry
const modeRegistry = new Map<string, any>();

/**
 * @Mode decorator - Marks a class as a mode plugin
 */
export function Mode(config: ModeConfig) {
  return function <T extends { new (...args: unknown[]): {} }>(constructor: T) {
    // Store mode configuration
    Reflect.defineMetadata(METADATA_KEYS.MODE, config, constructor);

    // Register in global mode registry
    modeRegistry.set(config.name, constructor);

    console.log(`[Mode Decorator] Registered mode: ${config.name} (${config.category})`);

    // Add mode properties to the class
    return class extends constructor {
      modeConfig = config;
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
    const metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || {};
    metadata.category = category;
    Reflect.defineMetadata(METADATA_KEYS.MODE, metadata, target);
  };
}

/**
 * @Trigger decorator - Defines mode triggers
 */
export function Trigger(...patterns: string[]) {
  return function (target: unknown) {
    const metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || {};
    metadata.triggers = [...(metadata.triggers || []), ...patterns];
    Reflect.defineMetadata(METADATA_KEYS.MODE, metadata, target);
  };
}

/**
 * @Priority decorator - Sets mode priority
 */
export function Priority(priority: number) {
  return function (target: unknown) {
    const metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || {};
    metadata.priority = priority;
    Reflect.defineMetadata(METADATA_KEYS.MODE, metadata, target);
  };
}

/**
 * @Symbol decorator - Sets mode symbol
 */
export function Symbol(symbol: string) {
  return function (target: unknown) {
    const metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || {};
    metadata.symbol = symbol;
    Reflect.defineMetadata(METADATA_KEYS.MODE, metadata, target);
  };
}

/**
 * @Color decorator - Sets mode color
 */
export function Color(color: string) {
  return function (target: unknown) {
    const metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || {};
    metadata.color = color;
    Reflect.defineMetadata(METADATA_KEYS.MODE, metadata, target);
  };
}

/**
 * @Alias decorator - Adds mode aliases
 */
export function Alias(...aliases: string[]) {
  return function (target: unknown) {
    const metadata = Reflect.getMetadata(METADATA_KEYS.MODE, target) || {};
    metadata.aliases = [...(metadata.aliases || []), ...aliases];
    Reflect.defineMetadata(METADATA_KEYS.MODE, metadata, target);
  };
}

/**
 * Get all registered modes
 */
export function getRegisteredModes(): Map<string, any> {
  return new Map(modeRegistry);
}

/**
 * Get modes by category
 */
export function getModesByCategory(category: ModeCategory): unknown[] {
  const modes: unknown[] = [];

  modeRegistry.forEach((ModeClass) => {
    const config = Reflect.getMetadata(METADATA_KEYS.MODE, ModeClass);
    if (config && config.category === category) {
      modes.push(ModeClass);
    }
  });

  return modes;
}

/**
 * Clear mode registry (for testing)
 */
export function clearModeRegistry(): void {
  modeRegistry.clear();
}
