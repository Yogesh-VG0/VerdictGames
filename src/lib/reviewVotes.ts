import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface ReviewVoteCounts {
  up: number;
  down: number;
}

export interface ReviewVoteAggregateRow {
  id: string;
  helpful?: number | null;
  total_vote_count?: number | null;
}

export async function getReviewVoteAggregates(
  supabase: SupabaseClient<Database>,
  reviewIds: string[]
): Promise<Record<string, ReviewVoteCounts>> {
  if (reviewIds.length === 0) {
    return {};
  }

  const { data: voteData } = await supabase
    .from("review_votes")
    .select("review_id, value")
    .in("review_id", reviewIds);

  const voteCounts: Record<string, ReviewVoteCounts> = {};

  if (voteData) {
    for (const vote of voteData) {
      if (!voteCounts[vote.review_id]) {
        voteCounts[vote.review_id] = { up: 0, down: 0 };
      }

      if (vote.value === 1) {
        voteCounts[vote.review_id].up += 1;
      } else if (vote.value === -1) {
        voteCounts[vote.review_id].down += 1;
      }
    }
  }

  return voteCounts;
}

export function getReviewVoteCounts(
  row: ReviewVoteAggregateRow,
  voteCounts?: Record<string, ReviewVoteCounts>
) {
  const mappedCounts = voteCounts?.[row.id];
  const helpful = mappedCounts?.up ?? Math.max(0, row.helpful ?? 0);
  const totalVotes = mappedCounts
    ? mappedCounts.up + mappedCounts.down
    : Math.max(helpful, row.total_vote_count ?? helpful);

  return {
    helpful,
    notHelpful: Math.max(0, totalVotes - helpful),
    totalVotes,
  };
}

export async function getUserReviewVotes(
  supabase: SupabaseClient<Database>,
  reviewIds: string[],
  currentProfileId: string | null
): Promise<Record<string, number>> {
  if (!currentProfileId || reviewIds.length === 0) {
    return {};
  }

  const { data: myVotes } = await supabase
    .from("review_votes")
    .select("review_id, value")
    .in("review_id", reviewIds)
    .eq("profile_id", currentProfileId);

  const userVotes: Record<string, number> = {};

  if (myVotes) {
    for (const vote of myVotes) {
      userVotes[vote.review_id] = vote.value;
    }
  }

  return userVotes;
}

export function attachReviewVoteFields<T extends ReviewVoteAggregateRow>(
  row: T,
  userVotes: Record<string, number>,
  voteCounts?: Record<string, ReviewVoteCounts>
) {
  const { helpful, notHelpful } = getReviewVoteCounts(row, voteCounts);

  return {
    ...row,
    vote_up_count: helpful,
    vote_down_count: notHelpful,
    user_vote_value: userVotes[row.id] ?? null,
  };
}
