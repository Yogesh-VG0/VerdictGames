import type { Metadata } from "next";
import type { GameRow } from "@/lib/supabase/types";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { title: "Game | verdict.games" };

    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = getServerSupabase();

    const { data } = await supabase
      .from("games")
      .select("title, verdict_summary, cover_image, genres, platforms, score, developer")
      .eq("slug", slug)
      .maybeSingle() as { data: Pick<GameRow, "title" | "verdict_summary" | "cover_image" | "genres" | "platforms" | "score" | "developer"> | null };

    if (!data) return { title: "Game Not Found | verdict.games" };

    const description = data.verdict_summary
      ? `${data.verdict_summary.slice(0, 155)}…`
      : `${data.title} — ${data.score}/100 verdict score. ${data.genres.slice(0, 3).join(", ")} game by ${data.developer}.`;

    return {
      title: `${data.title} — ${data.score}/100 Verdict`,
      description,
      openGraph: {
        title: `${data.title} — ${data.score}/100 Verdict`,
        description,
        images: data.cover_image ? [{ url: data.cover_image, width: 400, height: 560 }] : [],
        type: "article",
        siteName: "verdict.games",
      },
      twitter: {
        card: "summary_large_image",
        title: `${data.title} — ${data.score}/100 Verdict`,
        description,
        images: data.cover_image ? [data.cover_image] : [],
      },
    };
  } catch {
    return { title: "Game | verdict.games" };
  }
}

export default function GameLayout({ children }: Props) {
  return children;
}
