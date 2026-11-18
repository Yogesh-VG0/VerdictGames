/**
 * GET /api/auth/callback
 *
 * OAuth callback handler. Exchanges code for session, then redirects.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";
import { safeRedirectPath, safeAuthOrigin } from "@/lib/security/request";

function normalizeNextPath(next: string | null, flow: string | null) {
  return safeRedirectPath(next, flow === "recovery" ? "/reset-password" : "/");
}

function buildRedirectUrl(origin: string, pathname: string, params?: Record<string, string | undefined>) {
  const redirectUrl = new URL(pathname, origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        redirectUrl.searchParams.set(key, value);
      }
    });
  }

  return redirectUrl;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = safeAuthOrigin(request.url, request.headers.get('x-forwarded-host') || request.headers.get('host'), [
    process.env.NEXT_PUBLIC_SITE_URL || '',
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : []),
  ]);
  const code = searchParams.get("code");
  const flow = searchParams.get("flow");
  const next = searchParams.get("next");

  // Validate next is a safe relative path (prevent open redirect)
  const safeNext = normalizeNextPath(next, flow);

  // New confirmation emails carry their secret in the fragment, which is not
  // sent to this server. Land on an explicit confirmation page without
  // consuming anything on GET. Existing code/OAuth links still use PKCE below.
  if (flow === 'confirmation' && !code) {
    const response = NextResponse.redirect(buildRedirectUrl(origin, '/auth/confirm'));
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(buildRedirectUrl(origin, safeNext));
    }

    if (flow === "recovery" || safeNext === "/reset-password") {
      return NextResponse.redirect(
        buildRedirectUrl(origin, "/reset-password", {
          reset_error: "link_invalid",
          reset_error_description: error.message,
        })
      );
    }
  }

  if (flow === "recovery" || safeNext === "/reset-password") {
    return NextResponse.redirect(
      buildRedirectUrl(origin, "/reset-password", {
        reset_error: "link_invalid",
      })
    );
  }

  return NextResponse.redirect(
    buildRedirectUrl(origin, "/", {
      auth_error: "true",
    })
  );
}
