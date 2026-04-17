module.exports = {
    apps: [
        {
            name: 'hotel-dashboard',
            cwd: './hotel-admin-dashboard',
            script: 'start-server.js',
            watch: false,
            autorestart: true,
            max_restarts: 10,
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        },
        {
            name: 'hotel-webhook-api',
            script: './telegram-bot/index.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'hotel-telegram-worker',
            script: './telegram-bot/telegram_worker.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
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
