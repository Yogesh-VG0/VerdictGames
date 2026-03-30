import type { Metadata } from "next";
import CalendarClientPage from "@/components/CalendarClientPage";
import { loadCalendarMonth, CALENDAR_REVALIDATE_SECONDS } from "@/lib/services/calendar";
import { buildCalendarPagePath, getCalendarSeoCopy, parseCalendarPageState } from "@/lib/utils/gx-calendar";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.verdict.games";

export const dynamic = "force-dynamic";

if (!CALENDAR_REVALIDATE_SECONDS) {
  throw new Error("Calendar page requires the shared calendar loader revalidate contract.");
}

interface CalendarPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: CalendarPageProps): Promise<Metadata> {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const state = parseCalendarPageState(resolvedSearchParams);
  const canonicalPath = buildCalendarPagePath(state);
  const pageUrl = `${SITE_URL}${canonicalPath}`;
  const { title, description } = getCalendarSeoCopy(state.month);

  return {
    title,
    description,
    keywords: ["game release calendar", "upcoming games", "game launch dates", "new game releases"],
    alternates: { canonical: canonicalPath },
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

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const state = parseCalendarPageState(resolvedSearchParams);
  const initialMonthData = await loadCalendarMonth(state.month);

  return <CalendarClientPage initialMonth={state.month} initialMonthData={initialMonthData} />;
}
