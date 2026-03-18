import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PlatformIconProps {
  platform: string;
  size?: number;
  className?: string;
}

const ICONS: Record<string, (s: number) => ReactNode> = {
  PC: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  macOS: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  ),
  Linux: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.5 2C10 2 8 4 8 6.5V10c0 .6-.2 1.1-.5 1.5L5 14.5c-.5.6-.7 1.4-.5 2.1.3.9 1 1.5 1.9 1.7l1.1.2c.5.1.8.6.6 1.1l-.4 1.2c-.2.6.1 1.2.7 1.4l2.1.7c.4.1.8 0 1.1-.3l.9-1c.3-.3.7-.5 1.1-.5h.8c.4 0 .8.2 1.1.5l.9 1c.3.3.7.4 1.1.3l2.1-.7c.6-.2.9-.8.7-1.4l-.4-1.2c-.2-.5.1-1 .6-1.1l1.1-.2c.9-.2 1.6-.8 1.9-1.7.2-.7 0-1.5-.5-2.1L19.5 11.5c-.3-.4-.5-.9-.5-1.5V6.5C19 4 17 2 14.5 2h-2z" />
    </svg>
  ),
  "PlayStation 5": (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.5 4v16l-5-3.5V14l5 3V7.5l4.5-1.5v12L9.5 20M22 15.5l-5 2V14l3-1v-1.5L15 13V8l7 3v4.5z" />
    </svg>
  ),
  "PlayStation 4": (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.5 4v16l-5-3.5V14l5 3V7.5l4.5-1.5v12L9.5 20M22 15.5l-5 2V14l3-1v-1.5L15 13V8l7 3v4.5z" />
    </svg>
  ),
  "Xbox Series X|S": (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.43 3.72A9.97 9.97 0 0112 2a9.97 9.97 0 015.57 1.72c-.41.28-1.07.81-1.85 1.62-1.56 1.6-3.72 4.32-3.72 4.32s-2.16-2.72-3.72-4.32c-.78-.81-1.44-1.34-1.85-1.62zM3.68 5.75A9.97 9.97 0 002 12c0 3.68 1.99 6.89 4.95 8.62.02-.5.12-1.22.37-2.13.43-1.58 1.24-3.65 2.65-5.88-2.07-2.43-4.11-4.24-4.93-4.97l-1.36-1.89zm16.64 0l-1.36 1.89c-.82.73-2.86 2.54-4.93 4.97 1.41 2.23 2.22 4.3 2.65 5.88.25.91.35 1.63.37 2.13A9.97 9.97 0 0022 12c0-2.41-.86-4.63-2.32-6.25zM12 14.88c-1.74 2.46-2.66 4.65-3.11 6.29-.3 1.1-.39 1.89-.39 2.28A9.95 9.95 0 0012 24c1.27 0 2.49-.24 3.5-.55 0-.39-.09-1.18-.39-2.28-.45-1.64-1.37-3.83-3.11-6.29z" />
    </svg>
  ),
  "Xbox One": (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.43 3.72A9.97 9.97 0 0112 2a9.97 9.97 0 015.57 1.72c-.41.28-1.07.81-1.85 1.62-1.56 1.6-3.72 4.32-3.72 4.32s-2.16-2.72-3.72-4.32c-.78-.81-1.44-1.34-1.85-1.62zM3.68 5.75A9.97 9.97 0 002 12c0 3.68 1.99 6.89 4.95 8.62.02-.5.12-1.22.37-2.13.43-1.58 1.24-3.65 2.65-5.88-2.07-2.43-4.11-4.24-4.93-4.97l-1.36-1.89zm16.64 0l-1.36 1.89c-.82.73-2.86 2.54-4.93 4.97 1.41 2.23 2.22 4.3 2.65 5.88.25.91.35 1.63.37 2.13A9.97 9.97 0 0022 12c0-2.41-.86-4.63-2.32-6.25zM12 14.88c-1.74 2.46-2.66 4.65-3.11 6.29-.3 1.1-.39 1.89-.39 2.28A9.95 9.95 0 0012 24c1.27 0 2.49-.24 3.5-.55 0-.39-.09-1.18-.39-2.28-.45-1.64-1.37-3.83-3.11-6.29z" />
    </svg>
  ),
  "Nintendo Switch": (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.5 1C5.57 1 4 2.57 4 4.5v15C4 21.43 5.57 23 7.5 23H10V1H7.5zM7.5 16a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM14 1v22h2.5c1.93 0 3.5-1.57 3.5-3.5v-15C20 2.57 18.43 1 16.5 1H14zm2.5 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  ),
  "Nintendo Switch 2": (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.5 1C5.57 1 4 2.57 4 4.5v15C4 21.43 5.57 23 7.5 23H10V1H7.5zM7.5 16a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM14 1v22h2.5c1.93 0 3.5-1.57 3.5-3.5v-15C20 2.57 18.43 1 16.5 1H14zm2.5 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  ),
  Android: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.6 9.48l1.84-3.18a.39.39 0 00-.67-.39l-1.87 3.23A11.41 11.41 0 0012 8a11.41 11.41 0 00-4.9 1.14L5.23 5.91a.39.39 0 00-.67.39L6.4 9.48A10.85 10.85 0 001 18h22a10.85 10.85 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
    </svg>
  ),
  iOS: (s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  ),
};

const COLOR_MAP: Record<string, string> = {
  PC: "text-accent",
  macOS: "text-accent",
  Linux: "text-accent",
  "PlayStation 5": "text-[#0070d1]",
  "PlayStation 4": "text-[#0070d1]",
  "Xbox Series X|S": "text-[#107c10]",
  "Xbox One": "text-[#107c10]",
  "Nintendo Switch": "text-[#e60012]",
  "Nintendo Switch 2": "text-[#e60012]",
  Android: "text-[#3ddc84]",
  iOS: "text-secondary",
};

export default function PlatformIcon({ platform, size = 14, className }: PlatformIconProps) {
  const render = ICONS[platform];
  if (!render) {
    return (
      <span className={cn("text-[9px] font-bold text-secondary uppercase", className)} title={platform}>
        {platform.slice(0, 3)}
      </span>
    );
  }
  return (
    <span className={cn(COLOR_MAP[platform] ?? "text-secondary", className)} title={platform}>
      {render(size)}
    </span>
  );
}
