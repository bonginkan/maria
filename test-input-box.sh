#!/bin/bash

echo "Testing MARIA input box display..."
echo "The input box should:"
echo "1. Have a white rectangular border"
echo "2. Show '>' prompt inside the box"
echo "3. Accept input on the same line as '>'"
echo ""
echo "Starting MARIA..."
echo "----------------------------------------"

# Create a test input that shows the box then exits
(
  sleep 2
  echo "test input"
  sleep 1
  echo "/exit"
) | maria

echo ""
echo "Test completed!"