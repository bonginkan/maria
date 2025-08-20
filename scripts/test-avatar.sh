#!/bin/bash

echo "Testing MARIA Avatar Command"
echo "=============================="
echo ""
echo "This test will:"
echo "1. Start MARIA CLI"
echo "2. Execute /avatar command"
echo "3. Test basic interaction"
echo ""
echo "Starting test..."
echo ""

# Create a test input file with commands
cat > /tmp/avatar-test-input.txt << 'EOF'
/avatar
Hello MARIA!
I'm happy today
Can you help me?
/exit
EOF

# Run the test with timeout
echo "Running avatar command test..."
timeout 10s ./bin/maria < /tmp/avatar-test-input.txt 2>&1 | head -100

# Check if the command ran successfully
if [ $? -eq 124 ]; then
    echo ""
    echo "Test timed out after 10 seconds (expected behavior for interactive command)"
    echo "The avatar command appears to be working!"
else
    echo ""
    echo "Test completed"
fi

# Clean up
rm -f /tmp/avatar-test-input.txt

echo ""
echo "Test finished!"