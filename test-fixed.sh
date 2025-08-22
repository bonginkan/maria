#\!/bin/bash
echo 'Testing MARIA commands...'

echo '/avatar' | timeout 2s ./bin/maria 2>&1 | tail -10

echo ''
echo 'Testing /voice command...'

echo '/voice' | timeout 2s ./bin/maria 2>&1 | tail -10