import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { createMercadoPagoPreference } from "@/lib/mercadopago";
import { isOriginAllowed } from "@/lib/quota";

const CheckoutRequestSchema = z.object({
  plan: z.enum(["10_credits", "50_credits"]),
});

export async function POST(request: NextRequest) {
  try {
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origem não autorizada." },
        { status: 403 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Faça login para comprar créditos." },
        { status: 401 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = CheckoutRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Plano inválido. Escolha '10_credits' ou '50_credits'.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const user = await currentUser().catch(() => null);
    const customerEmail =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      null;
    const customerName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      null;

    const preference = await createMercadoPagoPreference({
      userId,
      plan: parsed.data.plan,
      customerEmail,
      customerName,
    });

    return NextResponse.json({
      checkoutUrl: preference.checkoutUrl,
      preferenceId: preference.preferenceId,
      plan: preference.plan,
      creditsToAdd: preference.creditsToAdd,
      amountCents: preference.amountCents,
    });
  } catch (error) {
    console.error("[POST /api/checkout] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível iniciar o pagamento no Mercado Pago.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
