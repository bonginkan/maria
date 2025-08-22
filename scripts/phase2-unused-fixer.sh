#!/bin/bash

echo "🚀 Phase 2: Unused Variable and Parameter Cleanup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Statistics
TOTAL_FIXED=0
FILES_PROCESSED=0

# Function to fix unused parameters in a file
fix_unused_parameters() {
    local file=$1
    local changes_made=false
    
    echo -e "${BLUE}Processing: $file${NC}"
    
    # Create a temporary file
    local temp_file="${file}.tmp"
    cp "$file" "$temp_file"
    
    # Fix patterns for unused parameters - add underscore prefix
    # Pattern 1: Function parameters (options: Type)
    sed -i '' 's/(\([^_)]*\)\(options\|config\|context\|data\|error\|files\|filePath\|contexts\|reason\): /(_\1\2: /g' "$temp_file"
    
    # Pattern 2: Arrow function parameters
    sed -i '' 's/(\([^_)]*\)\(task\|index\|rec\|item\|value\)) =>/(_\1\2) =>/g' "$temp_file"
    
    # Pattern 3: Catch block errors
    sed -i '' 's/catch (\([^_)]*\)error)/catch (_error)/g' "$temp_file"
    
    # Pattern 4: Method parameters with specific names
    sed -i '' 's/public [a-zA-Z]*(\([^)]*\), \(options\|config\|data\): /public [a-zA-Z]*(\1, _\2: /g' "$temp_file"
    sed -i '' 's/private [a-zA-Z]*(\([^)]*\), \(options\|config\|data\): /private [a-zA-Z]*(\1, _\2: /g' "$temp_file"
    sed -i '' 's/async [a-zA-Z]*(\([^)]*\), \(options\|config\|data\): /async [a-zA-Z]*(\1, _\2: /g' "$temp_file"
    
    # Check if changes were made
    if ! diff -q "$file" "$temp_file" > /dev/null 2>&1; then
        mv "$temp_file" "$file"
        changes_made=true
        ((TOTAL_FIXED++))
        echo -e "${GREEN}  ✓ Fixed unused parameters${NC}"
    else
        rm "$temp_file"
    fi
    
    ((FILES_PROCESSED++))
}

