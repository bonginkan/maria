#!/bin/bash

# Test script for Internal Mode System functionality
echo "Testing Internal Mode System..."

# Test internal mode list
echo -e "/mode internal list\n/exit" | node dist/bin/maria.js 2>&1 | head -50

echo ""
echo "===================================="
echo "Testing mode switching..."

# Test mode switching
echo -e "/mode internal debugging\n/exit" | node dist/bin/maria.js 2>&1 | head -30

echo ""
echo "===================================="
echo "Internal mode tests completed"