import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  isAdminSecretConfigured,
  verifyAdminPassword,
} from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  if (!isAdminSecretConfigured()) {
    return NextResponse.json(
      {
        error:
          "ADMIN_SECRET não configurado no servidor. Defina ADMIN_SECRET no .env.local.",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const password =
    typeof body?.password === "string" ? body.password.trim() : "";

  if (!verifyAdminPassword(password)) {
    return NextResponse.json(
      { error: "Senha de administrador inválida." },
      { status: 401 }
    );
  }

  const token = createAdminSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: "Falha ao gerar sessão de administrador." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