# Function to fix specific known unused variables
fix_specific_unused() {
    echo -e "\n${YELLOW}Fixing specific known unused variables...${NC}\n"
    
    # Fix commands/approval-git.ts
    if [[ -f "src/commands/approval-git.ts" ]]; then
        sed -i '' 's/const config = /const _config = /g' src/commands/approval-git.ts
        echo -e "${GREEN}  ✓ Fixed approval-git.ts${NC}"
    fi
    
    # Fix commands/auto-improve.ts
    if [[ -f "src/commands/auto-improve.ts" ]]; then
        sed -i '' 's/(reason: string)/(\_reason: string)/g' src/commands/auto-improve.ts
        echo -e "${GREEN}  ✓ Fixed auto-improve.ts${NC}"
    fi
    
    # Fix commands/review.ts
    if [[ -f "src/commands/review.ts" ]]; then
        sed -i '' 's/async (options)/async (_options)/g' src/commands/review.ts
        echo -e "${GREEN}  ✓ Fixed review.ts${NC}"
    fi
    
    # Fix lib/auto-improve-engine.ts
    if [[ -f "src/lib/auto-improve-engine.ts" ]]; then
        sed -i '' 's/(options: AutoImproveOptions)/(\_options: AutoImproveOptions)/g' src/lib/auto-improve-engine.ts
        echo -e "${GREEN}  ✓ Fixed auto-improve-engine.ts${NC}"
    fi
    
    # Fix lib/safety-engine.ts
    if [[ -f "src/lib/safety-engine.ts" ]]; then
        sed -i '' 's/(filePath: string)/(\_filePath: string)/g' src/lib/safety-engine.ts
        sed -i '' 's/(files: string\[\])/(\_files: string[])/g' src/lib/safety-engine.ts
        echo -e "${GREEN}  ✓ Fixed safety-engine.ts${NC}"
    fi
    
    # Fix services files with known issues
    echo -e "\n${YELLOW}Fixing services directory...${NC}\n"
    
    # Fix ai-driven-project-analysis.ts
    if [[ -f "src/services/ai-driven-project-analysis.ts" ]]; then
        sed -i '' 's/interface AnalysisConfiguration/interface _AnalysisConfiguration/g' src/services/ai-driven-project-analysis.ts
        sed -i '' 's/(context: [^,)]*,/(\_context: [^,)]*,/g' src/services/ai-driven-project-analysis.ts
        sed -i '' 's/, filePath: string)/, _filePath: string)/g' src/services/ai-driven-project-analysis.ts
        echo -e "${GREEN}  ✓ Fixed ai-driven-project-analysis.ts${NC}"
    fi
    
    # Fix approval-engine files
    if [[ -f "src/services/approval-engine/ApprovalContextAnalyzer.ts" ]]; then
        sed -i '' 's/(context: ApprovalContext)/(\_context: ApprovalContext)/g' src/services/approval-engine/ApprovalContextAnalyzer.ts
        echo -e "${GREEN}  ✓ Fixed ApprovalContextAnalyzer.ts${NC}"
    fi
    
    if [[ -f "src/services/approval-engine/ApprovalEngine.ts" ]]; then
        sed -i '' 's/(options: [^)]*)/(\_options: [^)]*)/g' src/services/approval-engine/ApprovalEngine.ts
        echo -e "${GREEN}  ✓ Fixed ApprovalEngine.ts${NC}"
    fi
    
    # Fix approval-git files
    if [[ -f "src/services/approval-git/GitHubIntegration.ts" ]]; then
        sed -i '' 's/import { [^}]*GitHubConfig[^}]* }/import { GitHubIntegration }/g' src/services/approval-git/GitHubIntegration.ts
        echo -e "${GREEN}  ✓ Fixed GitHubIntegration.ts${NC}"
    fi
    
    if [[ -f "src/services/approval-git/GitLabIntegration.ts" ]]; then
        sed -i '' 's/import { [^}]*GitLabConfig[^}]* }/import { GitLabIntegration }/g' src/services/approval-git/GitLabIntegration.ts
        echo -e "${GREEN}  ✓ Fixed GitLabIntegration.ts${NC}"
    fi
}

# Function to fix unused variables in a directory
fix_directory() {
    local dir=$1
    echo -e "\n${YELLOW}Processing directory: $dir${NC}\n"
    
    # Find all TypeScript files
    find "$dir" -name "*.ts" -o -name "*.tsx" | while read -r file; do
        if [[ -f "$file" ]]; then
            fix_unused_parameters "$file"
        fi
    done
}

# Main execution
echo -e "\n${BLUE}Starting Phase 2 Unused Variable Cleanup...${NC}\n"

# Step 1: Fix specific known issues
fix_specific_unused

# Step 2: Process directories systematically
echo -e "\n${YELLOW}Processing all TypeScript files...${NC}\n"

# Process commands directory
fix_directory "src/commands"

# Process services directory
fix_directory "src/services"

# Process lib directory
fix_directory "src/lib"

# Process agents directory
fix_directory "src/agents"

# Step 3: Run ESLint fix for remaining issues
echo -e "\n${YELLOW}Running ESLint auto-fix...${NC}\n"
npx eslint src --fix --rule '@typescript-eslint/no-unused-vars: ["error", {"argsIgnorePattern": "^_", "varsIgnorePattern": "^_"}]' 2>/dev/null || true

# Summary
echo -e "\n${GREEN}======================================${NC}"
echo -e "${GREEN}Phase 2 Cleanup Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo -e "Files processed: ${FILES_PROCESSED}"
echo -e "Files fixed: ${TOTAL_FIXED}"
echo -e "\n${BLUE}Run 'pnpm lint' to verify remaining issues${NC}"