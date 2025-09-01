/**
 * Maria AI Interfaces
 * Circular dependency resolution
 */

import { ConfigManager } from "../config/config-manager";
import { ProviderSelector } from "../services/provider-selector";

export interface IMaria {
  config: ConfigManager;
  providerSelector: ProviderSelector;
}
