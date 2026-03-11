module.exports = {
    apps: [
        {
            name: 'hotel-dashboard',
            cwd: './hotel-admin-dashboard',
            script: 'node_modules/.bin/next',
            args: 'dev',
            interpreter: 'none',
            watch: false,
            autorestart: true,
            max_restarts: 10,
            env: {
                NODE_ENV: 'development',
                PORT: 3000
            }
        },
        {
            name: 'hotel-telegram-bot',
            cwd: './telegram-bot',
            script: 'index.js',
            watch: false,
            autorestart: true,
            max_restarts: 10,
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'hotel-rapor-bot',
            cwd: './rapor-bot',
            script: 'index.js',
            watch: false,
            autorestart: true,
            max_restarts: 10,
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
