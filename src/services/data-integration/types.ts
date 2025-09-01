/**
 * Data Integration Types
 * データ統合サービス用の型定義
 */

// CRM連携用型定義
export interface CRMConfig {
  provider: "salesforce" | "hubspot" | "csv";
  apiEndpoint?: string;
  apiVersion?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  csvFilePath?: string;
  rateLimitPerMinute?: number;
  timeout?: number;
}

export interface CRMOpportunity {
  id: string;
  name: string;
  accountId: string;
  accountName: string;
  stage: string;
  amount: number;
  closeDate: string;
  probability: number;
  ownerId: string;
  ownerName: string;
  description?: string;
  leadSource?: string;
  industry?: string;
  territory?: string;
  competitorInfo?: string[];
  nextSteps?: string;
  createdDate: string;
  lastModifiedDate: string;
}

export interface CRMAccount {
  id: string;
  name: string;
  industry?: string;
  type?: "enterprise" | "mid_market" | "smb";
  employeeCount?: number;
  annualRevenue?: number;
  website?: string;
  phone?: string;
  billingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  ownerId: string;
  ownerName: string;
  tier: "enterprise" | "mid_market" | "smb";
  region: string;
  lastActivityDate?: string;
  createdDate: string;
}

export interface SalesMetrics {
  totalOpportunities: number;
  totalValue: number;
  conversionRate: number;
  averageDealSize: number;
  averageSalesCycle: number;
  winRate: number;
  pipelineVelocity: number;
  forecastAccuracy: number;
  byStage: Record<
    string,
    {
      count: number;
      value: number;
      averageAge: number;
    }
  >;
  byOwner: Record<
    string,
    {
      opportunities: number;
      value: number;
      winRate: number;
    }
  >;
  trends: {
    date: string;
    newOpportunities: number;
    closedWon: number;
    closedLost: number;
    totalValue: number;
  }[];
}

// Slack通知用型定義
export interface SlackConfig {
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
  username?: string;
  iconEmoji?: string;
  enabled: boolean;
}

export interface SlackNotification {
  channel?: string;
  text?: string;
  blocks?: any[];
  attachments?: {
    color?: string;
    title?: string;
    text?: string;
    fields?: {
      title: string;
      value: string;
      short: boolean;
    }[];
    timestamp?: number;
  }[];
  threadTs?: string;
  unfurlLinks?: boolean;
}

// PDF生成用型定義
export interface PDFGenerationOptions {
  template: "battlecard" | "sales_report" | "executive_summary" | "custom";
  data: Record<string, any>;
  outputPath?: string;
  format?: "A4" | "Letter";
  orientation?: "portrait" | "landscape";
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  headerFooter?: boolean;
  customStyles?: string;
}

export interface BattlecardData {
  competitor: {
    name: string;
    logo?: string;
    marketShare?: number;
    strengths: string[];
    weaknesses: string[];
    pricing: {
      model: string;
      range: string;
      comparison: "higher" | "similar" | "lower";
    };
  };
  ourSolution: {
    name: string;
    logo?: string;
    strengths: string[];
    uniqueValue: string[];
    pricing: {
      model: string;
      range: string;
      roi: string;
    };
  };
  customerInfo?: {
    name: string;
    industry: string;
    size: string;
    currentSolution?: string;
    painPoints: string[];
    decisionCriteria: string[];
  };
  talkingPoints: {
    openingMessages: string[];
    objectionHandlers: {
      objection: string;
      response: string;
    }[];
    closingMessages: string[];
  };
  caseStudies: {
    customerName: string;
    industry: string;
    challenge: string;
    solution: string;
    results: string[];
  }[];
  metadata: {
    generatedAt: Date;
    version: string;
    lastUpdated: Date;
  };
}

// データ品質監視用型定義
export interface DataQualityCheck {
  checkId: string;
  source: string;
  checkType:
    | "completeness"
    | "accuracy"
    | "consistency"
    | "timeliness"
    | "validity";
  passed: boolean;
  score: number; // 0-100
  issues: DataQualityIssue[];
  checkedAt: Date;
  recordCount: number;
  sampledRecords?: number;
}

export interface DataQualityIssue {
  issueId: string;
  severity: "low" | "medium" | "high" | "critical";
  category: string;
  description: string;
  affectedRecords: number;
  sampleValues?: string[];
  suggestedFix?: string;
  autoFixable: boolean;
}

export interface DataQualityReport {
  reportId: string;
  generatedAt: Date;
  timeRange: { from: Date; to: Date };
  overallScore: number;
  sources: {
    sourceName: string;
    totalChecks: number;
    passedChecks: number;
    score: number;
    criticalIssues: number;
  }[];
  checks: DataQualityCheck[];
  trends: {
    date: string;
    overallScore: number;
    sourceScores: Record<string, number>;
  }[];
  recommendations: {
    priority: "high" | "medium" | "low";
    action: string;
    expectedImprovement: string;
    estimatedEffort: string;
  }[];
}

// キャッシュ用型定義
export interface CacheConfig {
  enabled: boolean;
  ttlSeconds: number;
  maxSize?: number;
  compressionEnabled?: boolean;
  persistToDisk?: boolean;
  diskPath?: string;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessAt: Date;
  compressed?: boolean;
}

// 統合エラー処理
export interface IntegrationError {
  code: string;
  message: string;
  source: string;
  details?: Record<string, any>;
  retryable: boolean;
  timestamp: Date;
}

export interface IntegrationResult<T = any> {
  success: boolean;
  data?: T;
  error?: IntegrationError;
  metadata?: {
    executionTimeMs: number;
    fromCache: boolean;
    recordCount?: number;
    apiCallCount?: number;
    rateLimitRemaining?: number;
  };
}
