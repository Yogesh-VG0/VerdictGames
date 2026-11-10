import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProfileClientPage from '@/components/ProfileClientPage';
import { loadPublicProfile } from '@/lib/services/public-profile';
import { SITE_URL, buildSocialMetadata } from '@/lib/seo';
export const revalidate = 900;
export function generateStaticParams() { return []; }
type Props = { params: Promise<{ username: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const user = await loadPublicProfile(username);
  if (!user) return { title: 'Profile Not Found', robots: { index: false, follow: true } };
  const title = user.displayName + ' | Player Profile';
  const description = user.bio || 'View ' + username + "'s public game reviews and activity on Verdict Games.";
  const url = SITE_URL + '/profile/' + encodeURIComponent(username);
  return { title, description, alternates: { canonical: url }, ...buildSocialMetadata({ title, description, url, type: 'profile' }) };
}
export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const user = await loadPublicProfile(username);
  if (!user) notFound();
  return <ProfileClientPage username={username} initialUser={user} />;
}
