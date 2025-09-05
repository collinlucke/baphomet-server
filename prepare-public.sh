#!/bin/bash

# Script to create a separate public repository with sanitized code
# This DOES NOT affect your main development repository

PUBLIC_REPO_NAME="baphomet-server-public"
PUBLIC_REPO_PATH="../${PUBLIC_REPO_NAME}"

echo "Creating public version of baphomet-server..."
echo "Source: $(pwd)"
echo "Target: ${PUBLIC_REPO_PATH}"

# Remove existing public directory if it exists
rm -rf "${PUBLIC_REPO_PATH}"

# Create fresh public directory
mkdir -p "${PUBLIC_REPO_PATH}"

# Copy safe files and directories
cp package.json "${PUBLIC_REPO_PATH}/"
cp tsconfig.json "${PUBLIC_REPO_PATH}/"
cp README.md "${PUBLIC_REPO_PATH}/"
cp API_REFERENCE.md "${PUBLIC_REPO_PATH}/"
cp CHANGELOG.md "${PUBLIC_REPO_PATH}/"
cp DEVELOPMENT.md "${PUBLIC_REPO_PATH}/"

# Copy public interface files
mkdir -p "${PUBLIC_REPO_PATH}/src"
cp src/schema.graphql "${PUBLIC_REPO_PATH}/src/"
cp src/resolvers.public.js "${PUBLIC_REPO_PATH}/src/resolvers.js"
cp src/dBConnection.public.js "${PUBLIC_REPO_PATH}/src/dBConnection.js"
cp src/authenticateToken.public.js "${PUBLIC_REPO_PATH}/src/authenticateToken.js"

# Create placeholder server.ts
cat > "${PUBLIC_REPO_PATH}/src/server.ts" << 'EOF'
// Public server interface - implementation details hidden
// This shows the server structure without revealing configuration details

import express from 'express';
import { ApolloServer } from 'apollo-server-express';

const app = express();
const PORT = process.env.PORT || 5050;

// Server configuration hidden - proprietary setup and middleware
console.log('Server implementation not available in public version');
console.log('This is a demonstration of the API structure only');

export default app;
EOF

# Create placeholder generateToken.js
cat > "${PUBLIC_REPO_PATH}/src/generateToken.js" << 'EOF'
// Token generation implementation not available in public version
module.exports = {
  generateAccessToken: () => {
    throw new Error('Implementation not available in public version');
  }
};
EOF

# Create public package.json without sensitive scripts
node -e "
const pkg = JSON.parse(require('fs').readFileSync('package.json', 'utf8'));
pkg.name = 'baphomet-server-public';
pkg.description = 'Public API interface for Baphomet Server - implementation details not included';
delete pkg.scripts.deploy;
delete pkg.scripts['deploy:render'];
pkg.scripts.note = 'This is a public interface repository - actual implementation not included';
require('fs').writeFileSync('${PUBLIC_REPO_PATH}/package.json', JSON.stringify(pkg, null, 2));
"

# Create .gitignore for public repo
cat > "${PUBLIC_REPO_PATH}/.gitignore" << 'EOF'
/node_modules
.env
.npmrc
/dist
EOF

# Create LICENSE file
cat > "${PUBLIC_REPO_PATH}/LICENSE" << 'EOF'
MIT License

Copyright (c) 2024 Baphomet Server

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Note: This public repository contains only API interfaces and documentation.
Actual implementation details are not included.
EOF

cd "${PUBLIC_REPO_PATH}"

# Initialize git repository
git init
git add .
git commit -m "Initial public release - API interfaces only"

echo ""
echo "✅ Public repository created at: ${PUBLIC_REPO_PATH}"
echo ""
echo "Next steps:"
echo "1. cd ${PUBLIC_REPO_PATH}"
echo "2. git remote add origin https://github.com/yourusername/baphomet-server.git"
echo "3. git push -u origin main"
echo ""
echo "Your private development repository remains unchanged at: $(pwd)"
