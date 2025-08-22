#!/bin/bash

echo "🔧 Fixing missing type definitions..."

# Fix unknownCall references
echo "Fixing unknownCall references..."
sed -i '' 's/unknownCall/unknown/g' src/interfaces/ai-provider.ts

# Add missing type exports to active-reporting/types.ts
echo "Adding missing type exports..."
cat >> src/services/active-reporting/types.ts << 'EOF'

// Missing type definitions added for Phase 1 fix
export interface ProactiveReport {
  id: string;
  timestamp: Date;
  trigger: ReportTrigger;
  content: string;
  summary: string;
  recommendations: Recommendation[];
  data?: Record<string, unknown>;
}

export interface ReportTrigger {
  type: 'scheduled' | 'manual' | 'event' | 'milestone';
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  type: 'action' | 'suggestion' | 'warning';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionable: boolean;
  estimatedImpact?: string;
}
EOF

echo "✅ Missing types fixed!"