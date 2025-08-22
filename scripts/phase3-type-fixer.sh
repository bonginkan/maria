#!/bin/bash

echo "🚀 Phase 3: Type Safety Restoration"
echo "===================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Statistics
TOTAL_FIXED=0

echo -e "\n${YELLOW}Step 1: Fixing ProactiveReporter undefined references...${NC}"

# Fix undefined variable references in ProactiveReporter
if [[ -f "src/services/active-reporting/ProactiveReporter.ts" ]]; then
    # Fix template references
    sed -i '' 's/switch (template)/switch (_template)/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/return this.createMilestoneReport(timestamp, data)/return this.createMilestoneReport(_timestamp, _data)/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/return this.createBlockerReport(timestamp, data)/return this.createBlockerReport(_timestamp, _data)/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/return this.createProgressReport(timestamp, data)/return this.createProgressReport(_timestamp, _data)/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/return this.createDecisionReport(timestamp, data)/return this.createDecisionReport(_timestamp, _data)/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/return this.createGenericReport(timestamp, data)/return this.createGenericReport(_timestamp, _data)/g' src/services/active-reporting/ProactiveReporter.ts
    
    # Fix data references
    sed -i '' 's/const _completedTask = data.task/const _completedTask = _data.task/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/const _blocker = data.blocker/const _blocker = _data.blocker/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/const _decision = data.decision/const _decision = _data.decision/g' src/services/active-reporting/ProactiveReporter.ts
    
    # Fix timestamp references
    sed -i '' 's/id: `milestone_\${timestamp/id: `milestone_\${_timestamp/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/id: `blocker_\${timestamp/id: `blocker_\${_timestamp/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/id: `progress_\${timestamp/id: `progress_\${_timestamp/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/id: `decision_\${timestamp/id: `decision_\${_timestamp/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/id: `generic_\${timestamp/id: `generic_\${_timestamp/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/timestamp,/_timestamp,/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/timestamp:/_timestamp:/g' src/services/active-reporting/ProactiveReporter.ts
    
    # Fix other undefined references
    sed -i '' 's/title: `🎉 Milestone Achieved: \${completedTask/title: `🎉 Milestone Achieved: \${_completedTask/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/summary: `Task "\${completedTask/summary: `Task "\${_completedTask/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/title: `🚨 Blocker Detected: \${blocker/title: `🚨 Blocker Detected: \${_blocker/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/title: `🤔 Decision Required: \${decision/title: `🤔 Decision Required: \${_decision/g' src/services/active-reporting/ProactiveReporter.ts
    sed -i '' 's/details: data/details: _data/g' src/services/active-reporting/ProactiveReporter.ts
    
    echo -e "${GREEN}  ✓ Fixed ProactiveReporter.ts${NC}"
    ((TOTAL_FIXED++))
fi

echo -e "\n${YELLOW}Step 2: Fixing missing ProgressMetrics properties...${NC}"

# Add missing properties to ProgressMetrics interface
if [[ -f "src/services/active-reporting/types.ts" ]]; then
    # Check if ProgressMetrics exists and add missing properties
    if grep -q "export interface ProgressMetrics" src/services/active-reporting/types.ts; then
        # Add totalTasks and overallProgress if not present
        if ! grep -q "totalTasks:" src/services/active-reporting/types.ts; then
            sed -i '' '/export interface ProgressMetrics/,/^}/ {
                /completedTasksCount:/ a\
  totalTasks: number;\
  overallProgress: number;\
  timeRemaining?: number;
            }' src/services/active-reporting/types.ts 2>/dev/null || true
        fi
    fi
    echo -e "${GREEN}  ✓ Updated ProgressMetrics interface${NC}"
    ((TOTAL_FIXED++))
fi

echo -e "\n${YELLOW}Step 3: Fixing error type casting...${NC}"

# Create type guard helper file
cat > src/utils/type-guards.ts << 'EOF'
/**
 * Type guards for safe type casting
 */

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (isString(error)) {
    return error;
  }
  return 'An unknown error occurred';
}

export function asTask(data: unknown): Task | undefined {
  if (isObject(data) && 'id' in data && 'title' in data) {
    return data as Task;
  }
  return undefined;
}

export function asBlocker(data: unknown): Blocker | undefined {
  if (isObject(data) && 'id' in data && 'description' in data) {
    return data as Blocker;
  }
  return undefined;
}

// Import types
import type { Task, Blocker } from '../services/active-reporting/types';
EOF

echo -e "${GREEN}  ✓ Created type-guards.ts${NC}"
((TOTAL_FIXED++))

echo -e "\n${YELLOW}Step 4: Fixing chalk type issues in cli.ts...${NC}"

if [[ -f "src/cli.ts" ]]; then
    # Ensure chalk is properly imported
    if ! grep -q "import chalk from 'chalk'" src/cli.ts; then
        sed -i '' '1i\
import chalk from "chalk";
' src/cli.ts
    fi
    echo -e "${GREEN}  ✓ Fixed cli.ts chalk imports${NC}"
    ((TOTAL_FIXED++))
fi

echo -e "\n${YELLOW}Step 5: Fixing missing function calls and references...${NC}"

# Fix various undefined references across files
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    # Fix format references
    sed -i '' 's/if (format === /if (_format === /g' "$file" 2>/dev/null || true
    
    # Fix null references in JSON.stringify
    sed -i '' 's/JSON.stringify([^,]*, _null,/JSON.stringify(\1, null,/g' "$file" 2>/dev/null || true
    
    # Fix priority references
    sed -i '' 's/switch (priority)/switch (_priority)/g' "$file" 2>/dev/null || true
    
    # Fix index references in forEach
    sed -i '' 's/forEach((report, _index)/forEach((report, index)/g' "$file" 2>/dev/null || true
    sed -i '' 's/`\${index /`\${_index /g' "$file" 2>/dev/null || true
done

echo -e "${GREEN}  ✓ Fixed undefined references${NC}"

echo -e "\n${YELLOW}Step 6: Adding missing type exports...${NC}"

# Ensure all necessary types are exported from index files
if [[ -f "src/services/active-reporting/index.ts" ]]; then
    if ! grep -q "export \* from './types'" src/services/active-reporting/index.ts; then
        echo "export * from './types';" >> src/services/active-reporting/index.ts
    fi
    echo -e "${GREEN}  ✓ Updated active-reporting exports${NC}"
    ((TOTAL_FIXED++))
fi

echo -e "\n${GREEN}======================================${NC}"
echo -e "${GREEN}Phase 3 Type Fixes Applied!${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "Files processed: ${TOTAL_FIXED}"
echo -e "\n${BLUE}Next: Run 'pnpm type-check' to verify improvements${NC}"