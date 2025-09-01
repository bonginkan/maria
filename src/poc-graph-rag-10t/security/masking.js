/**
 * Data Masking and PII Protection for Graph RAG 10T
 * 
 * Provides comprehensive data masking for:
 * - Search result snippets and highlights
 * - Document content and metadata
 * - Log entries and audit trails
 * - API responses and error messages
 */

import crypto from 'node:crypto';

// === Masking Rules Configuration ===

/**
 * PII Detection Patterns
 * Configurable regex patterns for different types of sensitive data
 */
export const PII_PATTERNS = {
  // Personal Information
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    replacement: '***@***.***',
    description: 'Email addresses'
  },
  
  phone: {
    pattern: /(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{3}[-.\s]\d{4}[-.\s]\d{4})/g,
    replacement: '***-***-****',
    description: 'Phone numbers'
  },
  
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '***-**-****',
    description: 'Social Security Numbers'
  },
  
  creditCard: {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '****-****-****-****',
    description: 'Credit card numbers'
  },

  // Japanese Personal Information
  japanesePhone: {
    pattern: /0\d{1,4}-\d{1,4}-\d{4}/g,
    replacement: '***-***-****',
    description: 'Japanese phone numbers'
  },
  
  japanesePostal: {
    pattern: /〒?\d{3}-\d{4}/g,
    replacement: '***-****',
    description: 'Japanese postal codes'
  },

  // Business Information
  ipAddress: {
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '***.***.***.***',
    description: 'IP addresses'
  },
  
  apiKey: {
    pattern: /\b[A-Za-z0-9]{32,}\b/g,
    replacement: '********************************',
    description: 'API keys and tokens'
  },

  // Financial Information
  bankAccount: {
    pattern: /\b\d{10,12}\b/g,
    replacement: '**********',
    description: 'Bank account numbers'
  },

  // URLs with sensitive paths
  sensitiveUrl: {
    pattern: /https?:\/\/[^\s\/$.?#].[^\s]*(?:admin|auth|login|password|token|secret|key|private)/gi,
    replacement: 'https://***.***/***',
    description: 'Sensitive URLs'
  }
};

/**
 * Custom patterns for specific domains
 */
export const DOMAIN_PATTERNS = {
  // Healthcare
  healthcare: {
    patterns: {
      medicalId: {
        pattern: /\bMRN[:\s]?\d{6,}\b/gi,
        replacement: 'MRN: ******',
        description: 'Medical record numbers'
      },
      diagnosis: {
        pattern: /\b(ICD-10?[:\s]?[A-Z]\d{2}\.?\d*)\b/gi,
        replacement: 'ICD: ***.**',
        description: 'ICD codes'
      }
    }
  },

  // Legal
  legal: {
    patterns: {
      caseNumber: {
        pattern: /\bCase\s+No\.?\s*\d{4,}/gi,
        replacement: 'Case No. ****',
        description: 'Legal case numbers'
      }
    }
  },

  // Financial
  financial: {
    patterns: {
      accountNumber: {
        pattern: /\bAcct\.?\s*#?\s*\d{6,}\b/gi,
        replacement: 'Acct: ******',
        description: 'Account numbers'
      },
      routing: {
        pattern: /\bRouting\s*#?\s*\d{9}\b/gi,
        replacement: 'Routing: *********',
        description: 'Routing numbers'
      }
    }
  }
};

/**
 * Masking Configuration
 */
export const MASKING_CONFIG = {
  // Default masking character
  maskChar: '*',
  
  // Preserve structure (keep separators like dashes, spaces)
  preserveStructure: true,
  
  // Minimum length to trigger masking
  minLength: 3,
  
  // Masking intensity levels
  levels: {
    light: 0.3,    // Mask 30% of characters
    medium: 0.6,   // Mask 60% of characters  
    heavy: 0.9,    // Mask 90% of characters
    full: 1.0      // Mask all characters
  },
  
  // Context-aware masking
  contextual: {
    snippets: 'medium',      // Search result snippets
    highlights: 'light',     // Highlighted terms
    logs: 'heavy',          // Log entries
    errors: 'full',         // Error messages
    metadata: 'medium'       // Document metadata
  }
};

// === Core Masking Functions ===

