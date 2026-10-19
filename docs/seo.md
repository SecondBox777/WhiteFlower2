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

1. Verify domain ownership in Google Search Console and Naver Search Advisor using the account owner's verification token (DNS or provided HTML tag/file). No account-specific verification token has been supplied or invented.
2. Submit `https://mindscope.online/sitemap.xml` in both consoles and inspect the homepage plus language URLs.
3. Check indexing, crawl errors, search impressions and clicks over time. Check whether Cloudflare security settings allow Googlebot and Naver Yeti; robots.txt cannot override a firewall block.
4. Review actual AI/search referral traffic and citations over time. Technical eligibility cannot guarantee ranking, recommendation or citation. No external promotional messages or account submissions were sent by this change.

## Requested references

- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide?hl=ko): clear titles, helpful content, crawlable links and technical foundations.
- [Naver SEO basics](https://searchadvisor.naver.com/guide/seo-basic-intro): accessible HTML, robots.txt, sitemaps and ownership verification.
- [Google AI search guidance](https://developers.google.com/search/blog/2025/05/succeeding-in-ai-search?hl=ko): useful original content, good page experience, crawler access and structured data matching visible content.
- [Toss Payments GEO article](https://www.tosspayments.com/blog/articles/39461): audience-centered product explanations and organized, question-led content. No fabricated external endorsements or freshness signals were added.
