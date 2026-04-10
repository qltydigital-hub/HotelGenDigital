// PM2 Windows uyumlu başlatma scripti
// next start komutunu doğrudan Node.js üzerinden çalıştırır
process.env.PORT = process.env.PORT || '3000';
process.env.NODE_ENV = 'production';

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = false;
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    })
    .once('error', (err) => {
        console.error(err);
        process.exit(1);
    })
    .listen(port, () => {
        console.log(`✅ [Dashboard] http://${hostname}:${port} adresinde çalışıyor (production)`);
    });
});
