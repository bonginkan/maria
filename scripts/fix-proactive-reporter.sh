#!/bin/bash

echo "🔧 Fixing ProactiveReporter parameter issues..."

# Fix underscore parameter issues - remove underscore from parameters that are actually used
sed -i '' 's/public addTrigger(_trigger: ReportTrigger)/public addTrigger(trigger: ReportTrigger)/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/public setReportingEnabled(_enabled: boolean)/public setReportingEnabled(enabled: boolean)/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/public setReportingInterval(_minutes: number)/public setReportingInterval(minutes: number)/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/public checkTriggers(event: string, _data: unknown)/public checkTriggers(event: string, data: unknown)/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/private shouldTriggerReport(_trigger: ReportTrigger, event: string, _data: unknown)/private shouldTriggerReport(trigger: ReportTrigger, event: string, data: unknown)/g' src/services/active-reporting/ProactiveReporter.ts

# Fix task parameter issues
sed -i '' 's/\.map((_task)/\.map((task)/g' src/services/active-reporting/ProactiveReporter.ts
sed -i '' 's/\.filter((_task)/\.filter((task)/g' src/services/active-reporting/ProactiveReporter.ts

# Fix index parameter issues
sed -i '' 's/\.map((rec, _index)/.map((rec, index)/g' src/services/active-reporting/ProactiveReporter.ts

echo "✅ ProactiveReporter parameters fixed!"