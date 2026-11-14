/** Explicit JS scrolling must respect the preference too; CSS cannot override it. */
export function preferredScrollBehavior(): ScrollBehavior {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'instant' : 'smooth';
}
