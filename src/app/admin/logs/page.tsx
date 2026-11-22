import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  isAdminCookieValid,
  isAdminSecretConfigured,
} from "@/lib/adminAuth";
import { AdminLogsDashboard } from "@/components/AdminLogsDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Telemetria & Logs — LegendasBR Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLogsPage() {
  const isConfigured = isAdminSecretConfigured();
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const initialAuthenticated = isConfigured && isAdminCookieValid(token);

  return (
    <AdminLogsDashboard
      isConfigured={isConfigured}
      initialAuthenticated={initialAuthenticated}
    />
  );
}
