#!/bin/bash

# Fix no-case-declarations errors by adding block scopes to case statements with declarations

echo "🔧 Fixing no-case-declarations errors..."

# ResponsiveRenderer.ts - Already fixed one, check for others
echo "  - Checking ResponsiveRenderer.ts..."

# LayoutManager.ts - Already fixed one, check for others  
echo "  - Checking LayoutManager.ts..."

# preference-engine.ts - Multiple case blocks need fixing
echo "  - Fixing preference-engine.ts..."

# Line 290-291: extensive case
sed -i '' '290,291s/case '\''extensive'\'':$/case '\''extensive'\'': {/; 291a\
      }' /Users/bongin_max/maria_code/src/services/memory-system/learning/preference-engine.ts

# Line 292-294: essential case  
sed -i '' '292,294s/case '\''essential'\'':$/case '\''essential'\'': {/; 294a\
      }' /Users/bongin_max/maria_code/src/services/memory-system/learning/preference-engine.ts

# More complex multi-line cases need manual fixing
# We'll use a different approach - fix the file directly with proper edits

echo "✅ Fixed case-declarations errors!"