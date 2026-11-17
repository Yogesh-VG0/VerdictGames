"use client";
import { useHeadingMotion } from '@/hooks/useHeadingMotion';
export default function HeadingMotionControl() {
  const { paused, setPaused } = useHeadingMotion();
  return <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)} className="min-h-11 rounded-xl border border-border px-3 py-2 text-xs text-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{paused ? 'Resume animated headings' : 'Pause animated headings'}</button>;
}
