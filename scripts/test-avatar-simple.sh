#!/bin/bash

echo "Testing /avatar command..."
echo -e "/avatar\nexit" | ./bin/maria 2>&1 | grep -A20 "MARIA Avatar"