#!/bin/bash
echo "Checking for processes on port 5050..."
pids=$(netstat -ano | grep :5050 | awk '{print $5}' | sort -u)
if [ -z "$pids" ]; then
    echo "No process found on port 5050"
else
    for pid in $pids; do
        echo "Killing process $pid on port 5050"
        cmd //c "taskkill /PID $pid /F" 2>/dev/null
    done
    echo "Done."
fi
