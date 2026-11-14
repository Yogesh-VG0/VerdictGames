# Signal implementation and visual verification

The approved direction is a game catalogue: cinematic artwork, useful discovery rails, Explore rankings, list mosaics, and meaningful numeric Verdict Scores. Existing Geist/Space Grotesk fonts, URLs, themes, metadata, providers, and authentication remain. Frontend and animation skills were review guides. Their marketing-site rules, mandatory kit assets, one-section-per-screen layouts, and card bans were not applied to this catalogue.

## Applied system

| Role | Dark | Light | Purpose |
| --- | --- | --- | --- |
| Ground | #000000 | #f8fafc | Existing stage / shelf |
| Primary text | #f0f2f5 | #0f172a | Static page headings and readable UI |
| Primary action | #f0f2f5, ink text | #172033, white text | Sign-in, Read Verdict, save and selected controls |
| Brand / focus | #9d8aff | #6642c0 | Wordmark, focus, navigation state |
| Field boundary | #737e90 | #78818e | Distinguishable controls without brightening every divider |
| Great score | #4ade80 | #147b36 | Same score meaning; readable on each theme |

Score badges over photographs retain a dark ground and the bright score palette in both themes. Source chips use opaque grounds; faint source/count labels were made legible. Numeric score badges are larger. Decorative dividers remain quiet. Artwork heroes keep their existing dark scrims; no redundant overlay was added after the sampled heroes proved readable.

Affected foundations: `src/app/globals.css`, `src/app/providers.tsx`, `ui/GradientText.tsx`, `ui/PixelButton.tsx`, `ui/FilterChips.tsx`, `ui/ScoreRing.tsx`, `GameCard.tsx`, `ScoreChips.tsx`. Search, library, settings, review controls, auth, and navigation adopt the relevant tokens. Existing semantic danger/success states remain distinct from ordinary actions.

## Motion review

| Before | After | Why |
| --- | --- | --- |
| Per-heading infinite background-position animation | Static foreground heading | Repeated motion did not communicate a state change |
| Page/section opacity and slide entrances | Primary content initially visible | Avoid unnecessary perceived delay and invisible pre-hydration content |
| Animated height in reviews, comments, Explore, free filters and calendar | Immediate disclosure | Avoid layout animation and respect frequent interactions |
| Hero zoom / long crossfade | 240ms crossfade, pause on hover/focus, explicit pause control | Retain cinematic discovery with clear user control |
| Autoplay under reduced motion | Autoplay off; no progress timer animation | MotionConfig alone does not stop timers or opacity |
| Score stroke animation with a delayed one-second draw | One 400ms draw; immediate final stroke under reduced motion | Explicitly handle a property MotionConfig does not disable |
| Broad card transitions / 10% image zoom | Short, constrained lift/press and 3% zoom | Feedback without distracting from artwork |
| Unconditional JavaScript smooth scrolling | Preference-aware scroll behavior | CSS cannot override an explicit JS smooth-scroll option |

Auth, navigation overlays, media, library feedback, and toasts explicitly adjust their opacity/timing for reduced motion. CSS remains a backstop; touch cards do not retain hover transforms. `FadeInSection` was already a static wrapper in the baseline and was not redundantly rewritten. Motion decisions are approved for the tested branch flows; this is not certification of every animation or assistive technology.

## Rendered checks

- Nine route templates at 390x844, 768x1024, and 1440x1000, dark and light: **54 before / 54 after renders**. Actual Chrome screenshots are under `screenshots/before` and `screenshots/after`; no fake before states were constructed.
- Additional 320/820/1024/1100px responsive checks, reduced-motion hero over an entire advance interval, long titles with missing artwork, slow/failed search and recovery, delayed game navigation with visible loading feedback, comparison by keyboard, reachable final chips/months, and auth focus wrap/Escape/return passed.
- Hades, Schedule I and Clair Obscur artwork were inspected in the relevant hero samples. Trailer screenshots show a real poster; if a poster fails, the preview now falls back to the game's artwork. Live playback availability remains an upstream dependency.
- Actual local A-login/logout/B-login/logout, owner-only library, signed-in phone/tablet navigation, and administrator maintenance UI passed. All test identities and records were removed by their tracked IDs; the original local identity remains.
- Measured search-field boundary contrast: **4.82:1 dark / 3.60:1 light**. Placeholder text: **6.54:1 / 6.92:1**. Input text and sampled primary-action text also pass 4.5:1. These measurements apply to sampled controls, not every text pixel over arbitrary artwork.
- Some early screenshots caught a dialog mid-entrance; final captures wait for settled parent and dialog opacity. Network-idle waits also proved unsuitable for independent provider/image requests; verification now waits for rendered application content. A warm local calendar document returned 200 in **11.8ms total**, demonstrating why that browser wait was not a 45-second document response. This is not a production latency benchmark.

No new production PageSpeed improvement is claimed before deployment. Earlier production PageSpeed reports concern the baseline in `PERFORMANCE.md`, not this branch. Recorded browser render timings use different wait conditions across early runs and must not be compared as a speed improvement. Scripted usability tasks passed; external-human testing and production field Core Web Vitals remain unverified.

Rollback: revert the Signal commit while retaining the privacy, reliability and data-preservation fixes. There are no schema, provider credential, billing, or production infrastructure changes in this visual change set.
