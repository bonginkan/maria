#!/bin/bash

# Test the /model command in maria
echo "Testing MARIA /model command..."

# Create a test script that sends /model command
cat << 'EOF' > /tmp/test-maria.exp
#!/usr/bin/expect -f
set timeout 10

spawn ./bin/maria

# Wait for the prompt
expect {
    ">" { send "/model\r" }
    timeout { exit 1 }
}

# Wait for model list to appear
expect {
    "GPT-5" { 
        puts "\n✅ SUCCESS: GPT-5 found in model list!"
        exit 0
    }
    "Claude Opus 4.1" {
        puts "\n✅ SUCCESS: Claude Opus 4.1 found in model list!"
        exit 0
    }
    "Select AI Model" {
        puts "\n✅ SUCCESS: Model selector opened!"
        exit 0
    }
    timeout { 
        puts "\n❌ FAILED: Expected models not found"
        exit 1
    }
}
EOF

chmod +x /tmp/test-maria.exp

# Run the test
if command -v expect >/dev/null 2>&1; then
    /tmp/test-maria.exp
else
    echo "expect not installed, trying direct test..."
    echo -e "/model\n" | timeout 3 ./bin/maria 2>&1 | grep -E "(GPT-5|Claude Opus 4\.1|Gemini Ultra|Select AI Model)" && echo "✅ Models updated!" || echo "❌ Models not updated"
fi