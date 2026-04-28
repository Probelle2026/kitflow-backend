const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { trackObjects } = require('../services/correios');
const { sendToInfluencer } = require('../services/whatsapp');

const prisma = new PrismaClient();

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function logSystem(level, job, message) {
  try {
    await prisma.systemLog.create({ data: { level, job, message } });
  } catch (_) {}
}

async function notifyDashboard(text, color) {
  try {
    await prisma.notification.create({ data: { text, color } });
  } catch (_) {}
}

async function saveMessageLog(influencerId, messageType, phoneNumber, message, status, errorMsg) {
  return prisma.messageLog.create({
    data: {
      influencerId,
      messageType,
      phoneNumber,
      message,
      sendStatus: status,
      errorMsg,
      sentAt: status === 'SENT' ? new Date() : null,
    },
  });
}

// ===== JOB 1: TRACKING =====
async function runTrackingJob() {
  await logSystem('INFO', 'tracking', 'Iniciando job de rastreamento');
  try {
    const influencers = await prisma.influencer.findMany({
      where: {
        kitStatus: { in: ['ENVIADO', 'TRANSITO'] },
        trackingCode: { not: null },
      },
    });

    if (!influencers.length) {
      await logSystem('INFO', 'tracking', 'Nenhum kit para rastrear');
      return;
    }

    const codes = influencers.map((i) => i.trackingCode).filter(Boolean);
    let results;
    try {
      results = await trackObjects(codes);
    } catch (e) {
      await logSystem('ERROR', 'tracking', `Erro na API Correios: ${e.message}`);
      return;
    }

    const POST1_DAYS = parseInt(process.env.POST1_DAYS_AFTER_DELIVERY) || 7;
    const POST2_DAYS = parseInt(process.env.POST2_DAYS_AFTER_DELIVERY) || 14;

    for (const inf of influencers) {
      try {
        const events = results[inf.trackingCode];
        if (!events || !events.length) continue;

        // Save new events
        for (const ev of events) {
          const exists = await prisma.trackingEvent.findFirst({
            where: { influencerId: inf.id, codigo: ev.codigo, dtHrCriado: ev.dtHrCriado },
          });
          if (!exists) {
            await prisma.trackingEvent.create({
              data: {
                influencerId: inf.id,
                codigo: ev.codigo,
                descricao: ev.descricao,
                local: ev.local,
                dtHrCriado: ev.dtHrCriado,
                rawStatus: ev.rawStatus,
              },
            });
          }
        }

        // Determine highest status
        const latestMapped = events
          .map((e) => e.mappedStatus)
          .filter(Boolean)
          .reduce((best, cur) => {
            const order = ['ENVIADO', 'TRANSITO', 'ENTREGUE'];
            return order.indexOf(cur) > order.indexOf(best) ? cur : best;
          }, inf.kitStatus);

        if (latestMapped !== inf.kitStatus) {
          const updateData = { kitStatus: latestMapped };
          let msgType = null;
          let extra = {};

          if (latestMapped === 'TRANSITO') {
            msgType = 'EM_TRANSITO';
            extra.location = events[0]?.local;
          } else if (latestMapped === 'ENTREGUE') {
            const now = new Date();
            updateData.deliveryDate = now;
            updateData.post1Date = addDays(now, POST1_DAYS);
            updateData.post2Date = addDays(now, POST2_DAYS);
            msgType = 'KIT_ENTREGUE';
          }

          await prisma.influencer.update({ where: { id: inf.id }, data: updateData });
          await notifyDashboard(
            `${inf.nome} — Kit ${latestMapped.toLowerCase()}`,
            latestMapped === 'ENTREGUE' ? '#4fd18e' : '#4da6ff'
          );

          if (msgType && inf.whatsapp) {
            try {
              const updatedInf = { ...inf, ...updateData };
              const msg = require('../services/whatsapp').buildMessage(msgType, updatedInf, extra);
              await sendToInfluencer(updatedInf, msgType, null, extra);
              await saveMessageLog(inf.id, msgType, inf.whatsapp, msg, 'SENT', null);
            } catch (e) {
              await saveMessageLog(inf.id, msgType, inf.whatsapp, null, 'FAILED', e.message);
            }
          }
        }
      } catch (e) {
        await logSystem('ERROR', 'tracking', `Erro ao processar ${inf.nome}: ${e.message}`);
      }
    }

    await logSystem('INFO', 'tracking', `Job concluído. ${influencers.length} kits verificados`);
  } catch (e) {
    await logSystem('ERROR', 'tracking', `Erro geral: ${e.message}`);
  }
}

