"use client";

import PixelButton from "@/components/ui/PixelButton";

export default function GameDetailError({ reset }: { reset: () => void }) {
  return (
    <section className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center space-y-4">
      <h1 className="text-xl font-bold text-foreground">Game details are temporarily unavailable</h1>
      <PixelButton onClick={reset} variant="secondary">Try again</PixelButton>
    </section>
  );
}
