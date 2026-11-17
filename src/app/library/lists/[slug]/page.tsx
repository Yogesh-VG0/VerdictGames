import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCurrentUser, getAuthSupabase } from '@/lib/supabase/auth';
import { readOwnedList } from '@/lib/services/public-list';
import ListDetailClientPage from '@/components/ListDetailClientPage';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Private List',robots:{index:false,follow:false}};

export default async function OwnedListPage({params}:{params:Promise<{slug:string}>}){
  const user=await getCurrentUser();
  if(!user)notFound();
  const {slug}=await params;
  const list=await readOwnedList(await getAuthSupabase(),slug,user.profileId);
  if(!list)notFound();
  return <ListDetailClientPage slug={slug} initialList={list} privateOwner={user.id}/>;
}
