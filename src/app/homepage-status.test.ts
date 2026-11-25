import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from './page';

const reads = vi.hoisted(() => ({
  core: vi.fn(),
  anticipated: vi.fn(),
}));
vi.mock('@/lib/services/homepage', () => ({
  HOMEPAGE_REVALIDATE_SECONDS: 300,
  loadHomepageDataWithStatus: reads.core,
  loadHomepageMostAnticipatedWithStatus: reads.anticipated,
}));
vi.mock('@/components/HeroCarousel', () => ({ default: () => 'Core hero' }));
vi.mock('@/components/HomepageClientSections', () => ({ default: () => null }));
vi.mock('@/components/HomepageNewsSection', () => ({ default: () => null }));
vi.mock('@/components/FadeInSection', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/ui/GradientText', () => ({ default: ({ text }: { text: string }) => text }));

const notice = 'Some game collections are temporarily unavailable.';
const core = { hero: [{ id: 'one', slug: 'one', headerImage: '/image.jpg' }], trending: [], topRated: [], newReleases: [], recommendations: [] };

describe('homepage degradation scope', () => {
  beforeEach(() => vi.resetAllMocks());

  it('omits the unavailable discovery rail without a page-wide notice when core succeeds', async () => {
    reads.core.mockResolvedValue({ data: core, degraded: false });
    reads.anticipated.mockResolvedValue({ data: [], degraded: true });
    const page = renderToStaticMarkup(await HomePage());
    expect(page).toContain('Core hero');
    expect(page).not.toContain('Most Anticipated');
    expect(page).not.toContain(notice);
  });

  it('shows the original timestamp on a usable discovery snapshot', async () => {
    const fetchedAt = '2026-11-23T11:30:00Z';
    reads.core.mockResolvedValue({ data: core, degraded: false });
    reads.anticipated.mockResolvedValue({
      data: [{ slug: 'fixture', name: 'Fixture upcoming game', rawgId: 7, added: 5, toplay: 2, genres: [] }],
      fetchedAt, degraded: false,
    });
    const page = renderToStaticMarkup(await HomePage());
    expect(page).toContain('Most Anticipated');
    expect(page).toContain('RAWG snapshot');
    expect(page).toContain(fetchedAt);
    expect(page).not.toContain(notice);
  });

  it('keeps the page-wide notice when a core reader fails', async () => {
    reads.core.mockResolvedValue({ data: core, degraded: true });
    reads.anticipated.mockResolvedValue({ data: [], degraded: false });
    expect(renderToStaticMarkup(await HomePage())).toContain(notice);
  });
});
