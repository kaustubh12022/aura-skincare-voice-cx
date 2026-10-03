/**
 * server/server.js
 * Aura Skincare AI Voice Agent ("Aria") - Backend Server Entrypoint
 *
 * Sets up Express HTTP server, static asset hosting for Vite build,
 * REST APIs (healthcheck, order lookups), and attaches the WebSocket server on /ws.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { handleGeminiLiveRelay } from './geminiLiveRelay.js';
import { getOrderDetails, getAllOrders } from './orderDatabase.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Healthcheck Endpoint
app.get('/api/health', (req, res) => {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  res.status(200).json({
    status: 'ok',
    service: 'Aura Skincare AI Voice Relay',
    model: 'gemini-3.8-live',
    apiKeyConfigured: hasApiKey,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Order Lookup REST Endpoints
app.get('/api/orders/:id', (req, res) => {
  const result = getOrderDetails(req.params.id);
  if (result.found) {
    res.status(200).json(result);
  } else {
    res.status(404).json(result);
  }
});

app.get('/api/orders', (req, res) => {
  const orders = getAllOrders();
  res.status(200).json({
    status: 'success',
    count: orders.length,
    orders
  });
});

// Production Static Asset Serving (Vite dist/)
const distPath = path.resolve(__dirname, '../dist');
const hasDist = fs.existsSync(distPath);

if (hasDist) {
  console.log(`[Express] Serving static assets from: ${distPath}`);
  app.use(express.static(distPath));

  // SPA fallback for any non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('[Express] dist/ directory not found. Running in API-only / Development mode.');
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Aura Skincare Relay Server</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0A0D14; color: #F8FAFC; padding: 2.5rem; line-height: 1.6; }
            h1 { color: #FB7185; }
            code { background: #1E293B; padding: 0.2rem 0.5rem; border-radius: 4px; color: #38BDF8; }
            a { color: #F43F5E; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .card { background: rgba(30, 41, 59, 0.6); padding: 1.5rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); max-width: 650px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🌸 Aura Skincare Voice Relay Server is Running</h1>
            <p><strong>WebSocket endpoint:</strong> <code>ws://${req.headers.host || 'localhost:' + PORT}/ws</code></p>
            <p><strong>Health check:</strong> <a href="/api/health">/api/health</a></p>
            <p><strong>Sample Orders:</strong> <a href="/api/orders">/api/orders</a></p>
            <p><em>Frontend runs on Vite dev server (usually http://localhost:5173). Run <code>npm run build</code> to serve the production SPA directly from this port.</em></p>
          </div>
        </body>
      </html>
    `);
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Express Error]', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Create HTTP Server
const server = http.createServer(app);

// Mount WebSocket Server on /ws
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (clientWs, req) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[WebSocket] New client connection established from ${clientIp}`);
  handleGeminiLiveRelay(clientWs, req);
});

wss.on('error', (error) => {
  console.error('[WebSocketServer Error]', error);
});

// Graceful Termination
const shutdown = (signal) => {
  console.log(`\n[Server] Received ${signal}. Closing HTTP and WebSocket connections...`);
  wss.close(() => {
    console.log('[Server] WebSocket server closed.');
    server.close(() => {
      console.log('[Server] HTTP server closed. Exiting process.');
      process.exit(0);
    });
  });

  // Force close after 5s if connections linger
  setTimeout(() => {
    console.error('[Server] Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 5000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start Listening only if run directly (allows importing in tests)
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Aura Skincare Voice Agent Backend ("Aria")`);
    console.log(` HTTP & Healthcheck: http://localhost:${PORT}/api/health`);
    console.log(` WebSocket Endpoint: ws://localhost:${PORT}/ws`);
    console.log(` Environment:        ${process.env.NODE_ENV || 'development'}`);
    console.log(`=======================================================`);
  });
}

export { app, server, wss };