/**
 * Apply all configured PII patterns to text
 */
export function maskPII(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let maskedText = text;
  const applied = [];
  const config = { ...MASKING_CONFIG, ...options };

  // Apply general PII patterns
  for (const [name, rule] of Object.entries(PII_PATTERNS)) {
    if (rule.pattern.test(maskedText)) {
      maskedText = maskedText.replace(rule.pattern, rule.replacement);
      applied.push(name);
    }
  }

  // Apply domain-specific patterns if specified
  if (options.domain && DOMAIN_PATTERNS[options.domain]) {
    const domainPatterns = DOMAIN_PATTERNS[options.domain].patterns;
    for (const [name, rule] of Object.entries(domainPatterns)) {
      if (rule.pattern.test(maskedText)) {
        maskedText = maskedText.replace(rule.pattern, rule.replacement);
        applied.push(`${options.domain}.${name}`);
      }
    }
  }

  return {
    masked: maskedText,
    original: text,
    applied,
    changed: maskedText !== text
  };
}

/**
 * Selective masking based on intensity level
 */
export function maskWithIntensity(text, intensity = 'medium', options = {}) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const config = { ...MASKING_CONFIG, ...options };
  const level = typeof intensity === 'string' ? config.levels[intensity] : intensity;
  
  if (level >= 1.0) {
    // Full masking
    return config.maskChar.repeat(text.length);
  }
  
  const chars = text.split('');
  const maskCount = Math.floor(chars.length * level);
  
  // Create array of indices to mask
  const indices = new Set();
  while (indices.size < maskCount) {
    indices.add(Math.floor(Math.random() * chars.length));
  }
  
  // Apply masking
  for (const index of indices) {
    if (config.preserveStructure && /[\s\-_.,;:]/.test(chars[index])) {
      continue; // Skip structural characters
    }
    chars[index] = config.maskChar;
  }
  
  return chars.join('');
}

/**
 * Context-aware masking for different use cases
 */
export function maskForContext(text, context = 'snippets', options = {}) {
  const config = { ...MASKING_CONFIG, ...options };
  const intensity = config.contextual[context] || 'medium';
  
  // First apply PII masking
  const piiResult = maskPII(text, options);
  
  // Then apply intensity-based masking to remaining text
  let finalText = piiResult.masked;
  
  // Skip intensity masking if PII was already heavily masked
  if (!piiResult.changed || intensity === 'light') {
    finalText = maskWithIntensity(finalText, intensity, options);
  }
  
  return {
    masked: finalText,
    original: text,
    context,
    intensity,
    piiDetected: piiResult.applied,
    changed: finalText !== text
  };
}

// === Search Result Masking ===

/**
 * Mask search result snippets
 */
export function maskSnippets(results, options = {}) {
  if (!Array.isArray(results)) {
    return results;
  }
  
  return results.map(result => {
    const masked = { ...result };
    
    // Mask snippet content
    if (result.snippet) {
      const maskResult = maskForContext(result.snippet, 'snippets', options);
      masked.snippet = maskResult.masked;
      masked._masking = {
        snippet: maskResult
      };
    }
    
    // Mask highlights
    if (result.highlights && Array.isArray(result.highlights)) {
      masked.highlights = result.highlights.map(highlight => {
        const maskResult = maskForContext(highlight, 'highlights', options);
        return maskResult.masked;
      });
    }
    
    // Mask title if it contains PII
    if (result.title) {
      const titleMask = maskPII(result.title, options);
      if (titleMask.changed) {
        masked.title = titleMask.masked;
        masked._masking = {
          ...masked._masking,
          title: titleMask
        };
      }
    }
    
    return masked;
  });
}

/**
 * Mask document metadata
 */
export function maskDocumentMetadata(doc, options = {}) {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  
  const masked = { ...doc };
  const maskingInfo = {};
  
  // Fields that commonly contain PII
  const sensitiveFields = [
    'author', 'creator', 'modifier', 'owner', 
    'description', 'comments', 'notes', 'summary'
  ];
  
  for (const field of sensitiveFields) {
    if (doc[field] && typeof doc[field] === 'string') {
      const maskResult = maskForContext(doc[field], 'metadata', options);
      if (maskResult.changed) {
        masked[field] = maskResult.masked;
        maskingInfo[field] = maskResult;
      }
    }
  }
  
  if (Object.keys(maskingInfo).length > 0) {
    masked._masking = maskingInfo;
  }
  
  return masked;
}

