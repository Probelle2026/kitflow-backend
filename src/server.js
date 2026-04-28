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

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','x-api-secret'] }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 200 }));

app.get('/health', (req, res) => {
  res.json({ ok: true, message: 'KitFlow online', timestamp: new Date() });
});

app.use('/api', authMiddleware);
app.use('/api/influencers', influencersRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/messages', messagesRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => res.status(500).json({ error: err.message }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KitFlow rodando na porta ${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
    try { startJobs(); } catch(e) { console.error('Jobs:', e.message); }
  }
});

process.on('unhandledRejection', (r) => console.error('Rejection:', r));
process.on('uncaughtException', (e) => console.error('Exception:', e.message));

module.exports = app;