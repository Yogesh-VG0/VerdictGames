"use client";

import { cn } from "@/lib/utils";

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
  return (
    <select
      id={id}
      name={name}
      value={selected}
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
