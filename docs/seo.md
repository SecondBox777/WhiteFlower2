# Mindscope SEO / GEO

## Applied rules

- Descriptive, localized titles and descriptions; canonical URLs and reciprocal `hreflang` for all six languages.
- Six pre-rendered landing pages served at `/` and `/?lang=…`. Crawlers receive translated headings, service explanations and FAQs without executing JavaScript. The browser keeps metadata and structured data in sync when switching languages.
- `robots.txt` permits public discovery and points to `sitemap.xml`. Private API/share URLs and internal generated files are excluded from crawling. This is crawler guidance, not access control.
- Organization, WebSite and WebPage/FAQPage JSON-LD uses the actual brand, supported languages and visible FAQ answers. No invented reviews, ratings, credentials or prices. FAQ markup does not guarantee a rich result or AI citation.
- Visible answers explain who the game is for, the free puzzles versus the optional paid report, and the internal scoring method and its limits. Reports, payment authorization and email content are unchanged.
- The homepage language selector has static options, native controls, explicit contrast and width. Purchase/report state no longer disables this homepage control; the purchased report retains its saved language.

## Maintaining content

Edit Korean landing content in `index.html` and add its five translations in `translations.js`. Edit search titles/descriptions in `seo.js`. `npm run build` generates `dist/_home/*.html`. Keep visible claims and structured data consistent. Add real pages to the sitemap when they are published; do not add session URLs or fabricated update dates. Do not add keyword repetition, hidden promotional text or unsupported claims of scientific validity.

## After deployment

1. Verify domain ownership in Google Search Console and Naver Search Advisor using the account owner's verification token (DNS or provided HTML tag/file). Google and Naver verification files are already included in the repository; their presence does not confirm that verification and sitemap submission were completed in the owner accounts.
2. Submit `https://mindscope.online/sitemap.xml` in both consoles and inspect the homepage plus language URLs.
3. Check indexing, crawl errors, search impressions and clicks over time. Check whether Cloudflare security settings allow Googlebot and Naver Yeti; robots.txt cannot override a firewall block.
4. Review actual AI/search referral traffic and citations over time. Technical eligibility cannot guarantee ranking, recommendation or citation. No external promotional messages or account submissions were sent by this change.

## Requested references

- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=ko): clear titles, helpful content, crawlable links and technical foundations.
- [Naver SEO basics](https://searchadvisor.naver.com/guide/seo-basic-intro): accessible HTML, robots.txt, sitemaps and ownership verification.
- [Google AI search guidance](https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search?hl=ko): useful original content, good page experience, crawler access and structured data matching visible content.
- [Toss Payments GEO article](https://www.tosspayments.com/blog/articles/39461): audience-centered product explanations and organized, question-led content. No fabricated external endorsements or freshness signals were added.


## 2026-10-22 audit and IQ test positioning

### Evidence and limits

- The production English URL `https://mindscope.online/?lang=en` returned HTTP 200 with `Content-Language: en`, rendered English HTML and no `X-Robots-Tag` exclusion in the observed response. This verifies ordinary HTTP access, not Googlebot access through every Cloudflare security rule.
- Existing source already has six server-rendered language versions, self-canonical URLs, reciprocal hreflang, an index/follow meta tag and a sitemap. Query-string language URLs are not, by themselves, evidence of an indexing problem. URL migration was unnecessary.
- Previous English search title was “30 Free IQ-Themed Puzzles & Personal Reports”; the hero described an “IQ-themed puzzle game”. Those descriptions fit the product poorly for a visitor explicitly searching for an online IQ test. This is a content relevance hypothesis, not proof that wording alone caused zero visits.
- Public `site:mindscope.online` searches in this audit did not surface this domain. That is a reason to inspect indexing, not proof of deindexing: [Google explains that site searches are not exhaustive](https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site).
- Searches for online IQ tests surfaced numerous competing pages, including [Psychology.com's reasoning quiz](https://psychology.com/tests/iq-test), [CogniScale](https://cogniscale.org/) and [IQPF](https://iqpf.com/iq-test). Competition is visible; its share of the traffic problem, exact rankings, keyword volumes, backlink strength and domain authority were not measured.
- No Search Console or Analytics account data was available. Zero impressions, low positions, poor click-through rate and missing analytics collection are different issues and cannot be distinguished from public HTML alone. Verification files and a GA tag exist, but account configuration and event receipt remain unverified.

### Changes shipped

- Repositioned the landing hero, introduction, FAQ answer, six search titles/descriptions and social metadata around IQ tests. English targets “free online IQ test”, “30 questions”, “30 minutes”, pattern recognition, logical reasoning and spatial reasoning with natural copy.
- Consolidated repeated landing validity disclaimers into a visible footer notice. The official-test FAQ and purchase/result disclosures remain. This is still an entertainment test, with no claim of validated intelligence measurement.
- Kept the optional paid personal report explicit in the hero and metadata. “Free” describes taking the questions; it does not promise a free report.
- Added normal HTML links to every language, including a clearly labeled English IQ test link. Search engines can follow these without operating a select control. Existing canonical, hreflang and sitemap URLs remain consistent.
- Left scoring, report templates, report translations, report images, payment and email delivery unchanged.

### US / English follow-up after the connected hosting deployment

1. Inspect `/` and `/?lang=en` in Search Console: indexed status, Google-selected canonical, last crawl, live fetch and any excluded-page reason. Submit the existing sitemap and request indexing of the English URL if appropriate. These require owner account access and were not performed by this code change.
2. In Performance, filter Country = United States and Page = `https://mindscope.online/?lang=en`; compare impressions, clicks, CTR and position for “online IQ test” and more specific queries such as “30 question IQ test”. Compare weekly and over 28 days rather than inferring success from a single day.
3. If impressions are zero, investigate discovery/indexing and crawl logs first. If indexed but ranking low, expand useful original English content based on actual queries and earn relevant links. If impressions exist but clicks are low, review the displayed title/snippet. If clicks exist but GA reports none, verify analytics collection.
4. For English-language promotion, use `https://mindscope.online/?lang=en` directly so visitors land in English. A factual introduction is: “Try Mindscope's online IQ test: 30 reasoning questions, 30 minutes, no sign-up. Free to take; personal report sold separately. For entertainment.” No promotional posts, submissions or messages were sent.
5. Technical SEO does not create an audience on its own. Relevant English mentions and useful original content are still needed; no purchased links, fabricated endorsements or guaranteed ranks were added. [Google's SEO guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) explains that changes can take hours to months and do not guarantee results.

References: [crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable), [multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), [traffic diagnosis](https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops).
