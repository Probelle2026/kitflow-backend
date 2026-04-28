const axios = require('axios');

const BASE_URL = 'https://api.correios.com.br';
let tokenCache = { token: null, expiresAt: 0 };

async function authenticate() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 5 * 60 * 1000) {
    return tokenCache.token;
  }

  const { CORREIOS_USUARIO, CORREIOS_SENHA, CORREIOS_CARTAO } = process.env;
  const credentials = Buffer.from(`${CORREIOS_USUARIO}:${CORREIOS_SENHA}`).toString('base64');

  const res = await axios.post(
    `${BASE_URL}/token/v1/autentica/cartaopostagem`,
    {},
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        numero: CORREIOS_CARTAO,
        'Content-Type': 'application/json',
      },
    }
  );

  const { token, expiraEm } = res.data;
  tokenCache = {
    token,
    expiresAt: expiraEm ? new Date(expiraEm).getTime() : now + 60 * 60 * 1000,
  };
  return token;
}

const STATUS_MAP = {
  PO: 'ENVIADO', CO: 'ENVIADO',
  RO: 'TRANSITO', DO: 'TRANSITO', FC: 'TRANSITO', OEC: 'TRANSITO',
  BDE: 'ENTREGUE', BDI: 'ENTREGUE',
};

function mapEventToStatus(codigo) {
  const prefix = codigo?.replace(/\d+/g, '').toUpperCase();
  return STATUS_MAP[prefix] || null;
}

async function trackObjects(codes) {
  if (!codes || codes.length === 0) return {};
  const token = await authenticate();
  const chunks = [];
  for (let i = 0; i < codes.length; i += 50) {
    chunks.push(codes.slice(i, i + 50));
  }

  const results = {};
  for (const chunk of chunks) {
    const query = chunk.join(',');
    const res = await axios.get(
      `${BASE_URL}/srorastro/v1/objetos?codigosObjetos=${query}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const objetos = res.data.objetos || [];
    for (const obj of objetos) {
      const eventos = obj.eventos || [];
      results[obj.codObjeto] = eventos.map(e => ({
        codigo: e.codigo,
        descricao: e.descricao,
        local: e.unidade?.endereco?.cidade || e.unidade?.nome || '',
        dtHrCriado: e.dtHrCriado,
        rawStatus: e.codigo,
        mappedStatus: mapEventToStatus(e.codigo),
      }));
    }
  }
  return results;
}

module.exports = { trackObjects, mapEventToStatus };
