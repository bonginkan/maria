#!/bin/bash

echo "🔧 Fixing ProactiveReporter type issues comprehensively..."

# Fix the timestamp property name issue
sed -i '' 's/_timestamp,/timestamp,/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/_timestamp:/timestamp:/g' src/services/active-reporting/ProactiveReporter.ts

# Fix undefined variable references
sed -i '' 's/id: completedTask/id: _completedTask/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/title: completedTask/title: _completedTask/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/actualTime: completedTask/actualTime: _completedTask/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/estimatedTime: completedTask/estimatedTime: _completedTask/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/recommendations: this.generateMilestoneRecommendations(completedTask)/recommendations: this.generateMilestoneRecommendations(_completedTask)/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/visualRepresentation: this.taskVisualizer.renderTaskCompletion(completedTask)/visualRepresentation: this.taskVisualizer.renderTaskCompletion(_completedTask)/g' src/services/active-reporting/ProactiveReporter.ts

# Fix blocker references
sed -i '' 's/blockers: \[blocker\]/blockers: [_blocker]/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/recommendations: this.generateBlockerRecommendations(blocker)/recommendations: this.generateBlockerRecommendations(_blocker)/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/visualRepresentation: this.taskVisualizer.renderBlockerAlert(blocker)/visualRepresentation: this.taskVisualizer.renderBlockerAlert(_blocker)/g' src/services/active-reporting/ProactiveReporter.ts

# Fix decision references
sed -i '' 's/decisions: \[decision\]/decisions: [_decision]/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/recommendations: this.generateDecisionRecommendations(decision)/recommendations: this.generateDecisionRecommendations(_decision)/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/visualRepresentation: this.taskVisualizer.renderDecisionPoint(decision)/visualRepresentation: this.taskVisualizer.renderDecisionPoint(_decision)/g' src/services/active-reporting/ProactiveReporter.ts

# Fix progressData references
sed -i '' 's/progressData\./\_progressData\./g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/recommendations: this.generateProgressRecommendations(progressData)/recommendations: this.generateProgressRecommendations(_progressData)/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/visualRepresentation: this.taskVisualizer.renderProgressDashboard(progressData)/visualRepresentation: this.taskVisualizer.renderProgressDashboard(_progressData)/g' src/services/active-reporting/ProactiveReporter.ts

# Fix markdown references
sed -i '' 's/markdown +=/\_markdown +=/g' src/services/active-reporting/ProactiveReporter.ts

# Fix JSON.stringify null parameter
sed -i '' 's/JSON.stringify(this.reportHistory, _null, 2)/JSON.stringify(this.reportHistory, null, 2)/g' src/services/active-reporting/ProactiveReporter.ts

# Fix task/index references
sed -i '' 's/if (task\./if (_task./g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/return task\./return _task./g' src/services/active-reporting/ProactiveReporter.ts

# Fix trigger references
sed -i '' 's/this.generateReport(trigger/this.generateReport(_trigger/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/await this.createReport(trigger/await this.createReport(_trigger/g' src/services/active-reporting/ProactiveReporter.ts

# Fix index references
sed -i '' 's/\${_index /\${index /g' src/commands/approval-git.ts
sed -i '' 's/\${_index /\${index /g' src/commands/auto-improve.ts
sed -i '' 's/\${_index /\${index /g' src/services/approval-git/GitHubIntegration.ts
sed -i '' 's/\${_index /\${index /g' src/services/approval-git/GitLabIntegration.ts

# Fix format references
sed -i '' 's/if (_format ===/if (format ===/g' src/commands/auto-improve.ts

# Fix priority references
sed -i '' 's/switch (_priority)/switch (priority)/g' src/commands/active-reporting.ts

echo "✅ ProactiveReporter fixes applied!"