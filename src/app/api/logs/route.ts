import { NextRequest, NextResponse } from "next/server";
import { isOriginAllowed } from "@/lib/quota";
import {
  isAdminRequestAuthorized,
  isAdminSecretConfigured,
} from "@/lib/adminAuth";
import {
  TranslationLogPayloadSchema,
  queryTranslationLogs,
  saveTranslationLog,
} from "@/lib/translationLogs";
import type { TranslationLogStatus } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Origem não autorizada." },
        { status: 403 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = TranslationLogPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Payload de log inválido.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { record, source } = await saveTranslationLog(parsed.data);

    return NextResponse.json(
      { ok: true, id: record.id, source },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/logs] Unexpected error:", error);
    return NextResponse.json(
      { error: "Erro interno ao registrar log de tradução." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  if (!isAdminSecretConfigured()) {
    return NextResponse.json(
      {
        error:
          "A variável de ambiente ADMIN_SECRET não está configurada no servidor.",
      },
      { status: 503 }
    );
  }

  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json(
      { error: "Não autorizado. Autenticação de administrador necessária." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1") || 1;
    const pageSize = Number(searchParams.get("pageSize") ?? "15") || 15;
    const rawStatus = searchParams.get("status") ?? "all";
    const status: "all" | TranslationLogStatus =
      rawStatus === "success" ||
      rawStatus === "error" ||
      rawStatus === "cancelled"
        ? rawStatus
        : "all";

    const data = await queryTranslationLogs({ page, pageSize, status });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[GET /api/logs] Unexpected error:", error);
    return NextResponse.json(
      { error: "Erro ao consultar logs de tradução." },
      { status: 500 }
    );
  }
}
