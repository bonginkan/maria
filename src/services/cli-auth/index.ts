/**
 * CLI Authentication Module - Phase 4 Implementation
 * Export all authentication-related components for MARIA CLI
 */

export { OAuth2PKCEClient } from './OAuth2PKCEClient';
export { MariaAPIClient } from './MariaAPIClient';
export { CLIAuthService, cliAuth } from './CLIAuthService';

// Modern authentication system exports
export { AuthenticationManager, authManager } from './AuthenticationManager';
export { TokenStorage } from './TokenStorage';
export { withAuth, AUTH_EXEMPT_COMMANDS, displayUsageFooter } from './withAuth';
export { callApi, callApiJson, streamApi, uploadFile, ERR } from './api-client';
export * from './types';