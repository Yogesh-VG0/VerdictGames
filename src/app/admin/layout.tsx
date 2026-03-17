"use client";

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { isAdminEmail } from "@/lib/adminEmails";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/games", label: "Games", icon: "🎮" },
  { href: "/admin/reviews", label: "Reviews", icon: "📝" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !isAdminEmail(user.email))) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-secondary">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdminEmail(user.email)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-secondary">You need admin privileges to access this page.</p>
          <Link href="/" className="text-accent hover:text-accent-hover text-sm font-medium">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <aside className="md:w-56 shrink-0">
          <div className="md:sticky md:top-24 space-y-1">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Admin Panel</h2>
              <p className="text-[11px] text-tertiary mt-0.5">
                Logged in as {user.username}
              </p>
            </div>
            <nav className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                      active
                        ? "bg-accent text-white shadow-sm shadow-accent/20"
                        : "text-secondary hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="hidden md:block mt-4 pt-4 border-t border-white/[0.06]">
              <Link href="/" className="text-xs text-tertiary hover:text-accent transition-colors">
                ← Back to Site
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
