"use client";

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/ui/Toast";
import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function ScrollToTop() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [pathname]);

  return null;
}

function AuthFlowRedirector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const queryString = searchParams.toString();
  const code = searchParams.get("code");
  const flow = searchParams.get("flow");
  const type = searchParams.get("type");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  useEffect(() => {
    if (!code || pathname.startsWith("/api/")) return;

    const nextParams = new URLSearchParams(queryString);
    nextParams.delete("code");
    nextParams.delete("flow");
    nextParams.delete("type");
    nextParams.delete("error");
    nextParams.delete("error_code");
    nextParams.delete("error_description");

    const cleanedCurrentPath = `${pathname}${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
    const shouldTreatAsRecovery = pathname === "/reset-password"
      || flow === "recovery"
      || type === "recovery";
    const callbackParams = new URLSearchParams();
    callbackParams.set("code", code);
    callbackParams.set("next", shouldTreatAsRecovery ? "/reset-password" : cleanedCurrentPath || "/");
    if (shouldTreatAsRecovery) {
      callbackParams.set("flow", "recovery");
    }

    router.replace(`/api/auth/callback?${callbackParams.toString()}`);
  }, [code, flow, pathname, queryString, router, type]);

  useEffect(() => {
    if (code || pathname === "/reset-password") return;
    if (errorCode !== "otp_expired") return;

    const params = new URLSearchParams();
    params.set("reset_error", errorCode);
    if (errorDescription) {
      params.set("reset_error_description", errorDescription);
    }

    router.replace(`/reset-password?${params.toString()}`);
  }, [code, errorCode, errorDescription, pathname, router]);

  useEffect(() => {
    if (!isPasswordRecovery || pathname === "/reset-password") return;
    clearPasswordRecovery();
    router.replace("/reset-password");
  }, [clearPasswordRecovery, isPasswordRecovery, pathname, router]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={null}>
              <AuthFlowRedirector />
            </Suspense>
            <ScrollToTop />
            {children}
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
