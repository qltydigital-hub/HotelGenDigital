module.exports = {
    apps: [
        {
            name: 'hotel-dashboard',
            cwd: './hotel-admin-dashboard',
            script: 'start-server.js',
            watch: false,
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        },
        {
            name: 'hotel-webhook-api',
            script: './telegram-bot/index.js',
            exec_mode: 'fork',
            instances: 1,          // KESİNLİKLE 1 — birden fazla instance = 409 Conflict
            autorestart: true,
            watch: false,
            max_restarts: 15,
            restart_delay: 5000,   // Crash sonrası 5sn bekle, bir sonraki restart öncesi
            kill_timeout: 10000,   // SIGTERM sonrası 10sn bekle — process kendi temizliğini yapsın
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production'
            }
        },
        {
            name: 'hotel-telegram-worker',
            script: './telegram-bot/telegram_worker.js',
            exec_mode: 'fork',
            instances: 1,          // KESİNLİKLE 1 — birden fazla instance = 409 Conflict
            autorestart: true,
            watch: false,
            max_restarts: 15,
            restart_delay: 3000,   // Crash sonrası 3sn bekle (eski: 8sn — çok yavaştı)
            kill_timeout: 15000,   // Telegram long-polling kapatılması için 15sn süre tanı
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
            restart_delay: 5000,
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
