#!/bin/bash

# Detect if we're on Windows (Git Bash) or Linux/Unix
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || -f "/c/Users/ohclt/AppData/Local/pnpm/pnpm.cmd" ]]; then
    # Windows environment - use full path
    PNPM_CMD="/c/Users/ohclt/AppData/Local/pnpm/pnpm.cmd"
else
    # Linux/Unix environment (like Render) - use pnpm from PATH
    PNPM_CMD="pnpm"
fi

echo "Using pnpm command: $PNPM_CMD"

"$PNPM_CMD" run kill-port
"$PNPM_CMD" run build  
"$PNPM_CMD" run start