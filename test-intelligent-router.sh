#!/bin/bash

# Test script for Intelligent Router functionality
echo "Testing Intelligent Router natural language capabilities..."

echo "Testing Japanese natural language command..."
# Test Japanese natural language: "コードを書いて" should route to /code
echo -e "コードを書いて\n/exit" | node dist/bin/maria.js 2>&1 | head -30

echo ""
echo "===================================="
echo "Testing English natural language command..."

# Test English natural language: "write code" should route to /code  
echo -e "write code\n/exit" | node dist/bin/maria.js 2>&1 | head -30

echo ""
echo "===================================="
echo "Natural language routing tests completed"