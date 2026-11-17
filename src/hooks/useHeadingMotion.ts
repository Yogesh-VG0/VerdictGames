"use client";

import { useSyncExternalStore } from 'react';
const key = 'vg-pause-headings';
const eventName = 'vg-heading-motion';
let memoryPaused = false;
let storageUnavailable = false;
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(eventName, listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(eventName, listener); };
}
function snapshot() {
  if (storageUnavailable) return memoryPaused;
  try { return localStorage.getItem(key) === 'true'; } catch { return memoryPaused; }
}
export function useHeadingMotion() {
  const paused = useSyncExternalStore(subscribe, snapshot, () => false);
  function setPaused(value: boolean) {
    memoryPaused = value;
    try { localStorage.setItem(key, String(value)); } catch { storageUnavailable = true; }
    window.dispatchEvent(new Event(eventName));
  }
  return { paused, setPaused };
}
