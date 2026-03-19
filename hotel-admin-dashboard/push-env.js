const fs = require('fs');
const { execSync } = require('child_process');

console.log("Reading .env.local...");
const envContent = fs.readFileSync('.env.local', 'utf-8');
const lines = envContent.split(/\r?\n/);

for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    // Split safely on first '='
    const firstEq = line.indexOf('=');
    if (firstEq === -1) continue;

    const key = line.substring(0, firstEq).trim();
    let value = line.substring(firstEq + 1).trim();

    // Remove surrounding quotes if they exist
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
    }

    if (key && value) {
        console.log(`Pushing ${key} to Vercel...`);
        try {
            for (const env of ['production', 'preview', 'development']) {
                const command = `npx vercel env add ${key} ${env} --force`;
                try {
                    execSync(command, { input: value, stdio: ['pipe', 'inherit', 'inherit'] });
                } catch (e) {
                    console.log(`Failed to push to ${env}, might already exist or need forced overwrite.`);
                }
            }
            console.log(`✅ Success: ${key}`);
        } catch (e) {
            console.error(`❌ Failed: ${key}`);
        }
    }
}

console.log("\nAll environment variables have been processed.");
console.log("Triggering a new deployment to apply changes...");
try {
    execSync('npx vercel --prod --yes', { stdio: 'inherit' });
    console.log("✅ Final deployment completed!");
} catch(e) {
    console.error("❌ Final deployment failed.");
}
