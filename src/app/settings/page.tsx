"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserProfile } from "@/lib/api";
import GradientText from "@/components/ui/GradientText";
import { Settings, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const GENRE_OPTIONS = [
  "Action", "Adventure", "RPG", "Strategy", "Simulation",
  "Sports", "Racing", "Puzzle", "Horror", "FPS",
  "Platformer", "Fighting", "Survival", "Indie", "MMO",
  "Roguelike", "Sandbox", "Visual Novel", "Rhythm",
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const [avatarError, setAvatarError] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user", user?.username],
    queryFn: () => getUserProfile(user?.username ?? ""),
    enabled: !!user?.username,
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState<{ base64: string; contentType: string } | null>(null);
  const [saved, setSaved] = useState(false);

  // Track dirty state for unsaved changes warning
  const isDirty = profile ? (
    displayName !== (profile.displayName ?? "") ||
    bio !== (profile.bio ?? "") ||
    JSON.stringify(favoriteGenres) !== JSON.stringify(profile.favoriteGenres ?? []) ||
    avatarFile !== null
  ) : false;

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Initialize form from profile data — moved to useEffect
  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayName(profile.displayName ?? "");
      setBio(profile.bio ?? "");
      setFavoriteGenres(profile.favoriteGenres ?? []);
      setAvatarPreview(profile.avatar ?? "");
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Upload avatar if changed
      if (avatarFile) {
        const uploadRes = await fetch("/api/profile/settings", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: avatarFile.base64, contentType: avatarFile.contentType }),
        });

        if (!uploadRes.ok) {
          const errJson = await uploadRes.json().catch(() => ({}));
          throw new Error(errJson.error ?? "Avatar upload failed");
        }

        // Use the returned avatar URL
        const uploadData = await uploadRes.json();
        if (uploadData.data?.avatarUrl) {
          setAvatarPreview(uploadData.data.avatarUrl);
        }
      }

      // Update profile fields
      const res = await fetch("/api/profile/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          bio,
          favorite_genres: favoriteGenres,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Failed to save");
      }
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["user", user?.username] });
      setAvatarFile(null); // Clear pending upload
      setSaved(true);
      addToast("Settings saved successfully!", "success");
      setTimeout(() => setSaved(false), 3000);
      // Refresh auth context so navbar/profile updates immediately
      await refreshUser();
    },
  });

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be under 2MB. Please choose a smaller file.");
      return;
    }
    setAvatarError("");

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarPreview(result);
      // Extract base64 data
      const base64 = result.split(",")[1];
      setAvatarFile({ base64, contentType: file.type });
    };
    reader.readAsDataURL(file);
  }, []);

  const toggleGenre = (g: string) => {
    setFavoriteGenres(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  const handleBack = () => {
    // Try to go back, fallback to home if no history
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-secondary">Please sign in to edit your profile.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-8">
      {/* Back button + header */}
      <div className="space-y-1">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-foreground transition-colors mb-2 group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Settings className="w-6 h-6 text-teal-500" />
          <GradientText text="Profile Settings" gradient="linear-gradient(90deg, #14b8a6 0%, #2dd4bf 25%, #5eead4 50%, #2dd4bf 75%, #14b8a6 100%)" />
        </h1>
        <p className="text-sm text-secondary mt-1">Customize how others see you on Verdict</p>
      </div>

      {/* Avatar */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Avatar</h2>
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="Avatar" width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-accent/40 to-pixel-cyan/30 flex items-center justify-center">
                  <span className="text-2xl font-bold text-white">
                    {(displayName || user.username || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <span className="text-white text-xs font-medium">Change</span>
            </button>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm font-medium text-accent hover:text-accent-hover transition-colors"
            >
              Upload new photo
            </button>
            <p className="text-[10px] text-tertiary">JPG, PNG or WebP. Max 2MB.</p>
          </div>
          <input
            id="settings-avatar"
            name="avatar"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        {avatarError && (
          <div className="flex items-center gap-2 rounded-xl bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{avatarError}</span>
          </div>
        )}
      </div>

      {/* Profile Info */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-5">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Profile Info</h2>

        <div>
          <label htmlFor="settings-display-name" className="block text-xs font-medium text-secondary mb-1.5">Display Name</label>
          <input
            id="settings-display-name"
            name="displayName"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="Your display name"
            className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors"
          />
          <p className="text-right text-[10px] text-tertiary mt-1">{displayName.length}/50</p>
        </div>

        <div>
          <label htmlFor="settings-bio" className="block text-xs font-medium text-secondary mb-1.5">Bio</label>
          <textarea
            id="settings-bio"
            name="bio"
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={250}
            rows={3}
            placeholder="Tell other gamers about yourself..."
            className="w-full rounded-xl bg-surface-2 border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-tertiary focus:border-accent focus:outline-none transition-colors resize-none"
          />
          <p className="text-right text-[10px] text-tertiary mt-1">{bio.length}/250</p>
        </div>
      </div>

      {/* Favorite Genres */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Favorite Genres</h2>
          <p className="text-xs text-tertiary mt-0.5">Select genres you enjoy — they&apos;ll appear as badges on your profile.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {GENRE_OPTIONS.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGenre(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                favoriteGenres.includes(g)
                  ? "bg-accent/20 border-accent/40 text-accent"
                  : "bg-surface-2 border-border text-tertiary hover:text-secondary"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="px-6 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 shadow-lg shadow-accent/20"
        >
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={() => router.push(`/profile/${user.username}`)}
          className="px-6 py-2.5 rounded-xl border border-border text-secondary text-sm font-medium hover:text-foreground hover:border-border-hover transition-colors"
        >
          View Profile
        </button>
        {saved && (
          <span className="text-sm text-success font-medium animate-fade-in">✓ Saved!</span>
        )}
        {saveMutation.isError && (
          <span className="text-sm text-danger">{(saveMutation.error as Error).message}</span>
        )}
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-danger/20 bg-danger/5 p-5 sm:p-6 space-y-3">
        <h2 className="text-sm font-bold text-danger uppercase tracking-wider">Danger Zone</h2>
        <p className="text-xs text-secondary leading-relaxed">
          Permanently delete your account and all associated data including reviews, library, and profile information. This action cannot be undone.
        </p>
        <button
          onClick={() => {
            if (window.confirm("Are you sure you want to delete your account? This action is permanent and cannot be undone.")) {
              addToast("Please contact support@verdict.games to complete account deletion.", "info", 8000);
            }
          }}
          className="px-4 py-2 rounded-xl border border-danger/30 text-danger text-sm font-medium hover:bg-danger/10 transition-colors"
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
