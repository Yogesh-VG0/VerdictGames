# Search and AI discovery verification — November 11, 2026 (IST)

## Live firewall

With explicit owner approval, changed the production AI Bots managed rule from `deny` to `log`. Read back active configuration **version 5**, updated November 10 at 19:36:55 UTC (November 11 at 01:06:55 IST):

| Setting | Verified state |
| --- | --- |
| Firewall | Enabled |
| AI Bots | Active, log |
| Bot Protection | Active, challenge |
| Custom blocking/bypass rules | None |
| IP blocking rules | None |

This removes the blanket AI-category denial. It does not bypass authentication, application rate limits, or platform DDoS mitigations. Recognized training crawlers can also visit under this approved configuration, potentially increasing usage. Monitor AI crawler traffic and compute after hosting resumes.

[Vercel's documentation](https://vercel.com/docs/bot-management) says verified bots are exempt from Bot Protection challenges. Its directory includes Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, and Perplexity-User. Unknown or unverifiable clients can still be challenged. A crawler-looking user-agent alone does not prove identity.

## Repository and environment checks

- `robots.ts` permits `/` for all crawlers and explicitly for Googlebot, excludes `/api/` and `/admin/`, and advertises the sitemap. No extra robots restriction was necessary.
- Production `NEXT_PUBLIC_SITE_URL` is exactly `https://www.verdict.games`; production canonicals and sitemap URLs therefore use the intended public host. Local builds intentionally use their local development URL.
- Root metadata permits indexing/following and Google snippets, image previews, and video previews. Public canonical game pages inherit that policy. Preview games and missing pages retain their intentional indexing restrictions.
- Existing cached HTML, textual game information, canonical links, structured data, and complete sitemap remain available in the prepared application release. Dependency patches did not add crawler-blocking directives.

[Google's guidance](https://developers.google.com/search/docs/appearance/ai-features) uses Googlebot to control Google Search, including AI Overviews and AI Mode. Eligible pages must be indexed and permitted to show snippets; no special AI schema or extra AI text file is required. This configuration permits eligibility without guaranteeing selection or rankings.

[OpenAI distinguishes search from training](https://developers.openai.com/api/docs/bots): OAI-SearchBot supports ChatGPT search inclusion, while GPTBot collects potential training content. The approved firewall logging setting and existing robots rules do not categorically exclude either.

## Remaining live verification

Direct checks of `/`, `/robots.txt`, `/sitemap.xml`, and `/game/hades` still returned HTTP **402 `DEPLOYMENT_DISABLED`**. This hosting pause prevents present-day successful crawler access regardless of firewall allowances. The owner previously chose to wait for the free-tier reset; no billing change or quota workaround was attempted.

After the limit clears, deploy the latest `main` and verify HTTP 200 on crawlable pages, the apex redirect, public-host canonical/sitemap URLs, cache hits, and actual verified crawler events. Use Search Console URL Inspection's live test and sitemap submission; inspect exclusion reasons rather than assuming every excluded URL should be indexed. Real Google/OpenAI-origin requests cannot be established by impersonating their user-agent locally. No claim of successful live indexing is made while serving is disabled.
