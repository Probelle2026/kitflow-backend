# KitFlow — Press Kit Manager

Sistema de gestão de press kits para equipes de marketing de influência.

## Stack
- **Backend**: Node.js + Express + Prisma ORM + PostgreSQL
- **Frontend**: HTML/CSS/JS puro (single file)
- **Hospedagem**: Railway
- **WhatsApp**: Z-API
- **Rastreamento**: API Rastro Empresarial dos Correios

---

## Deploy no Railway

### 1. Criar projeto no Railway
```bash
railway login
railway new
```

### 2. Adicionar banco PostgreSQL
No dashboard Railway: **New** → **Database** → **PostgreSQL**

### 3. Configurar variáveis de ambiente
Copie `.env.example` e configure todas as variáveis no Railway dashboard.

### 4. Deploy
```bash
railway up
```
O comando de start é: `npx prisma db push && node src/server.js`

---

## Desenvolvimento local

```bash
npm install
cp .env.example .env
# Edite .env com suas credenciais locais
npx prisma db push
npm run dev
```

---

## Frontend

Abra `kitflow-frontend.html` diretamente no navegador.

Na tela de **Configurações**, configure:
- **URL do Backend**: `https://seu-projeto.up.railway.app`
- **API Secret**: o valor de `API_SECRET` nas suas variáveis

---

## Endpoints da API

### Influenciadoras
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/influencers` | Lista com paginação e filtros |
| GET | `/api/influencers/:id` | Perfil individual |
| GET | `/api/influencers/:id/tracking` | Eventos de rastreio |
| POST | `/api/influencers` | Criar nova |
| POST | `/api/influencers/import` | Importar em lote (array JSON) |
| PUT | `/api/influencers/:id` | Atualizar |
| PATCH | `/api/influencers/:id/status` | Avançar status do kit |
| DELETE | `/api/influencers/:id` | Deletar |

### Analytics
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/analytics/dashboard` | KPIs e dados do dashboard |
| GET | `/api/analytics/engajamento` | Por nicho e individual |

### Mensagens
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/messages` | Histórico |
| POST | `/api/messages/send` | Enviar via Z-API |
| GET | `/api/messages/status` | Status da instância Z-API |

### Todos os endpoints `/api/*` requerem header:
```
x-api-secret: seu-api-secret
```

---

## Jobs Automáticos

- **Rastreamento**: a cada `TRACKING_INTERVAL_MINUTES` (padrão 60min)
  - Verifica status dos kits ENVIADO/TRANSITO via Correios
  - Atualiza status no banco
  - Envia WhatsApp automático na mudança de status
  - Calcula datas de post ao entregar

- **Cobranças**: diariamente às 9h (BRT)
  - Post 1: vencido após `POST1_DAYS_AFTER_DELIVERY` dias da entrega
  - Post 2: vencido após `POST2_DAYS_AFTER_DELIVERY` dias da entrega

---

## Importação em lote

```json
POST /api/influencers/import
[
  {
    "nome": "Ana Silva",
    "handle": "@anasilva",
    "whatsapp": "11999999999",
    "instagram": "anasilva",
    "seguidores": 85000,
    "engajamento": 4.7,
    "nicho": "Beleza",
    "cidade": "São Paulo",
    "logradouro": "Rua das Flores",
    "numero": "123",
    "bairro": "Jardins",
    "cep": "01310-100"
  }
]
```
"# kitflow-backend" 
 
