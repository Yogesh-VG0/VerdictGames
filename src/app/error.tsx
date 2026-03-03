"use client";

import PixelButton from "@/components/ui/PixelButton";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center space-y-4">
      <div className="text-4xl">⚠</div>
      <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
      <p className="text-sm text-secondary max-w-md">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <PixelButton onClick={reset} variant="secondary">
        Try again
      </PixelButton>
    </div>
  );
}
