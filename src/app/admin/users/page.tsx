"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  role: string;
  joinedAt: string;
  favoriteGenres: string[];
  reviewCount: number;
  listCount: number;
  libraryCount: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("q", search);
      const res = await fetch(`/api/admin/users?${params}`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data.users);
        setTotal(json.data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-sm text-secondary mt-1">{total} registered profiles</p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by username or display name..."
          className="w-full rounded-xl bg-surface border border-border px-4 py-2.5 pl-10 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary text-sm">🔍</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-secondary text-sm">No users found.</div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider text-center">Reviews</th>
                  <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider text-center">Lists</th>
                  <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider text-center">Library</th>
                  <th className="px-4 py-3 text-xs font-medium text-tertiary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface-2 shrink-0">
                          {u.avatar ? (
                            <Image src={u.avatar} alt="" fill className="object-cover" sizes="32px" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-tertiary">
                              {u.username[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{u.displayName || u.username}</p>
                          <p className="text-[10px] text-tertiary">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        u.role === "admin" ? "bg-accent/20 text-accent" : "bg-surface-2 text-tertiary"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-tertiary text-xs">{formatDate(u.joinedAt)}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-foreground">{u.reviewCount}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-foreground">{u.listCount}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-foreground">{u.libraryCount}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/user/${u.username}`}
                        className="text-xs text-accent hover:text-accent-hover transition-colors"
                      >
                        View Profile →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {users.map(u => (
              <div key={u.id} className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-surface-2 shrink-0">
                    {u.avatar ? (
                      <Image src={u.avatar} alt="" fill className="object-cover" sizes="40px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm text-tertiary">
                        {u.username[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.displayName || u.username}</p>
                    <p className="text-[10px] text-tertiary">@{u.username}</p>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    u.role === "admin" ? "bg-accent/20 text-accent" : "bg-surface-2 text-tertiary"
                  }`}>
                    {u.role}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold tabular-nums text-foreground">{u.reviewCount}</p>
                    <p className="text-[9px] text-tertiary uppercase">Reviews</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums text-foreground">{u.listCount}</p>
                    <p className="text-[9px] text-tertiary uppercase">Lists</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold tabular-nums text-foreground">{u.libraryCount}</p>
                    <p className="text-[9px] text-tertiary uppercase">Library</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-tertiary">{formatDate(u.joinedAt)}</p>
                    <p className="text-[9px] text-tertiary uppercase">Joined</p>
                  </div>
                </div>
                <Link
                  href={`/user/${u.username}`}
                  className="block text-center text-xs text-accent hover:text-accent-hover py-1.5 border-t border-border mt-2 pt-2 transition-colors"
                >
                  View Profile →
                </Link>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-secondary hover:text-foreground hover:bg-surface-2 transition-all disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="text-xs text-tertiary">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-secondary hover:text-foreground hover:bg-surface-2 transition-all disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
