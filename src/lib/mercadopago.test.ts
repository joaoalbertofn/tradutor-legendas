import { describe, expect, it } from "vitest";
import {
  CREDIT_PLANS,
  extractPaymentIdFromWebhook,
  parseExternalReference,
} from "./mercadopago";

describe("mercadopago plans & webhook helpers", () => {
  it("defines updated BRL prices for 10_credits (R$ 3,00) and 50_credits (R$ 5,00)", () => {
    expect(CREDIT_PLANS["10_credits"].unitPrice).toBe(3);
    expect(CREDIT_PLANS["10_credits"].amountCents).toBe(300);
    expect(CREDIT_PLANS["10_credits"].credits).toBe(10);

    expect(CREDIT_PLANS["50_credits"].unitPrice).toBe(5);
    expect(CREDIT_PLANS["50_credits"].amountCents).toBe(500);
    expect(CREDIT_PLANS["50_credits"].credits).toBe(50);
  });

  it("extracts paymentId from JSON webhook body (type: payment)", () => {
    const id = extractPaymentIdFromWebhook({
      body: {
        action: "payment.updated",
        type: "payment",
        data: { id: "1234567890" },
      },
    });
    expect(id).toBe("1234567890");
  });

  it("extracts paymentId from query string (data.id or id)", () => {
    const idV2 = extractPaymentIdFromWebhook({
      searchParams: new URLSearchParams("type=payment&data.id=987654321"),
    });
    expect(idV2).toBe("987654321");

    const idIpn = extractPaymentIdFromWebhook({
      searchParams: new URLSearchParams("topic=payment&id=555444333"),
    });
    expect(idIpn).toBe("555444333");
  });

  it("ignores non-payment webhook events", () => {
    const id = extractPaymentIdFromWebhook({
      body: { type: "merchant_order", data: { id: "999" } },
    });
    expect(id).toBeNull();
  });

  it("parses external_reference JSON cleanly", () => {
    const parsed = parseExternalReference(
      JSON.stringify({
        userId: "user_clerk_abc",
        plan: "50_credits",
        creditsToAdd: 50,
      })
    );
    expect(parsed).toEqual({
      userId: "user_clerk_abc",
      plan: "50_credits",
      creditsToAdd: 50,
    });

    expect(parseExternalReference("not-json")).toBeNull();
    expect(parseExternalReference(null)).toBeNull();
  });
});
