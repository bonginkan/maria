/**
 * Complete PII Protection System with structured data support
 * Handles PII detection, validation, and redaction across all input types
 */

import { EventEmitter } from 'events';

export interface PIIPattern {
  name: string;
  regex: RegExp;
  validator?: (match: string) => boolean;
  replacementTemplate: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface PIIRedactionResult {
  cleanInput: any;
  redactionReport: PIIRedactionReport;
  securityScore: number; // 0-1, lower means more PII detected
}

export interface PIIRedactionReport {
  totalRedacted: number;
  breakdown: Record<string, number>;
  locations: Array<{
    location: string;
    type: string;
    count: number;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  redactionFailures: boolean;
  processingTimeMs: number;
}

export interface RedactionContext {
  location: string;
  dataType: 'string' | 'object' | 'array';
  parentKey?: string;
  depth: number;
}

export class CompletePIIRedactor extends EventEmitter {
  private readonly patterns: PIIPattern[] = [
    // Email addresses
    {
      name: 'email',
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      validator: this.validateEmail.bind(this),
      replacementTemplate: '[EMAIL_REDACTED]',
      riskLevel: 'high'
    },
    
    // Phone numbers (various formats)
    {
      name: 'phone',
      regex: /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
      validator: this.validatePhoneNumber.bind(this),
      replacementTemplate: '[PHONE_REDACTED]',
      riskLevel: 'high'
    },
    
    // Social Security Numbers
    {
      name: 'ssn',
      regex: /\b\d{3}-\d{2}-\d{4}\b/g,
      validator: this.validateSSN.bind(this),
      replacementTemplate: '[SSN_REDACTED]',
      riskLevel: 'high'
    },
    
    // Credit Card Numbers
    {
      name: 'creditcard',
      regex: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
      validator: this.validateLuhn.bind(this),
      replacementTemplate: '[CARD_REDACTED]',
      riskLevel: 'high'
    },
    
    // IBAN (International Bank Account Number)
    {
      name: 'iban',
      regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,
      validator: this.validateIBAN.bind(this),
      replacementTemplate: '[IBAN_REDACTED]',
      riskLevel: 'high'
    },
    
    // API Keys (common patterns)
    {
      name: 'apikey',
      regex: /\b(?:sk|pk|ak)[-_]?[a-zA-Z0-9]{32,}\b/g,
      validator: this.validateAPIKeyPattern.bind(this),
      replacementTemplate: '[APIKEY_REDACTED]',
      riskLevel: 'high'
    },
    
    // JWT Tokens
    {
      name: 'jwt',
      regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      replacementTemplate: '[JWT_REDACTED]',
      riskLevel: 'medium'
    },
    
    // Street Addresses
    {
      name: 'address',
      regex: /\d{1,5}\s[A-Za-z0-9\s,.-]+\s(Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b/g,
      replacementTemplate: '[ADDRESS_REDACTED]',
      riskLevel: 'medium'
    },
    
    // IP Addresses
    {
      name: 'ipaddress',
      regex: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
      validator: this.validateIPAddress.bind(this),
      replacementTemplate: '[IP_REDACTED]',
      riskLevel: 'low'
    },
    
    // MAC Addresses
    {
      name: 'macaddress',
      regex: /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g,
      replacementTemplate: '[MAC_REDACTED]',
      riskLevel: 'low'
    }
  ];

  constructor(
    private readonly options: {
      maxDepth: number;
      maxStringLength: number;
      enableValidation: boolean;
      logRedactions: boolean;
    } = {
      maxDepth: 10,
      maxStringLength: 100000,
      enableValidation: true,
      logRedactions: true
    }
  ) {
    super();
  }

  /**
   * Redact PII from structured input data
   */
  async redactStructured(input: {
    headers?: Record<string, any>;
    body?: any;
    metadata?: Record<string, any>;
  }): Promise<PIIRedactionResult> {
    const startTime = Date.now();
    const redactionReport: PIIRedactionReport = {
      totalRedacted: 0,
      breakdown: {},
      locations: [],
      redactionFailures: false,
      processingTimeMs: 0
    };

    try {
      const cleanInput: any = {};

      // Process headers
      if (input.headers) {
        const context: RedactionContext = { location: 'headers', dataType: 'object', depth: 0 };
        cleanInput.headers = await this.redactData(input.headers, context, redactionReport);
      }

      // Process body
      if (input.body !== undefined) {
        const context: RedactionContext = { location: 'body', dataType: typeof input.body === 'object' ? 'object' : 'string', depth: 0 };
        cleanInput.body = await this.redactData(input.body, context, redactionReport);
      }

      // Process metadata
      if (input.metadata) {
        const context: RedactionContext = { location: 'metadata', dataType: 'object', depth: 0 };
        cleanInput.metadata = await this.redactData(input.metadata, context, redactionReport);
      }

      redactionReport.processingTimeMs = Date.now() - startTime;

      // Calculate security score
      const securityScore = this.calculateSecurityScore(redactionReport);

      if (this.options.logRedactions && redactionReport.totalRedacted > 0) {
        this.emit('piiRedacted', {
          totalRedacted: redactionReport.totalRedacted,
          breakdown: redactionReport.breakdown,
          securityScore,
          processingTimeMs: redactionReport.processingTimeMs
        });
      }

      return {
        cleanInput,
        redactionReport,
        securityScore
      };
    } catch (error) {
      redactionReport.redactionFailures = true;
      redactionReport.processingTimeMs = Date.now() - startTime;
      
      this.emit('redactionError', { error, redactionReport });
      
      // Return original input if redaction fails (fail-safe)
      return {
        cleanInput: input,
        redactionReport,
        securityScore: 0 // Lowest security score due to failure
      };
    }
  }

  /**
   * Redact PII from plain text
   */
  async redactText(text: string, context: RedactionContext = { location: 'text', dataType: 'string', depth: 0 }): Promise<{
    cleanText: string;
    redactionCount: number;
    breakdown: Record<string, number>;
  }> {
    if (!text || typeof text !== 'string') {
      return { cleanText: text, redactionCount: 0, breakdown: {} };
    }

    if (text.length > this.options.maxStringLength) {
      throw new Error(`Text too long: ${text.length} > ${this.options.maxStringLength}`);
    }

    let cleanText = text;
    let totalRedacted = 0;
    const breakdown: Record<string, number> = {};

    for (const pattern of this.patterns) {
      const matches = cleanText.match(pattern.regex);
      if (!matches) continue;

      let validMatches = 0;
      
      for (const match of matches) {
        // Apply validator if available and validation is enabled
        if (this.options.enableValidation && pattern.validator) {
          if (!pattern.validator(match)) {
            continue; // Skip invalid matches
          }
        }
        
        validMatches++;
        cleanText = cleanText.replace(match, pattern.replacementTemplate);
      }

      if (validMatches > 0) {
        breakdown[pattern.name] = (breakdown[pattern.name] || 0) + validMatches;
        totalRedacted += validMatches;
      }
    }

    return {
      cleanText,
      redactionCount: totalRedacted,
      breakdown
    };
  }

  /**
   * Private methods
   */

  private async redactData(data: any, context: RedactionContext, report: PIIRedactionReport): Promise<any> {
    if (context.depth > this.options.maxDepth) {
      throw new Error(`Maximum depth exceeded: ${context.depth}`);
    }

    if (data === null || data === undefined) {
      return data;
    }

    // Handle strings
    if (typeof data === 'string') {
      const result = await this.redactText(data, context);
      
      if (result.redactionCount > 0) {
        report.totalRedacted += result.redactionCount;
        
        // Update breakdown
        for (const [type, count] of Object.entries(result.breakdown)) {
          report.breakdown[type] = (report.breakdown[type] || 0) + count;
        }
        
        // Add location info
        for (const [type, count] of Object.entries(result.breakdown)) {
          const pattern = this.patterns.find(p => p.name === type);
          report.locations.push({
            location: context.location,
            type,
            count,
            riskLevel: pattern?.riskLevel || 'medium'
          });
        }
      }
      
      return result.cleanText;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      const cleanArray = [];
      for (let i = 0; i < data.length; i++) {
        const itemContext: RedactionContext = {
          ...context,
          location: `${context.location}[${i}]`,
          dataType: 'array',
          depth: context.depth + 1
        };
        cleanArray.push(await this.redactData(data[i], itemContext, report));
      }
      return cleanArray;
    }

    // Handle objects
    if (typeof data === 'object') {
      const cleanObject: any = {};
      for (const [key, value] of Object.entries(data)) {
        const itemContext: RedactionContext = {
          ...context,
          location: `${context.location}.${key}`,
          dataType: 'object',
          parentKey: key,
          depth: context.depth + 1
        };
        cleanObject[key] = await this.redactData(value, itemContext, report);
      }
      return cleanObject;
    }

    // Return primitive values as-is
    return data;
  }

  private calculateSecurityScore(report: PIIRedactionReport): number {
    if (report.redactionFailures) {
      return 0; // Worst score if redaction failed
    }

    if (report.totalRedacted === 0) {
      return 1; // Perfect score if no PII found
    }

    // Calculate weighted score based on risk levels
    let riskScore = 0;
    let totalWeight = 0;

    for (const location of report.locations) {
      const weight = location.count;
      let risk = 0;
      
      switch (location.riskLevel) {
        case 'high': risk = 1.0; break;
        case 'medium': risk = 0.6; break;
        case 'low': risk = 0.3; break;
      }
      
      riskScore += risk * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 1;
    }

    const averageRisk = riskScore / totalWeight;
    return Math.max(0, 1 - averageRisk);
  }

  /**
   * Validation methods
   */

  private validateEmail(email: string): boolean {
    // More sophisticated email validation
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    
    const [local, domain] = parts;
    if (local.length === 0 || domain.length === 0) return false;
    if (local.length > 64 || domain.length > 253) return false;
    
    // Check domain has at least one dot
    return domain.includes('.');
  }

  private validatePhoneNumber(phone: string): boolean {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // US phone numbers should have 10 or 11 digits (with country code)
    if (digits.length === 10) {
      // Area code should not start with 0 or 1
      return digits[0] !== '0' && digits[0] !== '1';
    } else if (digits.length === 11) {
      // Country code should be 1
      return digits[0] === '1' && digits[1] !== '0' && digits[1] !== '1';
    }
    
    return false;
  }

  private validateSSN(ssn: string): boolean {
    const parts = ssn.split('-');
    if (parts.length !== 3) return false;
    
    const [area, group, serial] = parts;
    
    // Basic validation rules
    if (area === '000' || area === '666') return false;
    if (area.startsWith('9')) return false;
    if (group === '00') return false;
    if (serial === '0000') return false;
    
    return true;
  }

  private validateLuhn(cardNumber: string): boolean {
    const digits = cardNumber.replace(/\D/g, '');
    
    if (digits.length < 13 || digits.length > 19) {
      return false;
    }
    
    let sum = 0;
    let alternate = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits.charAt(i), 10);
      
      if (alternate) {
        n *= 2;
        if (n > 9) n = (n % 10) + 1;
      }
      
      sum += n;
      alternate = !alternate;
    }
    
    return (sum % 10) === 0;
  }

  private validateIBAN(iban: string): boolean {
    // Basic IBAN validation (simplified)
    if (iban.length < 15 || iban.length > 34) return false;
    
    const countryCode = iban.slice(0, 2);
    const checkDigits = iban.slice(2, 4);
    
    // Country code should be letters
    if (!/^[A-Z]{2}$/.test(countryCode)) return false;
    
    // Check digits should be numbers
    if (!/^\d{2}$/.test(checkDigits)) return false;
    
    return true;
  }

  private validateAPIKeyPattern(key: string): boolean {
    // Basic API key pattern validation
    if (key.length < 20) return false;
    
    // Should contain mix of letters and numbers
    const hasLetter = /[a-zA-Z]/.test(key);
    const hasNumber = /\d/.test(key);
    
    return hasLetter && hasNumber;
  }

  private validateIPAddress(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) return false;
    }
    
    return true;
  }
}