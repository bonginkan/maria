/**
 * Approval Theme Registry
 * Predefined approval themes for different categories of development tasks
 */

import { ApprovalTheme, ApprovalCategory, RiskLevel } from './types';

export class ApprovalThemeRegistry {
  private static themes: ApprovalTheme[] = [
    // Architecture Themes
    {
      id: 'arch-new-service',
      category: 'architecture',
      title: 'New Service Creation',
      description: 'Creating a new microservice or major architectural component',
      impact: 'high',
      suggestedApproach:
        'Design service interface, implement core logic, add monitoring and testing',
      alternatives: ['Extend existing service', 'Create lightweight utility function'],
      requiresConfirmation: true,
      estimatedTime: '2-4 hours',
      securityConsiderations: ['Authentication integration', 'Data validation', 'Access control'],
      dependencies: ['Database schema', 'API gateway configuration', 'Service discovery'],
    },
    {
      id: 'arch-database-schema',
      category: 'architecture',
      title: 'Database Schema Changes',
      description: 'Modifying database structure, tables, or relationships',
      impact: 'critical',
      suggestedApproach: 'Create migration scripts, backup existing data, test thoroughly',
      alternatives: ['Use database views', 'Add new tables without removing old ones'],
      requiresConfirmation: true,
      estimatedTime: '1-3 hours',
      securityConsiderations: ['Data integrity', 'Backup procedures', 'Migration rollback'],
      dependencies: ['Database migrations', 'ORM updates', 'Related service updates'],
    },
    {
      id: 'arch-api-design',
      category: 'architecture',
      title: 'API Interface Design',
      description: 'Creating or modifying public API endpoints and contracts',
      impact: 'high',
      suggestedApproach:
        'Define OpenAPI specification, implement with validation, add documentation',
      alternatives: ['Extend existing endpoints', 'Use GraphQL for flexible queries'],
      requiresConfirmation: true,
      estimatedTime: '1-2 hours',
      securityConsiderations: ['Input validation', 'Rate limiting', 'Authentication'],
      dependencies: ['Client applications', 'API documentation', 'Version compatibility'],
    },

    // Implementation Themes
    {
      id: 'impl-feature-addition',
      category: 'implementation',
      title: 'New Feature Implementation',
      description: 'Adding new functionality to existing codebase',
      impact: 'medium',
      suggestedApproach: 'Implement core logic, add tests, update documentation',
      alternatives: ['Feature flag implementation', 'Incremental rollout'],
      requiresConfirmation: true,
      estimatedTime: '30 minutes - 2 hours',
      securityConsiderations: ['Input sanitization', 'Permission checks'],
      dependencies: ['Existing modules', 'Configuration updates'],
    },
    {
      id: 'impl-bug-fix',
      category: 'implementation',
      title: 'Bug Fix Implementation',
      description: 'Fixing identified bugs or issues in the codebase',
      impact: 'low',
      suggestedApproach: 'Identify root cause, implement minimal fix, add regression test',
      alternatives: ['Workaround solution', 'Comprehensive refactor'],
      requiresConfirmation: false,
      estimatedTime: '15 minutes - 1 hour',
      securityConsiderations: ['Side effect analysis'],
      dependencies: ['Related components', 'Test suite updates'],
    },
    {
      id: 'impl-integration',
      category: 'implementation',
      title: 'Third-party Integration',
      description: 'Integrating external APIs, libraries, or services',
      impact: 'high',
      suggestedApproach:
        'Research API documentation, implement with error handling, add monitoring',
      alternatives: ['Use existing integration library', 'Build custom adapter'],
      requiresConfirmation: true,
      estimatedTime: '1-4 hours',
      securityConsiderations: ['API key management', 'Data privacy', 'Rate limiting'],
      dependencies: ['External service availability', 'Configuration management'],
    },

    // Refactoring Themes
    {
      id: 'refactor-performance',
      category: 'refactoring',
      title: 'Performance Optimization',
      description: 'Optimizing code for better performance and efficiency',
      impact: 'medium',
      suggestedApproach:
        'Profile current performance, optimize bottlenecks, benchmark improvements',
      alternatives: ['Caching strategy', 'Algorithm optimization', 'Resource pooling'],
      requiresConfirmation: false,
      estimatedTime: '30 minutes - 2 hours',
      securityConsiderations: ['Memory usage patterns'],
      dependencies: ['Performance monitoring', 'Load testing'],
    },
    {
      id: 'refactor-code-structure',
      category: 'refactoring',
      title: 'Code Structure Improvement',
      description: 'Reorganizing code for better maintainability and readability',
      impact: 'low',
      suggestedApproach: 'Extract functions/classes, improve naming, add documentation',
      alternatives: ['Incremental refactoring', 'Complete module rewrite'],
      requiresConfirmation: false,
      estimatedTime: '20 minutes - 1 hour',
      securityConsiderations: ['Functional equivalence'],
      dependencies: ['Test coverage', 'Code review'],
    },
    {
      id: 'refactor-dependency-update',
      category: 'refactoring',
      title: 'Dependency Updates',
      description: 'Updating external libraries and dependencies',
      impact: 'medium',
      suggestedApproach: 'Update gradually, test compatibility, check for breaking changes',
      alternatives: ['Pin current versions', 'Selective updates'],
      requiresConfirmation: true,
      estimatedTime: '30 minutes - 2 hours',
      securityConsiderations: ['Security patches', 'Vulnerability fixes'],
      dependencies: ['Package compatibility', 'Build system'],
    },

    // Security Themes
    {
      id: 'security-authentication',
      category: 'security',
      title: 'Authentication Implementation',
      description: 'Adding or modifying user authentication systems',
      impact: 'critical',
      suggestedApproach:
        'Use established libraries, implement multi-factor auth, add session management',
      alternatives: ['OAuth integration', 'JWT tokens', 'Session-based auth'],
      requiresConfirmation: true,
      estimatedTime: '2-6 hours',
      securityConsiderations: ['Password hashing', 'Session security', 'Brute force protection'],
      dependencies: ['User database', 'Session storage', 'Security policies'],
    },
    {
      id: 'security-data-protection',
      category: 'security',
      title: 'Data Protection Implementation',
      description: 'Adding encryption, data sanitization, or privacy measures',
      impact: 'high',
      suggestedApproach: 'Implement encryption at rest and transit, add data validation',
      alternatives: ['Database-level encryption', 'Application-level encryption'],
      requiresConfirmation: true,
      estimatedTime: '1-3 hours',
      securityConsiderations: ['Key management', 'Compliance requirements', 'Data retention'],
      dependencies: ['Encryption libraries', 'Key management system'],
    },
    {
      id: 'security-vulnerability-fix',
      category: 'security',
      title: 'Security Vulnerability Fix',
      description: 'Addressing identified security vulnerabilities',
      impact: 'critical',
      suggestedApproach: 'Immediate patch, security testing, incident response',
      alternatives: ['Temporary mitigation', 'Complete system redesign'],
      requiresConfirmation: true,
      estimatedTime: '1-4 hours',
      securityConsiderations: ['Exploit prevention', 'Data breach assessment'],
      dependencies: ['Security audit', 'Incident response plan'],
    },

    // Performance Themes
    {
      id: 'perf-optimization',
      category: 'performance',
      title: 'Performance Optimization',
      description: 'Improving application speed and resource usage',
      impact: 'medium',
      suggestedApproach: 'Profile application, optimize critical paths, implement caching',
      alternatives: ['Database query optimization', 'Algorithm improvements', 'Resource pooling'],
      requiresConfirmation: false,
      estimatedTime: '30 minutes - 3 hours',
      securityConsiderations: ['Resource limits', 'Memory management'],
      dependencies: ['Performance monitoring', 'Load testing tools'],
    },
    {
      id: 'perf-caching',
      category: 'performance',
      title: 'Caching Implementation',
      description: 'Adding caching layers for improved performance',
      impact: 'medium',
      suggestedApproach:
        'Identify cacheable data, implement cache strategy, add invalidation logic',
      alternatives: ['In-memory caching', 'Distributed caching', 'Database caching'],
      requiresConfirmation: false,
      estimatedTime: '1-2 hours',
      securityConsiderations: ['Cache poisoning', 'Sensitive data caching'],
      dependencies: ['Cache infrastructure', 'Monitoring systems'],
    },
    {
      id: 'perf-scaling',
      category: 'performance',
      title: 'Scalability Improvements',
      description: 'Preparing application for increased load and growth',
      impact: 'high',
      suggestedApproach:
        'Implement horizontal scaling, optimize database queries, add load balancing',
      alternatives: ['Vertical scaling', 'Microservices architecture', 'CDN implementation'],
      requiresConfirmation: true,
      estimatedTime: '2-8 hours',
      securityConsiderations: ['Distributed security', 'Session management'],
      dependencies: ['Infrastructure scaling', 'Monitoring systems', 'Load balancers'],
    },
  ];

