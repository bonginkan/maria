/**
 * Module declarations for missing TypeScript declarations
 * Phase 1: Emergency type declarations - will be refactored in later phases
 */

// Provider-related modules
declare module "./index.js" {
  export * from "./index";
}

// CLI-related modules
declare module "../maria-ai" {
  export interface Config {
    provider?: string;
    model?: string;
    offline?: boolean;
    [key: string]: any;
  }
}

// Handle barrel import issues temporarily
declare module "*/index.ts" {
  const content: any;
  export = content;
}
