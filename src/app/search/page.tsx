import type { Metadata } from "next";
import SearchClientPage from "@/components/SearchClientPage";
import { buildSearchPagePath, getSearchRobotsRule, getSearchSeoCopy, parseSearchPageState } from "@/lib/search";
import { loadSearchResults, SEARCH_REVALIDATE_SECONDS } from "@/lib/services/search";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const dynamic = "force-dynamic";

if (!SEARCH_REVALIDATE_SECONDS) {
  throw new Error("Search page requires the shared search loader revalidate contract.");
}

interface SearchPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const state = parseSearchPageState(resolvedSearchParams);
  const canonicalPath = buildSearchPagePath(state);
  const pageUrl = `${SITE_URL}${canonicalPath}`;
  const { title, description } = getSearchSeoCopy(state);
  const robotsRule = getSearchRobotsRule(state);

  return {
    title,
    description,
    keywords: ["search games", "game reviews", "game filter", "verdict scores", "game discovery"],
    alternates: { canonical: canonicalPath },
    robots: robotsRule === "index,follow" ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "verdict.games",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const state = parseSearchPageState(resolvedSearchParams);
  const initialGamesData = state.browseTab === "games"
    ? await loadSearchResults(state.games).catch(() => null)
    : null;

  return <SearchClientPage initialState={state} initialGamesData={initialGamesData} />;
}