// === Logging and Audit Masking ===

/**
 * Mask log entries
 */
export function maskLogEntry(entry, options = {}) {
  if (typeof entry === 'string') {
    const maskResult = maskForContext(entry, 'logs', options);
    return maskResult.masked;
  }
  
  if (typeof entry === 'object') {
    const masked = { ...entry };
    
    // Mask common log fields
    const logFields = ['message', 'error', 'query', 'user', 'details'];
    
    for (const field of logFields) {
      if (entry[field] && typeof entry[field] === 'string') {
        const maskResult = maskForContext(entry[field], 'logs', options);
        masked[field] = maskResult.masked;
      }
    }
    
    return masked;
  }
  
  return entry;
}

/**
 * Mask error messages
 */
export function maskErrorMessage(error, options = {}) {
  if (typeof error === 'string') {
    const maskResult = maskForContext(error, 'errors', options);
    return maskResult.masked;
  }
  
  if (error instanceof Error) {
    const masked = {
      name: error.name,
      message: maskForContext(error.message, 'errors', options).masked,
      stack: options.includeStack ? 
        maskForContext(error.stack, 'errors', options).masked : 
        '[Stack trace masked]'
    };
    
    return masked;
  }
  
  return error;
}

// === Utility Functions ===

/**
 * Test if text contains PII
 */
export function containsPII(text, patterns = PII_PATTERNS) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  for (const [name, rule] of Object.entries(patterns)) {
    if (rule.pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get PII detection summary
 */
export function analyzePII(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return { hasPII: false, types: [] };
  }
  
  const detected = [];
  
  // Check general patterns
  for (const [name, rule] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(rule.pattern);
    if (matches) {
      detected.push({
        type: name,
        count: matches.length,
        description: rule.description
      });
    }
  }
  
  // Check domain patterns if specified
  if (options.domain && DOMAIN_PATTERNS[options.domain]) {
    const domainPatterns = DOMAIN_PATTERNS[options.domain].patterns;
    for (const [name, rule] of Object.entries(domainPatterns)) {
      const matches = text.match(rule.pattern);
      if (matches) {
        detected.push({
          type: `${options.domain}.${name}`,
          count: matches.length,
          description: rule.description
        });
      }
    }
  }
  
  return {
    hasPII: detected.length > 0,
    types: detected,
    riskLevel: calculateRiskLevel(detected)
  };
}

/**
 * Calculate risk level based on detected PII types
 */
function calculateRiskLevel(detected) {
  if (detected.length === 0) return 'none';
  
  const highRiskTypes = ['ssn', 'creditCard', 'bankAccount', 'medicalId'];
  const mediumRiskTypes = ['email', 'phone', 'ipAddress'];
  
  const hasHighRisk = detected.some(d => 
    highRiskTypes.includes(d.type) || d.type.includes('healthcare')
  );
  
  const hasMediumRisk = detected.some(d => 
    mediumRiskTypes.includes(d.type)
  );
  
  if (hasHighRisk) return 'high';
  if (hasMediumRisk || detected.length > 3) return 'medium';
  return 'low';
}

/**
 * Express middleware for automatic response masking
 */
export function maskingMiddleware(options = {}) {
  return (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Apply masking based on endpoint
      if (req.path.includes('/search')) {
        // Mask search results
        if (data.sources || data.results) {
          const results = data.sources || data.results;
          data.sources = data.results = maskSnippets(results, options);
        }
      }
      
      // Mask error responses
      if (data.error && typeof data.error === 'string') {
        data.error = maskErrorMessage(data.error, options);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// === Export Main Interface ===

export default {
  // Core functions
  maskPII,
  maskWithIntensity,
  maskForContext,
  
  // Specialized functions
  maskSnippets,
  maskDocumentMetadata,
  maskLogEntry,
  maskErrorMessage,
  
  // Analysis functions
  containsPII,
  analyzePII,
  
  // Middleware
  maskingMiddleware,
  
  // Configuration
  PII_PATTERNS,
  DOMAIN_PATTERNS,
  MASKING_CONFIG
};