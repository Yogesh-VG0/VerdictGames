import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ListDetailClientPage from '@/components/ListDetailClientPage';
import { loadPublicList } from '@/lib/services/public-list';
import { SITE_URL, buildSocialMetadata } from '@/lib/seo';

export const revalidate = 300;
export function generateStaticParams() { return []; }
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const list = await loadPublicList(slug);
  if (!list) return { title: 'List Not Found', robots: { index: false, follow: true } };
  const description = list.description.slice(0, 160) || `${list.title} - a curated game list on Verdict Games.`;
  const url = `${SITE_URL}/lists/${slug}`;
  return { title: list.title, description, alternates: { canonical: url }, ...buildSocialMetadata({ title: list.title, description, url, image: list.coverImage || undefined, type: 'article' }) };
}
export default async function ListDetailPage({ params }: Props) {
  const { slug } = await params;
  const list = await loadPublicList(slug);
  if (!list) notFound();
  return <ListDetailClientPage slug={slug} initialList={list} />;
}
