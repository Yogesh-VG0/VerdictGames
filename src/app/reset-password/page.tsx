import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ResetPasswordClientPage from "@/components/ResetPasswordClientPage";

interface ResetPasswordPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getResetErrorMessage(errorCode?: string, errorDescription?: string) {
  if (errorCode === "otp_expired") {
    return "This reset link has expired. Request a fresh reset link below.";
  }

  if (errorDescription) {
    return errorDescription;
  }

  if (errorCode) {
    return "This reset link is invalid or could not be verified. Request a fresh reset link below.";
  }

  return undefined;
}

export const metadata: Metadata = {
  title: "Reset Password",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const code = getSingleValue(resolvedSearchParams?.code);
  const resetError = getSingleValue(resolvedSearchParams?.reset_error) ?? getSingleValue(resolvedSearchParams?.error_code);
  const resetErrorDescription = getSingleValue(resolvedSearchParams?.reset_error_description) ?? getSingleValue(resolvedSearchParams?.error_description);

  if (code) {
    const callbackParams = new URLSearchParams();
    callbackParams.set("code", code);
    callbackParams.set("next", "/reset-password");
    callbackParams.set("flow", "recovery");
    redirect(`/api/auth/callback?${callbackParams.toString()}`);
  }

  return <ResetPasswordClientPage initialError={getResetErrorMessage(resetError, resetErrorDescription)} />;
}