  /**
   * Get all available approval themes
   */
  static getAllThemes(): ApprovalTheme[] {
    return [...this.themes];
  }

  /**
   * Get themes by category
   */
  static getThemesByCategory(category: ApprovalCategory): ApprovalTheme[] {
    return this.themes.filter((theme) => theme.category === category);
  }

  /**
   * Get theme by ID
   */
  static getThemeById(id: string): ApprovalTheme | undefined {
    return this.themes.find((theme) => theme.id === id);
  }

  /**
   * Get themes by risk level
   */
  static getThemesByRisk(riskLevel: RiskLevel): ApprovalTheme[] {
    return this.themes.filter((theme) => theme.impact === riskLevel);
  }

  /**
   * Get themes that require confirmation
   */
  static getConfirmationRequiredThemes(): ApprovalTheme[] {
    return this.themes.filter((theme) => theme.requiresConfirmation);
  }

  /**
   * Search themes by keywords
   */
  static searchThemes(query: string): ApprovalTheme[] {
    const lowercaseQuery = query.toLowerCase();
    return this.themes.filter(
      (theme) =>
        theme.title.toLowerCase().includes(lowercaseQuery) ||
        theme.description.toLowerCase().includes(lowercaseQuery) ||
        theme.suggestedApproach.toLowerCase().includes(lowercaseQuery),
    );
  }

  /**
   * Add custom theme (for extensibility)
   */
  static addCustomTheme(theme: ApprovalTheme): void {
    // Check for duplicate IDs
    if (this.themes.find((t) => t.id === theme.id)) {
      throw new Error(`Theme with ID '${theme.id}' already exists`);
    }
    this.themes.push(theme);
  }

  /**
   * Get theme statistics
   */
  static getThemeStatistics(): Record<ApprovalCategory, number> {
    const stats: Record<ApprovalCategory, number> = {
      architecture: 0,
      implementation: 0,
      refactoring: 0,
      security: 0,
      performance: 0,
    };

    this.themes.forEach((theme) => {
      stats[theme.category]++;
    });

    return stats;
  }
}
