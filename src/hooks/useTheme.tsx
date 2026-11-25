"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { readThemePreference, SYSTEM_THEME_QUERY, THEME_STORAGE_KEY, type Theme } from "@/lib/theme-preference";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const manualPreference = useRef<Theme | null>(null);

  useEffect(() => {
    const system = window.matchMedia?.(SYSTEM_THEME_QUERY);
    const sync = () => {
      const next = manualPreference.current ?? (system?.matches ? "light" : "dark");
      document.documentElement.classList.toggle("light", next === "light");
      setTheme(next);
    };
    manualPreference.current = readThemePreference();
    sync();
    system?.addEventListener?.("change", sync);
    return () => system?.removeEventListener?.("change", sync);
  }, []);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    const next = root.classList.contains("light") ? "dark" : "light";
    manualPreference.current = next;
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Keep this tab's manual preference. */ }
    root.classList.toggle("light", next === "light");
    setTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
