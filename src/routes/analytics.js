const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');

const router = Router();
const prisma = new PrismaClient();

// GET /api/analytics/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const all = await prisma.influencer.findMany();
    const total = all.length;
    const emTransito = all.filter((i) => ['ENVIADO', 'TRANSITO'].includes(i.kitStatus)).length;
    const entregues = all.filter((i) =>
      ['ENTREGUE', 'POST1_PENDENTE', 'POST2_PENDENTE', 'CONCLUIDO'].includes(i.kitStatus)
    ).length;
    const postsPendentes = all.filter(
      (i) => ['POST1_PENDENTE', 'POST2_PENDENTE'].includes(i.kitStatus)
    ).length;
    const engajamentoMedio =
      total > 0 ? all.reduce((s, i) => s + (i.engajamento || 0), 0) / total : 0;

    // Status counts
    const statusCounts = {};
    for (const inf of all) {
      statusCounts[inf.kitStatus] = (statusCounts[inf.kitStatus] || 0) + 1;
    }

    // Recent activity (last 10 notifications)
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const recentActivity = notifications.map((n) => ({
      text: n.text,
      color: n.color,
      at: n.createdAt,
    }));

    // Pending posts (overdue)
    const now = new Date();
    const pendingPosts = [];
    for (const inf of all) {
      if (!inf.post1Done && inf.post1Date && new Date(inf.post1Date) <= now) {
        pendingPosts.push({
          id: inf.id,
          nome: inf.nome,
          handle: inf.handle,
          date: inf.post1Date,
          postType: 'Post 1',
          type: 'COBRAR_POST1',
        });
      } else if (!inf.post2Done && inf.post2Date && new Date(inf.post2Date) <= now) {
        pendingPosts.push({
          id: inf.id,
          nome: inf.nome,
          handle: inf.handle,
          date: inf.post2Date,
          postType: 'Post 2',
          type: 'COBRAR_POST2',
        });
      }
    }
    pendingPosts.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Top influencers by engagement
    const topInfluencers = [...all]
      .sort((a, b) => (b.engajamento || 0) - (a.engajamento || 0))
      .slice(0, 5)
      .map((i) => ({ id: i.id, nome: i.nome, handle: i.handle, engajamento: i.engajamento }));

    res.json({
      kpis: { total, emTransito, entregues, postsPendentes, engajamentoMedio },
      statusCounts,
      recentActivity,
      pendingPosts,
      topInfluencers,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/analytics/engajamento
router.get('/engajamento', async (req, res) => {
  try {
    const all = await prisma.influencer.findMany({ select: { nicho: true, engajamento: true, nome: true } });
    
    const byNicho = {};
    for (const inf of all) {
      const n = inf.nicho || 'Sem nicho';
      if (!byNicho[n]) byNicho[n] = [];
      byNicho[n].push(inf.engajamento || 0);
    }
    
    const nichoStats = Object.entries(byNicho).map(([nicho, values]) => ({
      nicho,
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
    }));

    res.json({ byNicho: nichoStats, all: all.map((i) => ({ nome: i.nome, eng: i.engajamento })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
