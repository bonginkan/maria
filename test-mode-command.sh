#!/bin/bash

# Test script for /mode command functionality
echo "Testing /mode command functionality..."

# Test basic /mode command
echo -e "/mode\n/exit" | node dist/bin/maria.js 2>&1

echo ""
echo "===================================="
echo "Mode command test completed"