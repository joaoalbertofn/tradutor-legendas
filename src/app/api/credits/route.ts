import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserCredits } from "@/lib/credits";
import {
  extractClientIp,
  getQuotaForIp,
  isUnlimitedLocalDev,
} from "@/lib/quota";

export async function GET(request: NextRequest) {
  try {
    const ip = extractClientIp(request);
    const quota = await getQuotaForIp(ip);
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({
        signedIn: false,
        credits: null,
        quota,
      });
    }

    const unlimited = isUnlimitedLocalDev();
    const credits = await getUserCredits(userId, new Date(), {
      ipFreeUsed: unlimited ? 0 : quota.used,
    });

    return NextResponse.json({
      signedIn: true,
      credits: unlimited ? { ...credits, unlimited: true } : credits,
      quota,
    });
  } catch (error) {
    console.error("[GET /api/credits] Error:", error);
    return NextResponse.json(
      { error: "Erro ao consultar saldo de créditos." },
      { status: 500 }
    );
  }
}
