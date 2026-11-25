export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "vg-theme";
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: light)";

export function readThemePreference(): Theme | null {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

// Execute in the document head before any themed content can paint.
export const themeBootstrap = `(()=>{let saved;try{saved=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch{}const light=saved==="light"||(saved!=="dark"&&window.matchMedia?.(${JSON.stringify(SYSTEM_THEME_QUERY)})?.matches);document.documentElement.classList.toggle("light",!!light)})()`;
