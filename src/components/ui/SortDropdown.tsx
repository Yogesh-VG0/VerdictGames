"use client";

import { cn } from "@/lib/utils";
import { useSyncExternalStore } from "react";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

interface SortDropdownProps<T extends string> {
  options: { label: string; value: T }[];
  selected: T;
  onChange: (value: T) => void;
  className?: string;
  id?: string;
  name?: string;
}

export default function SortDropdown<T extends string>({
  options,
  selected,
  onChange,
  className,
  id,
  name,
}: SortDropdownProps<T>) {
  // Native changes made before React attaches onChange are not replayed.
  // Keep the server-rendered selection intact until the control can navigate.
  const interactive = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);

  return (
    <select
      id={id}
      name={name}
      value={selected}
      disabled={!interactive}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn(
        "vg-select text-sm font-medium",
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 14px center",
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
