import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DeveloperClientPage from '@/components/DeveloperClientPage';
import { loadDeveloperHub } from '@/lib/services/developers';
import { SITE_URL, buildSocialMetadata } from '@/lib/seo';
export const revalidate = 900;
export function generateStaticParams() { return []; }
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const hub = await loadDeveloperHub(slug);
  if (!hub) return { title: 'Developer Not Found', robots: { index: false, follow: true } };
  const title = hub.name + ' | Developer Hub';
  const description = 'Browse ' + hub.gameCount + ' games by ' + hub.name + ', with verdict scores, reviews and platforms.';
  const url = SITE_URL + '/developers/' + slug;
  return { title, description, alternates: { canonical: url }, ...buildSocialMetadata({ title, description, url }) };
}
export default async function DeveloperPage({ params }: Props) {
  const { slug } = await params;
  const hub = await loadDeveloperHub(slug);
  if (!hub) notFound();
  return <DeveloperClientPage slug={slug} initialHub={hub} />;
}
