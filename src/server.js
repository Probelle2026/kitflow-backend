require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const authMiddleware = require('./middleware/auth');
const influencersRouter = require('./routes/influencers');
const analyticsRouter = require('./routes/analytics');
const messagesRouter = require('./routes/messages');
const { startJobs } = require('./jobs/tracking');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','x-api-secret'],
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use(limiter);

// Health check (no auth required)
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, message: 'KitFlow backend online', timestamp: new Date() });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

// Auth on all /api routes
app.use('/api', authMiddleware);

// Routes
app.use('/api/influencers', influencersRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/messages', messagesRouter);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, async () => {
  console.log(`🚀 KitFlow backend rodando na porta ${PORT}`);
  
  // Start cron jobs
  if (process.env.NODE_ENV !== 'test') {
    startJobs();
  }
});

module.exports = app;
