# LegendasBR — Tradutor de Legendas `.srt` e `.vtt` para PT-BR

Aplicação web em **Next.js (App Router)**, **TypeScript** e **Tailwind CSS** para traduzir arquivos de legenda `.srt` e `.vtt` de qualquer idioma para **Português do Brasil (pt-BR)**, preservando 100% dos índices, timestamps, cabeçalhos WebVTT e tags de formatação inline.

## Principais Recursos

- **Parser e Reconstrutor 100% Lossless (`src/lib/subtitleParser.ts`)**:
  - Extrai `{ id, index, timestamp, text }` no cliente sem nunca enviar timestamps para a IA.
  - Mantém cabeçalhos `WEBVTT`, blocos `STYLE`/`REGION`/`NOTE`, cue settings e quebras de linha originais (`CRLF`/`LF`).
  - Exporta com sufixo `.pt-BR` (ex: `filme.srt` → `filme.pt-BR.srt`) e opção de **UTF-8 com BOM** para Smart TVs e players antigos.
- **Arquitetura Anti-Timeout (Vercel Hobby Ready)**:
  - O frontend divide a legenda em lotes de **40 blocos** e executa uma fila com **concorrência de 3 lotes simultâneos**, enviando o roteiro original completo em memória como contexto somente leitura para manter consistência de personagens e tom.
  - Retry automático (até 2 tentativas com backoff exponencial) e validação estrita de correspondência 1:1 dos IDs.
- **Google Gemini (`@google/genai`)**:
  - Usa `gemini-3.5-flash-lite` (~2–4s por lote de 40 blocos) com **timeout por modelo (20s)** e **fallback automático** entre modelos Flash (`gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-3.6-flash`, `gemini-3.8-flash`) em caso de pico de demanda (503) ou rate limit, usando **Structured Outputs (`responseSchema`)** em JSON e validação com **Zod**.
- **Autenticação (Clerk) + Créditos Diários e Pacotes Avulsos (Mercado Pago)**:
  - Login rápido em modal via **Clerk** (`@clerk/nextjs` com localização `ptBR`).
  - **3 traduções grátis por dia** por usuário (com *lazy reset* de 24h sem cron job).
  - Compra de pacotes avulsos via **Mercado Pago Checkout Pro (Pix e Cartão de Crédito, sem boleto)**: **Passe Maratona** (R$ 3,00 / +10 traduções por 24h) e **Passe Completo** (R$ 5,00 / +50 traduções por 24h).
  - Consumo de **1 crédito por arquivo traduzido** (garantido via `sessionId` único para que os lotes paralelos do mesmo arquivo não descontem créditos extras).
  - Contador global persistido em **Upstash Redis** (com fallback automático seguro em `localStorage`).

---

## Variáveis de Ambiente (Vercel)