// ===== JOB 2: COBRANCAS =====
async function runBillingJob() {
  await logSystem('INFO', 'billing', 'Iniciando job de cobranças');
  try {
    const now = new Date();

    // Post 1 overdue
    const post1 = await prisma.influencer.findMany({
      where: {
        kitStatus: 'ENTREGUE',
        post1Done: false,
        post1Date: { lte: now },
      },
    });

    for (const inf of post1) {
      try {
        if (inf.whatsapp) {
          const msg = require('../services/whatsapp').buildMessage('COBRAR_POST1', inf);
          await sendToInfluencer(inf, 'COBRAR_POST1');
          await saveMessageLog(inf.id, 'COBRAR_POST1', inf.whatsapp, msg, 'SENT', null);
        }
        await prisma.influencer.update({
          where: { id: inf.id },
          data: { kitStatus: 'POST1_PENDENTE' },
        });
        await notifyDashboard(`${inf.nome} — Post 1 pendente`, '#d4f060');
      } catch (e) {
        await saveMessageLog(inf.id, 'COBRAR_POST1', inf.whatsapp, null, 'FAILED', e.message);
        await logSystem('ERROR', 'billing', `Erro post1 ${inf.nome}: ${e.message}`);
      }
    }

    // Post 2 overdue
    const post2 = await prisma.influencer.findMany({
      where: {
        kitStatus: 'POST1_PENDENTE',
        post2Done: false,
        post2Date: { lte: now },
      },
    });

    for (const inf of post2) {
      try {
        if (inf.whatsapp) {
          const msg = require('../services/whatsapp').buildMessage('COBRAR_POST2', inf);
          await sendToInfluencer(inf, 'COBRAR_POST2');
          await saveMessageLog(inf.id, 'COBRAR_POST2', inf.whatsapp, msg, 'SENT', null);
        }
        await prisma.influencer.update({
          where: { id: inf.id },
          data: { kitStatus: 'POST2_PENDENTE' },
        });
        await notifyDashboard(`${inf.nome} — Post 2 pendente`, '#ffaa44');
      } catch (e) {
        await saveMessageLog(inf.id, 'COBRAR_POST2', inf.whatsapp, null, 'FAILED', e.message);
        await logSystem('ERROR', 'billing', `Erro post2 ${inf.nome}: ${e.message}`);
      }
    }

    await logSystem('INFO', 'billing', `Job concluído. Post1: ${post1.length}, Post2: ${post2.length}`);
  } catch (e) {
    await logSystem('ERROR', 'billing', `Erro geral: ${e.message}`);
  }
}

function startJobs() {
  const trackingInterval = parseInt(process.env.TRACKING_INTERVAL_MINUTES) || 60;
  
  // Tracking: every N minutes
  cron.schedule(`*/${trackingInterval} * * * *`, runTrackingJob);
  
  // Billing: every day at 9am BRT
  cron.schedule('0 12 * * *', runBillingJob); // 12 UTC = 9 BRT

  console.log(`✓ Jobs iniciados (rastreamento a cada ${trackingInterval}min, cobrança às 9h)`);
  
  // Run immediately on start
  setTimeout(runTrackingJob, 5000);
}

module.exports = { startJobs, runTrackingJob, runBillingJob };
