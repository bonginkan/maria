#!/bin/bash

# Test script to verify the startup display changes
echo "Testing MARIA startup display..."
echo "The script will run for 10 seconds then exit automatically."
echo "Look for:"
echo "1. Single 'Initializing AI Services...' message"
echo "2. Progress bars only shown once"
echo "3. White-bordered input field"
echo ""
echo "Starting MARIA..."
echo "----------------------------------------"

# Run maria and automatically exit after 10 seconds
(sleep 10 && echo "/exit") | maria

echo ""
echo "Test completed!"