Crie um arquivo `.env.local` na raiz do projeto (ou configure em **Project Settings → Environment Variables** na Vercel):

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `GEMINI_API_KEY` | **Sim** | Chave de API do Google AI Studio ([gerar chave](https://aistudio.google.com/apikey)) usada pelo SDK `@google/genai`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Sim** | Chave pública (*Publishable Key*) da sua aplicação no [Clerk](https://dashboard.clerk.com/). |
| `CLERK_SECRET_KEY` | **Sim** | Chave secreta (*Secret Key*) da sua aplicação no Clerk. |
| `MERCADOPAGO_ACCESS_TOKEN` | **Sim** (para pagamentos) | Access Token de produção (ou teste) da sua aplicação no [Mercado Pago Developers](https://www.mercadopago.com.br/developers/panel). |
| `NEXT_PUBLIC_APP_URL` | **Sim** (em produção) | URL pública do app (ex: `https://seu-dominio.vercel.app`) usada em `back_urls` e `notification_url` do Mercado Pago. |
| `SUPABASE_URL` | **Sim** (em produção) | URL do projeto Supabase para persistir `user_credits`, `payment_transactions` e `translation_logs`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sim** (em produção) | Chave `service_role` do Supabase usada exclusivamente no servidor. |
| `UPSTASH_REDIS_REST_URL` | Não (recomendado em produção) | URL REST do banco Upstash Redis para contador global e sessões distribuídas. |
| `UPSTASH_REDIS_REST_TOKEN` | Não (recomendado em produção) | Token REST do Upstash Redis. |
| `ADMIN_SECRET` | Não (obrigatório para `/admin/logs`) | Senha de acesso ao painel administrativo de telemetria em `/admin/logs`. |
| `USD_TO_BRL_RATE` | Não | Cotação USD → BRL usada no painel de custos (padrão: `5.80`). |

> **Nota sobre fallback:**
> - Sem `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`, o app usa `localStorage` para o contador global e memória local para as sessões.
> - Sem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, créditos/pagamentos usam fallback em memória (útil para testes locais) e os logs de tradução são gravados em console + JSON local (`.data/translation-logs.json`).

---

## Banco de Dados no Supabase (Créditos e Pagamentos)

Execute o SQL abaixo no **SQL Editor** do seu projeto Supabase para criar as tabelas `user_credits` e `payment_transactions`:

```sql
-- 1. Saldo de créditos diários gratuitos e créditos pagos (expiração de 24h)
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id TEXT PRIMARY KEY,
  free_used_today INTEGER NOT NULL DEFAULT 0,
  free_reset_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  paid_credits INTEGER NOT NULL DEFAULT 0,
  paid_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Histórico idempotente de transações de pagamento (Mercado Pago)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'mercadopago',
  external_payment_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  credits_added INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id
  ON public.payment_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_external_id
  ON public.payment_transactions (external_payment_id);

-- Mantém as tabelas privadas via RLS (o backend acessa via SUPABASE_SERVICE_ROLE_KEY)
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
```

### Configuração do Webhook no Mercado Pago Developers

No painel do [Mercado Pago Developers](https://www.mercadopago.com.br/developers/panel), acesse sua aplicação → **Webhooks** → **Configurar notificações** e cadastre a URL de produção:

```text
https://SEU_DOMINIO/api/webhooks/mercadopago
```

Selecione o evento **Pagamentos (`payment`)** e salve. O handler em `src/app/api/webhooks/mercadopago/route.ts` consulta o pagamento real via API do Mercado Pago (`new Payment(client).get({ id })`), confirma `status === 'approved'`, valida idempotência via `external_payment_id` na tabela `payment_transactions` e credita os pacotes em `user_credits` com validade de 24 horas.

---

## Telemetria, Custos e Painel Admin (`/admin/logs`)

O app coleta automaticamente, de forma assíncrona (*fire-and-forget*), métricas consolidadas por arquivo traduzido via `POST /api/logs`:
- Tokens consumidos (`promptTokens`, `outputTokens`) extraídos do `usageMetadata` do Gemini.
- Custo estimado em **USD** e **BRL** (tarifas configuráveis em `src/lib/pricing.ts`).
- Tempo de extração local de vídeo (`extractionDurationMs`) e tempo total de tradução (`translationDurationMs`).
- Contagem de blocos (`totalCues`), lotes (`totalChunks`), `retriesCount` e status final (`success`, `error`, `cancelled`).

Acesse o painel em **`/admin/logs`** usando a senha configurada em `ADMIN_SECRET`.

### SQL da Tabela no Supabase (`translation_logs`)

Execute o SQL abaixo no **SQL Editor** do seu projeto Supabase:

```sql
CREATE TABLE IF NOT EXISTS public.translation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  extension TEXT NOT NULL CHECK (extension IN ('.srt', '.vtt')),
  source_type TEXT NOT NULL CHECK (source_type IN ('file_upload', 'video_extraction')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'cancelled')),
  error_message TEXT,
  model TEXT,
  extraction_duration_ms INTEGER NOT NULL DEFAULT 0,
  translation_duration_ms INTEGER NOT NULL DEFAULT 0,
  total_cues INTEGER NOT NULL DEFAULT 0,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  retries_count INTEGER NOT NULL DEFAULT 0,
  total_prompt_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_translation_logs_created_at
  ON public.translation_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_translation_logs_status
  ON public.translation_logs (status);

-- Opcional: ativar RLS mantendo a tabela privada (o servidor usa SUPABASE_SERVICE_ROLE_KEY)
ALTER TABLE public.translation_logs ENABLE ROW LEVEL SECURITY;
```

---

## Rodando Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local e preencha GEMINI_API_KEY

# 3. Rodar servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`.

## Testes e Build

```bash
# Rodar testes unitários do parser (.srt e .vtt)
npm test

# Gerar build de produção
npm run build
```

## Deploy na Vercel

1. Suba o repositório para o GitHub/GitLab/Bitbucket.
2. Importe o projeto na [Vercel](https://vercel.com/new).
3. Adicione `GEMINI_API_KEY` (e opcionalmente `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) nas variáveis de ambiente.
4. Clique em **Deploy**.
