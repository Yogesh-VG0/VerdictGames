"use client";

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isAdminEmail } from "@/lib/adminEmails";

function isAdmin(user: { email: string; role?: string } | null): boolean {
  if (!user) return false;
  return user.role === "admin" || isAdminEmail(user.email);
}
import { LayoutDashboard, Gamepad2, FileText, Users, Clock, Database } from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { href: "/admin/games", label: "Games", icon: <Gamepad2 className="w-4 h-4" /> },
  { href: "/admin/reviews", label: "Reviews", icon: <FileText className="w-4 h-4" /> },
  { href: "/admin/users", label: "Users", icon: <Users className="w-4 h-4" /> },
  { href: "/admin/scheduler", label: "Scheduler", icon: <Clock className="w-4 h-4" /> },
  { href: "/admin/providers", label: "Providers", icon: <Database className="w-4 h-4" /> },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect non-admin users once auth has fully resolved
  useEffect(() => {
    if (loading) return;
    if (!isAdmin(user)) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-secondary">Loading admin panel...</div>
      </div>
    );
  }

  if (!isAdmin(user)) {
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
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
        {/* Sidebar — horizontal scrollable on mobile, vertical on desktop */}
        <aside className="md:w-56 shrink-0">
          <div className="md:sticky md:top-24 space-y-1">
            <div className="flex items-center justify-between md:block mb-2 md:mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">Admin Panel</h2>
                <p className="text-[11px] text-tertiary mt-0.5">
                  Logged in as {user?.username}
                </p>
              </div>
              <Link href="/" className="md:hidden text-xs text-tertiary hover:text-accent transition-colors">
                ← Site
              </Link>
            </div>
            <nav className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar pb-2 md:pb-0 -mx-1 px-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                      active
                        ? "bg-accent text-white shadow-sm shadow-accent/20"
                        : "text-secondary hover:text-foreground hover:bg-surface-2"
                    )}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="hidden md:block mt-4 pt-4 border-t border-border">
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
