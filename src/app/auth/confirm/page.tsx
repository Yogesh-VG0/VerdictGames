import type { Metadata } from 'next';
import EmailConfirmation from '@/components/EmailConfirmation';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ConfirmEmailPage() {
  return <EmailConfirmation />;
}
