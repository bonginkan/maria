/**
 * Standardized Fallback Patterns v2.0
 * Consistent UX for degraded functionality
 */

import type { CommandResult } from './BaseCommand';

/**
 * Information fallback for missing dependencies
 * Returns success with mocked flag for better UX
 */
export function infoFallback(
  title: string,
  mockData: any,
  setupHint = '/setup'
): CommandResult {
  return {
    requiresInput: false,
    endReason: 'success',
    message: `⚠️ ${title} (Demo Mode)`,
    data: {
      ...mockData,
      mocked: true,
      note: `Enable full features: ${setupHint}`
    },
    mocked: true
  };
}

/**
 * Beta feature fallback
 * Returns partial for features under development
 */
export function betaFallback(
  title: string,
  partialData: any
): CommandResult {
  return {
    requiresInput: false,
    endReason: 'partial',
    message: `🚧 ${title} (Beta)`,
    data: {
      ...partialData,
      beta: true,
      disclaimer: 'This feature is under active development'
    },
    beta: true
  };
}

/**
 * Service unavailable fallback
 * Provides cached or sample data when services are down
 */
export function serviceUnavailableFallback(
  service: string,
  cachedData?: any
): CommandResult {
  return {
    requiresInput: false,
    endReason: 'success',
    message: `🔄 ${service} (Offline Mode)`,
    data: {
      cached: cachedData || generateSampleData(service),
      offline: true,
      retryIn: '5m',
      note: 'Using cached data. Service will retry automatically.'
    },
    mocked: true
  };
}

/**
 * Feature unavailable fallback
 * Clear guidance on what's available vs unavailable
 */
export function featureUnavailableFallback(
  feature: string,
  availableFeatures: string[],
  unavailableFeatures: string[]
): CommandResult {
  return {
    requiresInput: false,
    endReason: 'partial',
    message: `⚙️ ${feature} requires configuration`,
    data: {
      available: availableFeatures,
      unavailable: unavailableFeatures,
      setupGuide: '/help setup',
      note: 'Some features require additional configuration'
    }
  };
}

/**
 * Permission denied fallback
 * Security-aware response for unauthorized access
 */
export function permissionDeniedFallback(
  resource: string,
  requiredRole?: string
): CommandResult {
  return {
    requiresInput: false,
    endReason: 'error',
    error: `Access denied to ${resource}`,
    code: 'PERMISSION_DENIED',
    data: {
      resource,
      requiredRole,
      currentRole: 'user',
      helpCommand: '/permissions'
    }
  };
}

/**
 * Generate sample data for demo mode
 */
function generateSampleData(service: string): any {
  const samples: Record<string, any> = {
    'Sales Dashboard': {
      revenue: '$125,000',
      deals: 42,
      conversion: '18%',
      trend: '+12%',
      topCustomers: ['Acme Corp', 'TechCo', 'StartupXYZ']
    },
    'Battle Card': {
      competitor: 'CompetitorX',
      strengths: ['Feature A', 'Price Point'],
      weaknesses: ['Limited Integration', 'Support'],
      winRate: '65%'
    },
    'Pilot Setup': {
      team: ['PM', 'Dev Lead', '2 Engineers', 'Designer'],
      duration: '2 weeks',
      milestones: ['Kickoff', 'MVP', 'Review', 'Launch'],
      status: 'Ready to Start'
    },
    'CRM Integration': {
      accounts: 150,
      contacts: 450,
      opportunities: 25,
      lastSync: 'Demo Mode - Not Connected'
    }
  };
  
  return samples[service] || {
    status: 'Demo Mode',
    message: 'This is sample data',
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a progress indicator for long-running operations
 */
export function progressFallback(
  operation: string,
  percentComplete: number
): CommandResult {
  const progressBar = '█'.repeat(Math.floor(percentComplete / 5)) + 
                      '░'.repeat(20 - Math.floor(percentComplete / 5));
  
  return {
    requiresInput: false,
    endReason: 'partial',
    message: `${operation} [${progressBar}] ${percentComplete}%`,
    data: {
      operation,
      percentComplete,
      inProgress: true
    }
  };
}

/**
 * Validation error fallback
 * Helpful error messages for invalid inputs
 */
export function validationErrorFallback(
  field: string,
  value: any,
  expectedFormat: string
): CommandResult {
  return {
    requiresInput: true,
    endReason: 'error',
    error: `Invalid ${field}`,
    code: 'VALIDATION_ERROR',
    data: {
      field,
      providedValue: value,
      expectedFormat,
      example: getExampleFormat(expectedFormat)
    }
  };
}

/**
 * Get example format for validation errors
 */
function getExampleFormat(format: string): string {
  const examples: Record<string, string> = {
    'email': 'user@example.com',
    'url': 'https://example.com',
    'date': '2024-01-15',
    'time': '14:30',
    'number': '42',
    'uuid': '123e4567-e89b-12d3-a456-426614174000'
  };
  
  return examples[format] || format;
}