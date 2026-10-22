import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import multer from 'multer';

import { extractClientInfo } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import permissionRoutes from './routes/permissions.js';
import auditRoutes from './routes/audit.js';
import aiRoutes from './routes/ai.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware: Helmet with hardened headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-TrustVault-BreakGlass']
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(extractClientInfo);

// Basic IP rate limiting in-memory store
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 300;

app.use((req, res, next) => {
  const ip = req.clientIp || '127.0.0.1';
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };

  if (now > entry.resetTime) {
    entry.count = 1;
    entry.resetTime = now + RATE_LIMIT_WINDOW_MS;
  } else {
    entry.count += 1;
  }

  rateLimitMap.set(ip, entry);

  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: 'TOO_MANY_REQUESTS',
      message: 'Rate limit exceeded. Please throttle requests.'
    });
  }

  next();
});

// Health & System Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'TrustVault Cryptographic Document Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount Core API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);

// Production Static Serving
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Secure Error Handler (Never leak stack traces or internal DB errors to client)
app.use((err, req, res, next) => {
  console.error('[TrustVault Error Handler]:', err.message);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error: 'UPLOAD_ERROR',
      message: err.message
    });
  }

  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An internal server error occurred. This incident has been logged.'
  });
});

// Start Server if directly executed
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  app.listen(PORT, () => {
    console.log(`[TrustVault] Server running securely on http://localhost:${PORT}`);
    console.log(`[TrustVault] Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}

export default app;
