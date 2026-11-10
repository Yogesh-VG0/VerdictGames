import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getPublicSupabase } from '@/lib/supabase/public';
import { mapProfileRow } from '@/lib/db/mappers';

export const loadPublicProfile = cache(unstable_cache(async (username: string) => {
  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(username)) return null;
  const { data, error } = await getPublicSupabase().from('profiles').select('*').eq('username', username).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [reviews, lists, library, followers, following] = await Promise.all([
    getPublicSupabase().from('reviews').select('id', { count: 'exact', head: true }).eq('profile_id', data.id),
    getPublicSupabase().from('lists').select('id', { count: 'exact', head: true }).eq('owner_id', data.id).eq('is_public', true),
    getPublicSupabase().from('user_games').select('id', { count: 'exact', head: true }).eq('user_id', data.id),
    getPublicSupabase().from('follows').select('id', { count: 'exact', head: true }).eq('following_id', data.id),
    getPublicSupabase().from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', data.id),
  ]);
  for (const result of [reviews, lists, library, followers, following]) if (result.error) throw result.error;
  return mapProfileRow(data, { gamesReviewed: reviews.count ?? 0, listsCreated: lists.count ?? 0,
    libraryCount: library.count ?? 0, followerCount: followers.count ?? 0, followingCount: following.count ?? 0 });
}, ['public-profile-summary-v1'], { revalidate: 900 }));
