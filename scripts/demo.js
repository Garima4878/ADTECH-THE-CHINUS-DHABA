// Runs the whole project on this PC with one command:   npm run demo
//
//   database (MongoDB from MONGODB_URI if it is running, otherwise a temporary in-memory one)
//   backend API ............ http://localhost:5000
//   customer website ....... http://localhost:8080/?table=T05   (also from a phone on the same Wi-Fi)
//   AI menu chat ........... http://localhost:4001
//   admin dashboard ........ http://localhost:5173
//
// Online payment is switched on when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (test keys) are in .env.
// For local testing only: deploy the apps separately (see README).
require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

const ROOT = path.join(__dirname, '..');
const PORTS = { api: 5000, web: 8080, ai: 4001, dashboard: 5173 };
const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin';
process.env.SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'chinu-admin-2026';

const lanAddresses = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net.address);

const hosts = ['localhost', '127.0.0.1', ...lanAddresses()];
const websiteOrigins = hosts.map((host) => `http://${host}:${PORTS.web}`);
const dashboardOrigins = hosts.map((host) => `http://${host}:${PORTS.dashboard}`);

// The backend reads CLIENT_URL when it loads, so set it before requiring the app.
process.env.CLIENT_URL = [...websiteOrigins, ...dashboardOrigins].join(',');

const children = [];
let memoryServer = null;

const startChild = (name, args, cwd, env) => {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env } });
  const print = (data) => data.toString().split(/\r?\n/).filter(Boolean).forEach((line) => console.log(`[${name}] ${line}`));
  child.stdout.on('data', print);
  child.stderr.on('data', print);
  children.push(child);
  return child;
};

const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      return `MongoDB at ${uri}`;
    } catch {
      await mongoose.disconnect().catch(() => {});
    }
  }
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('chinu_dhaba'));
  return 'temporary in-memory MongoDB (data is cleared when the demo stops)';
};

// Serves only the website's public files to the network, never .env or source code.
const PUBLIC_FILES = new Set(['/index.html', '/app.js', '/styles.css', '/effects.css', '/effects.js']);
const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' };

const listen = (server, port) =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });

const websiteServer = (onlinePayments) =>
  http.createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const urlPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);

    if (urlPath === '/config.js') {
      // Point the page at the API on the same machine it was opened from (works from a phone too).
      const host = (req.headers.host || 'localhost').replace(/:\d+$/, '');
      res.writeHead(200, { 'Content-Type': CONTENT_TYPES['.js'], 'Cache-Control': 'no-store' });
      return res.end(
        `window.CHINU_CONFIG = ${JSON.stringify({
          apiBaseUrl: `http://${host}:${PORTS.api}`,
          onlinePayments,
          aiAssistantUrl: `http://${host}:${PORTS.ai}`,
        })};\n`
      );
    }

    const file = path.join(ROOT, urlPath);
    const allowed = PUBLIC_FILES.has(urlPath) || (urlPath.startsWith('/assets/') && !urlPath.includes('..'));
    if (!allowed || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  });

const shutdown = async (code = 0) => {
  children.forEach((child) => child.kill());
  await mongoose.disconnect().catch(() => {});
  if (memoryServer) await memoryServer.stop().catch(() => {});
  process.exit(code);
};

(async () => {
  const database = await connectDatabase();
  const { seed } = require('./seed');
  await seed({ log: () => {} });

  const app = require('../src/app');
  await listen(http.createServer(app), PORTS.api);

  const onlinePayments = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  await listen(websiteServer(onlinePayments), PORTS.web);

  const aiDir = path.join(ROOT, 'ai-assistant');
  const aiReady = fs.existsSync(path.join(aiDir, 'node_modules'));
  if (aiReady) {
    startChild('ai', ['src/server.js'], aiDir, {
      PORT: String(PORTS.ai),
      MENU_API_URL: `http://localhost:${PORTS.api}/api/menu`,
      ALLOWED_ORIGINS: websiteOrigins.join(','),
    });
  }

  const dashboardDir = path.join(ROOT, 'admin-dashboard');
  const viteBin = path.join(dashboardDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const dashboardReady = fs.existsSync(viteBin);
  if (dashboardReady) {
    startChild('dashboard', [viteBin, '--host', '0.0.0.0', '--port', String(PORTS.dashboard), '--strictPort'], dashboardDir, {
      VITE_PROXY_TARGET: `http://localhost:${PORTS.api}`,
    });
  }

  const lan = lanAddresses()[0];
  const line = '-'.repeat(70);
  console.log(`\n${line}\n The Chinu Family Restaurant & Dhaba is running   (Ctrl+C to stop)\n${line}`);
  console.log(` Database ........... ${database}`);
  console.log(` Customer website ... http://localhost:${PORTS.web}/?table=T05`);
  if (lan) console.log(`   on your phone .... http://${lan}:${PORTS.web}/?table=T05   (same Wi-Fi)`);
  console.log(` Admin dashboard .... ${dashboardReady ? `http://localhost:${PORTS.dashboard}   login: ${ADMIN_USERNAME} / ${process.env.SEED_ADMIN_PASSWORD}` : 'not installed: run "npm install" in admin-dashboard/'}`);
  console.log(` AI menu chat ....... ${aiReady ? 'on (button on the website)' : 'not installed: run "npm install" in ai-assistant/'}`);
  console.log(` Online payment ..... ${onlinePayments ? 'ON, Razorpay test mode (pay with UPI success@razorpay)' : 'off: add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET to .env'}`);
  console.log(` Tables ............. T01-T10${lan ? `   phone QR codes: npm run qr -- http://${lan}:${PORTS.web}` : ''}`);
  console.log(`${line}\n`);
})().catch(async (error) => {
  console.error('Demo failed to start:', error.message);
  if (error.code === 'EADDRINUSE') console.error('A port is already in use. Close the other program (or an older demo) and try again.');
  await shutdown(1);
});

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
