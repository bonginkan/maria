/**
 * Business Commands Types
 * ビジネス向けスラッシュコマンド用の型定義
 */

export interface BusinessCommandContext {
  userId: string;
  userRole: "executive" | "sales_manager" | "sales" | "marketing" | "pm";
  department: string;
  permissions: string[];
  dataScope: {
    departments: string[] | "all";
    regions: string[] | "all";
    timeRangeDays?: number;
  };
}

export interface SalesDashboardOptions {
  profile?: "sales" | "sales_manager" | "executive";
  days?: number;
  format?: "tui" | "json" | "slack";
  metric?: "ndcg" | "mrr" | "p95" | "conversion" | "all";
  ownerId?: string;
  region?: string;
  compare?: "A,B" | string;
  export?: "pdf" | "csv" | "json";
}

export interface BattlecardOptions {
  competitor: string;
  industry?: string;
  client?: string;
  update?: boolean;
  template?: "default" | "technical" | "executive";
  language?: "ja" | "en";
}

export interface TuneOptions {
  scope?: "sales" | "marketing" | "global";
  preset?: string;
  preview?: boolean;
  rollback?: string;
}

export interface BusinessCommandResult {
  success: boolean;
  message: string;
  data?: any;
  metadata?: {
    executionTimeMs: number;
    recordCount?: number;
    fromCache?: boolean;
    exportPath?: string;
    notificationSent?: boolean;
  };
  error?: {
    code: string;
    details?: any;
  };
}

export interface DashboardDisplayData {
  kpi: {
    totalOpportunities: number;
    totalValue: number;
    winRate: number;
    conversionRate: number;
    averageDealSize: number;
    pipelineVelocity: number;
  };
  trends: {
    date: string;
    newOpportunities: number;
    closedWon: number;
    closedLost: number;
    totalValue: number;
  }[];
  topOpportunities: {
    id: string;
    name: string;
    accountName: string;
    stage: string;
    amount: number;
    probability: number;
    ownerId: string;
    ownerName: string;
  }[];
  stageBreakdown: {
    stage: string;
    count: number;
    value: number;
    averageAge: number;
  }[];
  ownerPerformance: {
    ownerId: string;
    ownerName: string;
    opportunities: number;
    value: number;
    winRate: number;
  }[];
  alerts: string[];
  lastUpdated: Date;
}

export interface TUITheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    background: string;
    foreground: string;
  };
  borders: {
    style: "single" | "double" | "rounded";
    color: string;
  };
  charts: {
    sparklineChars: string;
    barChars: string;
  };
}

// ROLEベースのテーマ定義
export const BUSINESS_TUI_THEMES: Record<string, TUITheme> = {
  sales: {
    name: "Sales Theme",
    colors: {
      primary: "blue",
      secondary: "cyan",
      success: "green",
      warning: "yellow",
      error: "red",
      background: "black",
      foreground: "white",
    },
    borders: {
      style: "single",
      color: "blue",
    },
    charts: {
      sparklineChars: "▁▂▃▄▅▆▇█",
      barChars: "█▇▆▅▄▃▂▁",
    },
  },
  executive: {
    name: "Executive Theme",
    colors: {
      primary: "magenta",
      secondary: "blue",
      success: "green",
      warning: "yellow",
      error: "red",
      background: "black",
      foreground: "white",
    },
    borders: {
      style: "double",
      color: "magenta",
    },
    charts: {
      sparklineChars: "▁▂▃▄▅▆▇█",
      barChars: "█▇▆▅▄▃▂▁",
    },
  },
  marketing: {
    name: "Marketing Theme",
    colors: {
      primary: "green",
      secondary: "cyan",
      success: "green",
      warning: "yellow",
      error: "red",
      background: "black",
      foreground: "white",
    },
    borders: {
      style: "rounded",
      color: "green",
    },
    charts: {
      sparklineChars: "▁▂▃▄▅▆▇█",
      barChars: "█▇▆▅▄▃▂▁",
    },
  },
};
