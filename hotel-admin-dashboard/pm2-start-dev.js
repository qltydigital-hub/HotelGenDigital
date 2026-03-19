const { execSync } = require('child_process');
console.log("Starting Next.js Dev Server...");
execSync('npx.cmd next dev', { stdio: 'inherit' });
