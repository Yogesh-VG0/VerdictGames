"use client";

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Search, Gamepad2, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import AuthModal from './AuthModal';

const destinations = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/library', label: 'Library', icon: Gamepad2 },
];
const itemClass = 'relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition-colors';

function BottomNavContent() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  return <>
    <nav aria-label="Bottom navigation" className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-border bg-background/95 backdrop-blur-xl safe-area-bottom">
      <div className="flex h-16 items-center px-2">
        {destinations.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return <Link key={href} href={href} prefetch={false} aria-current={active ? 'page' : undefined}
            className={cn(itemClass, active ? 'text-accent bg-accent/10' : 'text-secondary')}>
            <Icon aria-hidden="true" className="h-5 w-5" /><span>{label}</span>
          </Link>;
        })}
        {user ? <Link href={`/profile/${user.username}`} prefetch={false}
          aria-current={pathname === `/profile/${user.username}` ? 'page' : undefined}
          className={cn(itemClass, pathname === `/profile/${user.username}` ? 'text-accent bg-accent/10' : 'text-secondary')}>
          <User aria-hidden="true" className="h-5 w-5" /><span>You</span>
        </Link> : <button type="button" onClick={() => setAuthOpen(true)} aria-haspopup="dialog" className={cn(itemClass, 'text-secondary')}>
          <User aria-hidden="true" className="h-5 w-5" /><span>You</span>
        </button>}
      </div>
    </nav>
    <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} message="Sign in to manage your profile and library." />
  </>;
}

export default function BottomNav() {
  return <Suspense fallback={null}><BottomNavContent /></Suspense>;
}
