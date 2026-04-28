const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// GET /api/influencers
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, search, kitStatus } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { handle: { contains: search, mode: 'insensitive' } },
        { trackingCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (kitStatus) where.kitStatus = kitStatus;

    const [data, total] = await Promise.all([
      prisma.influencer.findMany({ where, skip, take: parseInt(limit), orderBy: { updatedAt: 'desc' } }),
      prisma.influencer.count({ where }),
    ]);

    res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/influencers/:id
router.get('/:id', async (req, res) => {
  try {
    const inf = await prisma.influencer.findUnique({ where: { id: req.params.id } });
    if (!inf) return res.status(404).json({ error: 'Not found' });
    res.json(inf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/influencers/:id/tracking
router.get('/:id/tracking', async (req, res) => {
  try {
    const events = await prisma.trackingEvent.findMany({
      where: { influencerId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/influencers
router.post('/', async (req, res) => {
  try {
    const inf = await prisma.influencer.create({ data: req.body });
    res.status(201).json(inf);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/influencers/import
router.post('/import', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const result = await prisma.influencer.createMany({ data: items, skipDuplicates: true });
    res.json({ imported: result.count });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/influencers/:id
router.put('/:id', async (req, res) => {
  try {
    const inf = await prisma.influencer.update({ where: { id: req.params.id }, data: req.body });
    res.json(inf);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PATCH /api/influencers/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { kitStatus, trackingCode } = req.body;
    const updateData = { kitStatus };
    if (trackingCode) updateData.trackingCode = trackingCode;

    const POST1_DAYS = parseInt(process.env.POST1_DAYS_AFTER_DELIVERY) || 7;
    const POST2_DAYS = parseInt(process.env.POST2_DAYS_AFTER_DELIVERY) || 14;

    if (kitStatus === 'ENVIADO') {
      updateData.sentDate = new Date();
    }
    if (kitStatus === 'ENTREGUE') {
      const now = new Date();
      updateData.deliveryDate = now;
      updateData.post1Date = addDays(now, POST1_DAYS);
      updateData.post2Date = addDays(now, POST2_DAYS);
    }

    const inf = await prisma.influencer.update({ where: { id: req.params.id }, data: updateData });
    res.json(inf);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/influencers/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.influencer.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
