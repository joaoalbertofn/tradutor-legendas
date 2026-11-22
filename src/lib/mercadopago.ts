import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import type { CreditPlanId } from "./types";

export interface CreditPlanConfig {
  id: CreditPlanId;
  name: string;
  tagline: string;
  description: string;
  credits: number;
  /** Valor em reais (BRL) enviado ao Mercado Pago (`unit_price`) */
  unitPrice: number;
  /** Valor em centavos para registro em `payment_transactions.amount_cents` */
  amountCents: number;
  priceLabel: string;
  validityHours: number;
  highlighted?: boolean;
}

export const CREDIT_PLANS: Record<CreditPlanId, CreditPlanConfig> = {
  "10_credits": {
    id: "10_credits",
    name: "Passe Maratona",
    tagline: "Ideal para uma série ou alguns filmes hoje",
    description: "+10 traduções de legendas válidas por 24 horas após a compra.",
    credits: 10,
    unitPrice: 3, // R$ 3,00
    amountCents: 300,
    priceLabel: "R$ 3,00",
    validityHours: 24,
  },
  "50_credits": {
    id: "50_credits",
    name: "Passe Completo",
    tagline: "Melhor custo-benefício para temporadas inteiras",
    description: "+50 traduções de legendas válidas por 24 horas após a compra.",
    credits: 50,
    unitPrice: 5, // R$ 5,00
    amountCents: 500,
    priceLabel: "R$ 5,00",
    validityHours: 24,
    highlighted: true,
  },
};

export function isValidCreditPlan(value: unknown): value is CreditPlanId {
  return value === "10_credits" || value === "50_credits";
}

function getAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }
  return "http://localhost:3000";
}

export function getMercadoPagoClient(): MercadoPagoConfig {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error(
      "A variável de ambiente MERCADOPAGO_ACCESS_TOKEN não está configurada no servidor."
    );
  }

  return new MercadoPagoConfig({
    accessToken,
  });
}

export interface CreateMercadoPagoPreferenceParams {
  userId: string;
  plan: CreditPlanId;
  customerEmail?: string | null;
  customerName?: string | null;
}

export interface CreateMercadoPagoPreferenceResult {
  preferenceId: string;
  checkoutUrl: string;
  plan: CreditPlanId;
  creditsToAdd: number;
  amountCents: number;
}

/**
 * Cria uma preferência do Mercado Pago Checkout Pro habilitando Pix e Cartão de Crédito
 * (excluindo boleto bancário via `excluded_payment_types: [{ id: 'ticket' }]`).
 */
export async function createMercadoPagoPreference(
  params: CreateMercadoPagoPreferenceParams
): Promise<CreateMercadoPagoPreferenceResult> {
  const client = getMercadoPagoClient();
  const preferenceApi = new Preference(client);
  const planConfig = CREDIT_PLANS[params.plan];
  const appUrl = getAppUrl();

  const externalReference = JSON.stringify({
    userId: params.userId,
    plan: planConfig.id,
    creditsToAdd: planConfig.credits,
  });

  const preference = await preferenceApi.create({
    body: {
      items: [
        {
          id: planConfig.id,
          title: `LegendasBR — ${planConfig.name} (+${planConfig.credits} traduções)`,
          description: planConfig.description,
          quantity: 1,
          unit_price: planConfig.unitPrice,
          currency_id: "BRL",
        },
      ],
      payment_methods: {
        // Exclui boleto bancário para evitar espera de compensação (mantém Pix e Cartão de Crédito)
        excluded_payment_types: [{ id: "ticket" }],
      },
      external_reference: externalReference,
      back_urls: {
        success: `${appUrl}?payment=success`,
        failure: `${appUrl}?payment=failure`,
        pending: `${appUrl}?payment=pending`,
      },
      auto_return: "approved",
      notification_url: `${appUrl}/api/webhooks/mercadopago`,
      ...(params.customerEmail
        ? {
            payer: {
              email: params.customerEmail,
              ...(params.customerName ? { name: params.customerName } : {}),
            },
          }
        : {}),
    },
  });

  const checkoutUrl = preference.init_point ?? "";
  if (!checkoutUrl) {
    throw new Error(
      "O Mercado Pago não retornou a URL de checkout (`init_point`)."
    );
  }

  return {
    preferenceId: preference.id ?? "",
    checkoutUrl,
    plan: planConfig.id,
    creditsToAdd: planConfig.credits,
    amountCents: planConfig.amountCents,
  };
}

/**
 * Consulta os dados reais de um pagamento diretamente na API do Mercado Pago
 * para validar autenticidade e status antes de creditar o usuário.
 */
export async function getMercadoPagoPayment(paymentId: string) {
  const client = getMercadoPagoClient();
  const paymentApi = new Payment(client);
  return paymentApi.get({ id: paymentId });
}

export interface ParsedExternalReference {
  userId: string;
  plan?: CreditPlanId;
  creditsToAdd: number;
}

/**
 * Extrai e valida `{ userId, plan, creditsToAdd }` de `payment.external_reference`.
 */
export function parseExternalReference(
  externalReference: string | null | undefined
): ParsedExternalReference | null {
  if (!externalReference || typeof externalReference !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(externalReference) as Record<string, unknown>;
    const userId =
      typeof parsed.userId === "string" && parsed.userId.trim()
        ? parsed.userId.trim()
        : null;
    const plan = isValidCreditPlan(parsed.plan) ? parsed.plan : undefined;

    let creditsToAdd =
      typeof parsed.creditsToAdd === "number"
        ? parsed.creditsToAdd
        : Number(parsed.creditsToAdd);

    if ((!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) && plan) {
      creditsToAdd = CREDIT_PLANS[plan].credits;
    }

    if (!userId || !Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      return null;
    }

    return {
      userId,
      plan,
      creditsToAdd: Math.floor(creditsToAdd),
    };
  } catch {
    return null;
  }
}

/**
 * Extrai o ID do pagamento de uma notificação webhook do Mercado Pago
 * (suporta formato Webhook v2 via body JSON `{ type: 'payment', data: { id } }`
 * e formato IPN/query string `?type=payment&data.id=...` ou `?topic=payment&id=...`).
 */
export function extractPaymentIdFromWebhook(params: {
  body?: unknown;
  searchParams?: URLSearchParams;
}): string | null {
  const bodyObj =
    params.body && typeof params.body === "object"
      ? (params.body as Record<string, unknown>)
      : null;

  const queryType =
    params.searchParams?.get("type") ?? params.searchParams?.get("topic") ?? "";
  const bodyType =
    typeof bodyObj?.type === "string"
      ? bodyObj.type
      : typeof bodyObj?.topic === "string"
      ? bodyObj.topic
      : "";
  const bodyAction =
    typeof bodyObj?.action === "string" ? bodyObj.action : "";

  const normalizedType = (bodyType || queryType).trim().toLowerCase();
  const isPaymentEvent =
    normalizedType === "payment" ||
    bodyAction.toLowerCase().startsWith("payment.");

  if (!isPaymentEvent) {
    return null;
  }

  const bodyData =
    bodyObj?.data && typeof bodyObj.data === "object"
      ? (bodyObj.data as Record<string, unknown>)
      : null;

  const rawId =
    bodyData?.id ??
    params.searchParams?.get("data.id") ??
    params.searchParams?.get("id") ??
    bodyObj?.id;

  if (rawId === null || rawId === undefined) {
    return null;
  }

  const paymentId = String(rawId).trim();
  return paymentId.length > 0 ? paymentId : null;
}
