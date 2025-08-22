#!/bin/bash

# MARIA v1.8.5 - Comprehensive Slash Command Test
# This script tests all slash commands in the interactive session

echo "=========================================="
echo "MARIA v1.8.5 - Slash Command Test Suite"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL=0
PASSED=0
FAILED=0

# Function to test a command
test_command() {
    local cmd="$1"
    local description="$2"
    TOTAL=$((TOTAL + 1))
    
    echo -n "Testing $cmd - $description... "
    
    # Create a test script that runs the command and exits
    cat > /tmp/test_maria_cmd.txt << EOF
$cmd
/exit
EOF
    
    # Run maria with the test input
    output=$(timeout 5s npx maria < /tmp/test_maria_cmd.txt 2>&1)
    
    # Check if command was recognized (not "Unknown command")
    if echo "$output" | grep -q "Unknown command"; then
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Error: Command not recognized"
        FAILED=$((FAILED + 1))
    else
        echo -e "${GREEN}✓ PASSED${NC}"
        PASSED=$((PASSED + 1))
    fi
}

echo "1. Testing Development Commands"
echo "--------------------------------"
test_command "/code" "Code generation"
test_command "/test" "Test generation"
test_command "/review" "Code review"
test_command "/paper" "Paper to code"
test_command "/model" "Model selection"
test_command "/mode" "Mode management"
echo ""

echo "2. Testing Code Quality Commands"
echo "---------------------------------"
test_command "/bug" "Bug analysis menu"
test_command "/bug report" "Bug reporting"
test_command "/bug analyze" "Bug analysis"
test_command "/lint" "Lint menu"
test_command "/lint check" "Lint checking"
test_command "/typecheck" "Type check menu"
test_command "/typecheck analyze" "Type analysis"
test_command "/security-review" "Security menu"
test_command "/security-review scan" "Security scan"
echo ""

echo "3. Testing Memory System Commands"
echo "----------------------------------"
test_command "/memory" "Memory status"
test_command "/memory status" "Memory statistics"
test_command "/memory preferences" "User preferences"
test_command "/memory context" "Project context"
test_command "/memory help" "Memory help"
echo ""

echo "4. Testing Configuration Commands"
echo "----------------------------------"
test_command "/setup" "Setup wizard"
test_command "/settings" "Settings display"
test_command "/config" "Configuration"
test_command "/priority auto" "Priority mode"
echo ""

echo "5. Testing Media Commands"
echo "--------------------------"
test_command "/image" "Image generation"
test_command "/video" "Video generation"
test_command "/avatar" "Avatar interface"
test_command "/voice" "Voice mode"
echo ""

echo "6. Testing Project Commands"
echo "----------------------------"
test_command "/init" "Project init"
test_command "/add-dir" "Add directory"
test_command "/export" "Export data"
echo ""

echo "7. Testing Agent Commands"
echo "--------------------------"
test_command "/agents" "Agent management"
test_command "/mcp" "MCP integration"
test_command "/ide" "IDE setup"
echo ""

echo "8. Testing System Commands"
echo "---------------------------"
test_command "/status" "System status"
test_command "/health" "Health check"
test_command "/doctor" "System diagnostic"
test_command "/models" "Model list"
test_command "/help" "Help display"
test_command "/clear" "Clear screen"
echo ""

echo "9. Testing Approval Commands"
echo "-----------------------------"
test_command "/approve" "Approval system"
echo ""

echo "=========================================="
echo "Test Results Summary"
echo "=========================================="
echo -e "Total Tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed${NC}"
    exit 1
fi