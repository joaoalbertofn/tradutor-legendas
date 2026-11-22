# LegendaBR — Tradutor de Legendas `.srt` e `.vtt` para PT-BR

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
- **Contador Global e Rate Limit por IP**:
  - Contador global persistido em **Upstash Redis** (com fallback automático seguro em `localStorage` caso as variáveis não estejam configuradas).
  - Limite de **3 legendas por dia por IP** controlado por sessão em `/api/translate/session`.

---

## Variáveis de Ambiente (Vercel)

Crie um arquivo `.env.local` na raiz do projeto (ou configure em **Project Settings → Environment Variables** na Vercel):

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `GEMINI_API_KEY` | **Sim** | Chave de API do Google AI Studio ([gerar chave](https://aistudio.google.com/apikey)) usada pelo SDK `@google/genai`. |
| `UPSTASH_REDIS_REST_URL` | Não (recomendado em produção) | URL REST do banco Upstash Redis para contador global e cota diária por IP. |
| `UPSTASH_REDIS_REST_TOKEN` | Não (recomendado em produção) | Token REST do Upstash Redis. |

> **Nota sobre fallback:** Sem `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`, o app funciona imediatamente usando `localStorage` para o contador e memória local para a cota por IP.

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
