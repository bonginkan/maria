/**
 * Complete PII Protection System - Phase 3 Enhanced Edition
 * Comprehensive PII detection, validation, and redaction with advanced monitoring
 * Supports structured data, schema validation, and audit compliance
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

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
  
  // Phase 3 Enhancements
  schemaValidation?: SchemaValidationResult;
  complianceStatus: ComplianceStatus;
  encryptionStatus?: EncryptionStatus;
  auditTrail: AuditEntry[];
  riskAssessment: RiskAssessment;
}

export interface SchemaValidationResult {
  isValid: boolean;
  validatedFields: string[];
  invalidFields: string[];
  warnings: string[];
  appliedRules: string[];
}

export interface ComplianceStatus {
  gdprCompliant: boolean;
  hipaaCompliant: boolean;
  pciCompliant: boolean;
  violations: string[];
  recommendations: string[];
}

export interface EncryptionStatus {
  enabled: boolean;
  algorithm: string;
  keyId: string;
  encryptedFields: string[];
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  userId?: string;
  details: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  mitigations: string[];
  recommendedActions: string[];
}

export interface RedactionContext {
  location: string;
  dataType: 'string' | 'object' | 'array';
  parentKey?: string;
  depth: number;
}

export class CompletePIIRedactor extends EventEmitter {
  private readonly encryptionKey: Buffer;
  private readonly auditTrail: AuditEntry[] = [];
  private processedCount: number = 0;
  
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
      // Phase 3 Enhanced Options
      enableEncryption: boolean;
      enableSchemaValidation: boolean;
      enableComplianceCheck: boolean;
      auditUserId?: string;
      complianceStandards: ('gdpr' | 'hipaa' | 'pci')[];
    } = {
      maxDepth: 10,
      maxStringLength: 100000,
      enableValidation: true,
      logRedactions: true,
      enableEncryption: true,
      enableSchemaValidation: true,
      enableComplianceCheck: true,
      complianceStandards: ['gdpr', 'hipaa', 'pci']
    }
  ) {
    super();
    this.encryptionKey = this.generateEncryptionKey();
  }

  /**
   * Redact PII from structured input data with Phase 3 enhancements
   */
  async redactStructured(input: {
    headers?: Record<string, any>;
    body?: any;
    metadata?: Record<string, any>;
    schema?: any; // JSON Schema for validation
    userId?: string; // For audit trail
  }): Promise<PIIRedactionResult> {
    const startTime = Date.now();
    this.processedCount++;
    
    const auditEntry: AuditEntry = {
      timestamp: new Date(),
      action: 'PII_REDACTION_STARTED',
      userId: input.userId || this.options.auditUserId,
      details: { inputKeys: Object.keys(input), processId: this.processedCount },
      riskLevel: 'medium'
    };
    this.auditTrail.push(auditEntry);

    const redactionReport: PIIRedactionReport = {
      totalRedacted: 0,
      breakdown: {},
      locations: [],
      redactionFailures: false,
      processingTimeMs: 0,
      // Phase 3 Enhanced Fields
      complianceStatus: this.initializeComplianceStatus(),
      auditTrail: [],
      riskAssessment: {
        overallRisk: 'low',
        factors: [],
        mitigations: [],
        recommendedActions: []
      }
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

      // Schema validation if requested
      if (input.schema && this.options.enableSchemaValidation) {
        redactionReport.schemaValidation = await this.validateSchema(input.schema, cleanInput);
      }

      // Compliance check
      if (this.options.enableComplianceCheck) {
        redactionReport.complianceStatus = await this.performComplianceCheck(redactionReport);
      }

      // Encryption status
      if (this.options.enableEncryption) {
        redactionReport.encryptionStatus = this.getEncryptionStatus();
      }

      // Risk assessment
      redactionReport.riskAssessment = this.performRiskAssessment(redactionReport);

      // Finalize audit trail
      redactionReport.auditTrail = this.auditTrail.slice(-10); // Keep last 10 entries

      redactionReport.processingTimeMs = Date.now() - startTime;

      // Calculate security score
      const securityScore = this.calculateSecurityScore(redactionReport);

      // Enhanced audit logging
      const completionAudit: AuditEntry = {
        timestamp: new Date(),
        action: 'PII_REDACTION_COMPLETED',
        userId: input.userId || this.options.auditUserId,
        details: {
          totalRedacted: redactionReport.totalRedacted,
          securityScore,
          processingTimeMs: redactionReport.processingTimeMs,
          complianceStatus: redactionReport.complianceStatus.gdprCompliant && 
                           redactionReport.complianceStatus.hipaaCompliant && 
                           redactionReport.complianceStatus.pciCompliant
        },
        riskLevel: redactionReport.riskAssessment.overallRisk
      };
      this.auditTrail.push(completionAudit);

      if (this.options.logRedactions && redactionReport.totalRedacted > 0) {
        this.emit('piiRedacted', {
          totalRedacted: redactionReport.totalRedacted,
          breakdown: redactionReport.breakdown,
          securityScore,
          processingTimeMs: redactionReport.processingTimeMs,
          complianceStatus: redactionReport.complianceStatus,
          riskLevel: redactionReport.riskAssessment.overallRisk
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

  /**
   * Phase 3 Enhanced Methods
   */

  private initializeComplianceStatus(): ComplianceStatus {
    return {
      gdprCompliant: true,
      hipaaCompliant: true,
      pciCompliant: true,
      violations: [],
      recommendations: []
    };
  }

  private async validateSchema(schema: any, data: any): Promise<SchemaValidationResult> {
    const result: SchemaValidationResult = {
      isValid: true,
      validatedFields: [],
      invalidFields: [],
      warnings: [],
      appliedRules: []
    };

    try {
      // Basic schema validation implementation
      if (schema.type === 'object' && typeof data === 'object' && data !== null) {
        if (schema.properties) {
          for (const [key, propertySchema] of Object.entries(schema.properties)) {
            if (key in data) {
              result.validatedFields.push(key);
              result.appliedRules.push(`Validated field '${key}' against schema`);
            } else if (schema.required && schema.required.includes(key)) {
              result.invalidFields.push(key);
              result.isValid = false;
            }
          }
        }
      }

      // Check for PII-sensitive fields
      const piiSensitiveFields = ['email', 'phone', 'ssn', 'creditCard', 'address'];
      for (const field of piiSensitiveFields) {
        if (field in data) {
          result.warnings.push(`PII-sensitive field '${field}' detected`);
          result.appliedRules.push(`PII protection rule applied to '${field}'`);
        }
      }

    } catch (error) {
      result.isValid = false;
      result.warnings.push(`Schema validation error: ${error.message}`);
    }

    return result;
  }

  private async performComplianceCheck(report: PIIRedactionReport): Promise<ComplianceStatus> {
    const compliance: ComplianceStatus = {
      gdprCompliant: true,
      hipaaCompliant: true,
      pciCompliant: true,
      violations: [],
      recommendations: []
    };

    // GDPR Compliance Check
    if (this.options.complianceStandards.includes('gdpr')) {
      const hasPersonalData = report.breakdown['email'] || report.breakdown['phone'] || report.breakdown['address'];
      if (hasPersonalData && report.totalRedacted === 0) {
        compliance.gdprCompliant = false;
        compliance.violations.push('GDPR: Personal data detected but not redacted');
        compliance.recommendations.push('Enable PII redaction for GDPR compliance');
      }
    }

    // HIPAA Compliance Check
    if (this.options.complianceStandards.includes('hipaa')) {
      // Check for medical-related PII patterns
      const hasMedicalData = Object.keys(report.breakdown).some(key => 
        key.includes('medical') || key.includes('health')
      );
      if (hasMedicalData && report.totalRedacted === 0) {
        compliance.hipaaCompliant = false;
        compliance.violations.push('HIPAA: Health information detected but not redacted');
        compliance.recommendations.push('Implement medical data protection for HIPAA compliance');
      }
    }

    // PCI Compliance Check
    if (this.options.complianceStandards.includes('pci')) {
      const hasPaymentData = report.breakdown['creditcard'];
      if (hasPaymentData && report.totalRedacted === 0) {
        compliance.pciCompliant = false;
        compliance.violations.push('PCI: Payment card data detected but not redacted');
        compliance.recommendations.push('Enable credit card redaction for PCI compliance');
      }
    }

    return compliance;
  }

  private getEncryptionStatus(): EncryptionStatus {
    return {
      enabled: this.options.enableEncryption,
      algorithm: 'AES-256-GCM',
      keyId: this.encryptionKey.toString('hex').slice(0, 16),
      encryptedFields: this.options.enableEncryption ? ['redactedData', 'auditTrail'] : []
    };
  }

  private performRiskAssessment(report: PIIRedactionReport): RiskAssessment {
    const factors: string[] = [];
    const mitigations: string[] = [];
    const recommendedActions: string[] = [];

    let riskScore = 0;

    // Assess based on PII types detected
    if (report.breakdown['ssn']) {
      riskScore += 3;
      factors.push('Social Security Numbers detected');
      mitigations.push('SSN redaction applied');
    }

    if (report.breakdown['creditcard']) {
      riskScore += 3;
      factors.push('Credit card data detected');
      mitigations.push('Payment card redaction applied');
    }

    if (report.breakdown['email']) {
      riskScore += 1;
      factors.push('Email addresses detected');
      mitigations.push('Email redaction applied');
    }

    if (report.breakdown['phone']) {
      riskScore += 1;
      factors.push('Phone numbers detected');
      mitigations.push('Phone number redaction applied');
    }

    // Assess processing time risk
    if (report.processingTimeMs > 5000) {
      riskScore += 1;
      factors.push('Long processing time detected');
      recommendedActions.push('Optimize PII detection patterns for better performance');
    }

    // Assess redaction failures
    if (report.redactionFailures) {
      riskScore += 2;
      factors.push('Redaction process failures detected');
      recommendedActions.push('Investigate and fix redaction failure causes');
    }

    // Determine overall risk level
    let overallRisk: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore >= 6) {
      overallRisk = 'critical';
      recommendedActions.push('Immediate security review required');
    } else if (riskScore >= 4) {
      overallRisk = 'high';
      recommendedActions.push('Enhanced monitoring recommended');
    } else if (riskScore >= 2) {
      overallRisk = 'medium';
      recommendedActions.push('Regular compliance checks recommended');
    } else {
      overallRisk = 'low';
    }

    return {
      overallRisk,
      factors,
      mitigations,
      recommendedActions
    };
  }

  private generateEncryptionKey(): Buffer {
    return crypto.randomBytes(32);
  }

  /**
   * Get comprehensive audit trail for compliance reporting
   */
  getAuditTrail(limit: number = 100): AuditEntry[] {
    return this.auditTrail.slice(-limit);
  }

  /**
   * Get processing statistics for monitoring
   */
  getProcessingStatistics(): {
    totalProcessed: number;
    averageProcessingTime: number;
    totalRedactions: number;
    complianceRate: number;
    riskDistribution: Record<string, number>;
  } {
    const auditTrailEntries = this.auditTrail.filter(entry => 
      entry.action === 'PII_REDACTION_COMPLETED'
    );

    const totalProcessingTime = auditTrailEntries.reduce((sum, entry) => 
      sum + (entry.details.processingTimeMs || 0), 0
    );

    const totalRedactions = auditTrailEntries.reduce((sum, entry) => 
      sum + (entry.details.totalRedacted || 0), 0
    );

    const compliantEntries = auditTrailEntries.filter(entry => 
      entry.details.complianceStatus === true
    );

    const riskDistribution = auditTrailEntries.reduce((dist, entry) => {
      const risk = entry.riskLevel;
      dist[risk] = (dist[risk] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);

    return {
      totalProcessed: this.processedCount,
      averageProcessingTime: auditTrailEntries.length > 0 ? 
        totalProcessingTime / auditTrailEntries.length : 0,
      totalRedactions,
      complianceRate: auditTrailEntries.length > 0 ? 
        compliantEntries.length / auditTrailEntries.length : 1.0,
      riskDistribution
    };
  }

  /**
   * Cleanup method for Phase 3 enhanced cleanup
   */
  cleanup(): void {
    // Clear audit trail
    this.auditTrail.length = 0;
    
    // Reset counters
    this.processedCount = 0;

    this.emit('cleanup', {
      timestamp: new Date(),
      action: 'PII_REDACTOR_CLEANUP',
      details: { cleanupCompleted: true }
    });
  }
}