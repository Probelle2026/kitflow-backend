const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { sendToInfluencer, getStatus, buildMessage } = require('../services/whatsapp');

const router = Router();
const prisma = new PrismaClient();

// GET /api/messages
router.get('/', async (req, res) => {
  try {
    const { influencerId, page = 1, limit = 50 } = req.query;
    const where = {};
    if (influencerId) where.influencerId = influencerId;

    const [data, total] = await Promise.all([
      prisma.messageLog.findMany({
        where,
        include: { influencer: { select: { nome: true, handle: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.messageLog.count({ where }),
    ]);

    res.json({ data, total });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/messages/send
router.post('/send', async (req, res) => {
  const { influencerId, messageType, customText } = req.body;
  if (!influencerId || !messageType) {
    return res.status(400).json({ error: 'influencerId e messageType obrigatórios' });
  }

  const inf = await prisma.influencer.findUnique({ where: { id: influencerId } });
  if (!inf) return res.status(404).json({ error: 'Influenciadora não encontrada' });
  if (!inf.whatsapp) return res.status(400).json({ error: 'Sem número de WhatsApp' });

  let sendStatus = 'SENT';
  let errorMsg = null;
  let message = null;

  try {
    message = messageType === 'CUSTOM' ? customText : buildMessage(messageType, inf);
    await sendToInfluencer(inf, messageType, customText);
  } catch (e) {
    sendStatus = 'FAILED';
    errorMsg = e.message;
  }

  const log = await prisma.messageLog.create({
    data: {
      influencerId,
      messageType,
      sendStatus,
      phoneNumber: inf.whatsapp,
      message,
      errorMsg,
      sentAt: sendStatus === 'SENT' ? new Date() : null,
    },
  });

  if (sendStatus === 'FAILED') {
    return res.status(502).json({ error: errorMsg, log });
  }
  res.json({ ok: true, log });
});

// GET /api/messages/status (Z-API status)
router.get('/status', async (req, res) => {
  try {
    const data = await getStatus();
    res.json({ connected: data.connected || data.status === 'Connected', raw: data });
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});

module.exports = router;
