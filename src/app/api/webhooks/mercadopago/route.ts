import { NextRequest, NextResponse } from "next/server";
import {
  extractPaymentIdFromWebhook,
  getMercadoPagoPayment,
  parseExternalReference,
} from "@/lib/mercadopago";
import { grantPaidCreditsFromPayment } from "@/lib/credits";

/**
 * Webhook de confirmação de pagamentos do Mercado Pago (Checkout Pro).
 *
 * - Aceita notificações do tipo `payment` via body JSON (`data.id`) ou query string (`id` / `data.id`).
 * - Consulta os dados reais do pagamento via `new Payment(client).get({ id: paymentId })` para validar autenticidade.
 * - Quando `payment.status === 'approved'`, credita de forma idempotente em `payment_transactions` e `user_credits`.
 * - Retorna sempre HTTP 200 rapidamente para evitar retentativas desnecessárias do Mercado Pago.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const paymentId = extractPaymentIdFromWebhook({
      body,
      searchParams: request.nextUrl.searchParams,
    });

    if (!paymentId) {
      return NextResponse.json(
        { received: true, ignored: true, reason: "Not a payment notification" },
        { status: 200 }
      );
    }

    // Consulta o pagamento real diretamente na API do Mercado Pago para validar autenticidade
    const payment = await getMercadoPagoPayment(paymentId);

    if (payment.status !== "approved") {
      return NextResponse.json(
        {
          received: true,
          processed: false,
          paymentId,
          status: payment.status ?? "unknown",
        },
        { status: 200 }
      );
    }

    const reference = parseExternalReference(payment.external_reference);
    if (!reference) {
      console.error(
        "[POST /api/webhooks/mercadopago] Approved payment missing valid external_reference:",
        { paymentId, externalReference: payment.external_reference }
      );
      return NextResponse.json(
        {
          received: true,
          processed: false,
          reason: "Invalid external_reference",
        },
        { status: 200 }
      );
    }

    const externalPaymentId = String(payment.id ?? paymentId);
    const amountCents = Math.round((payment.transaction_amount || 0) * 100);

    // Operação idempotente: checa e insere `external_payment_id` (UNIQUE) em `payment_transactions`,
    // soma `paid_credits = paid_credits + creditsToAdd` e renova `paid_expires_at = now() + 24h`.
    const result = await grantPaidCreditsFromPayment({
      externalPaymentId,
      userId: reference.userId,
      creditsToAdd: reference.creditsToAdd,
      amountCents,
      status: payment.status,
      provider: "mercadopago",
    });

    return NextResponse.json(
      {
        received: true,
        credited: result.credited,
        alreadyProcessed: result.alreadyProcessed,
        externalPaymentId,
        userId: reference.userId,
        creditsAdded: result.credited ? reference.creditsToAdd : 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/webhooks/mercadopago] Error:", error);
    // Retorna 200 conforme boas práticas do Mercado Pago para evitar loops de retry em eventos de teste/inválidos
    return NextResponse.json(
      { received: true, processed: false },
      { status: 200 }
    );
  }
}
