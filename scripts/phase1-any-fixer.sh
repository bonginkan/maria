#!/bin/bash

echo "🚀 Phase 1: Emergency any-type replacement script"
echo "================================================"

# Counter for tracking changes
TOTAL_FILES=0
TOTAL_CHANGES=0

# Function to process files
process_files() {
    find src -name "*.ts" -o -name "*.tsx" | while read file; do
        if [[ -f "$file" ]]; then
            # Count initial occurrences
            BEFORE_COUNT=$(grep -c ": any" "$file" 2>/dev/null || echo 0)
            
            # Replace any[] with unknown[]
            sed -i '' 's/: any\[\]/: unknown[]/g' "$file"
            
            # Replace <any> with <unknown>
            sed -i '' 's/<any>/<unknown>/g' "$file"
            
            # Replace <any[]> with <unknown[]>
            sed -i '' 's/<any\[\]>/<unknown[]>/g' "$file"
            
            # Replace : any) with : unknown)
            sed -i '' 's/: any)/: unknown)/g' "$file"
            
            # Replace : any, with : unknown,
            sed -i '' 's/: any,/: unknown,/g' "$file"
            
            # Replace : any; with : unknown;
            sed -i '' 's/: any;/: unknown;/g' "$file"
            
            # Replace : any with : unknown at end of line
            sed -i '' 's/: any$/: unknown/g' "$file"
            
            # Replace : any  (with spaces) with : unknown
            sed -i '' 's/: any /: unknown /g' "$file"
            
            # Count after changes
            AFTER_COUNT=$(grep -c ": any" "$file" 2>/dev/null || echo 0)
            
            if [[ $BEFORE_COUNT -ne $AFTER_COUNT ]]; then
                CHANGES=$((BEFORE_COUNT - AFTER_COUNT))
                TOTAL_CHANGES=$((TOTAL_CHANGES + CHANGES))
                TOTAL_FILES=$((TOTAL_FILES + 1))
                echo "✅ Fixed $CHANGES any-types in: $file"
            fi
        fi
    done
}

echo ""
echo "📂 Processing TypeScript files..."
echo "---------------------------------"

# Run the processing
process_files

echo ""
echo "📊 Summary"
echo "========="
echo "✅ Total files modified: $TOTAL_FILES"
echo "✅ Total any-types replaced: $TOTAL_CHANGES"
echo ""
echo "✨ Phase 1 any-type replacement complete!"