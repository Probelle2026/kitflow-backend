const axios = require('axios');

function getBaseUrl() {
  const { ZAPI_BASE_URL, ZAPI_INSTANCE_ID, ZAPI_TOKEN } = process.env;
  return (
    ZAPI_BASE_URL ||
    `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`
  );
}

function formatPhone(number) {
  const digits = number.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  return '55' + digits;
}

const TEMPLATES = {
  KIT_ENVIADO: (inf) =>
    `Olá, ${firstName(inf.nome)}! 🎉\n\nSeu kit foi enviado hoje!\n\nCódigo de rastreio: *${inf.trackingCode || 'N/A'}*\nRastreie em: https://rastreamento.correios.com.br\n\nQualquer dúvida, estou aqui! 💛`,
  EM_TRANSITO: (inf, extra) =>
    `Oi, ${firstName(inf.nome)}! 📦\n\nSeu kit está a caminho! ${extra?.location ? `Já passou por ${extra.location}.` : ''}\n\nEm breve chegará aí! 🚚`,
  KIT_ENTREGUE: (inf) =>
    `${firstName(inf.nome)}! Seu kit chegou! 🎊\n\nEsperamos que você ame tudo. Fique à vontade para tirar fotos e compartilhar sua experiência!\n\nQualquer dúvida, é só chamar 💛`,
  COBRAR_POST1: (inf) =>
    `Oi, ${firstName(inf.nome)}! 📸\n\nJá faz uma semana desde que seu kit chegou — esperamos que esteja adorando!\n\nLembre-se do post #1 combinado. Quando postar, me marca ou manda aqui!\n\nObrigada pela parceria 💛`,
  COBRAR_POST2: (inf) =>
    `${firstName(inf.nome)}, oi! 🌟\n\nPreciso do segundo post combinado no contrato. Você consegue fazer esta semana?\n\nFica à vontade para criar do seu jeito — só me avisa quando subir! 💛`,
};

function firstName(name) {
  return (name || '').split(' ')[0];
}

function buildMessage(type, influencer, extra) {
  const fn = TEMPLATES[type];
  if (!fn) throw new Error(`Template "${type}" não encontrado`);
  return fn(influencer, extra);
}

async function sendText(phone, message) {
  const baseUrl = getBaseUrl();
  const { ZAPI_CLIENT_TOKEN } = process.env;

  const res = await axios.post(
    `${baseUrl}/send-text`,
    { phone: formatPhone(phone), message },
    {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN,
      },
    }
  );
  return res.data;
}

async function sendToInfluencer(influencer, messageType, customText, extra) {
  if (!influencer.whatsapp) throw new Error('Sem número de WhatsApp');
  const message =
    messageType === 'CUSTOM' ? customText : buildMessage(messageType, influencer, extra);
  return sendText(influencer.whatsapp, message);
}

async function getStatus() {
  const baseUrl = getBaseUrl();
  const { ZAPI_CLIENT_TOKEN } = process.env;
  const res = await axios.get(`${baseUrl}/status`, {
    headers: { 'Client-Token': ZAPI_CLIENT_TOKEN },
  });
  return res.data;
}

module.exports = { sendText, sendToInfluencer, getStatus, buildMessage };
