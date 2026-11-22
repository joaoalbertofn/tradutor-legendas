import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserCredits } from "@/lib/credits";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Autenticação obrigatória." },
        { status: 401 }
      );
    }

    const credits = await getUserCredits(userId);
    return NextResponse.json({ credits });
  } catch (error) {
    console.error("[GET /api/credits] Error:", error);
    return NextResponse.json(
      { error: "Erro ao consultar saldo de créditos." },
      { status: 500 }
    );
  }
}
