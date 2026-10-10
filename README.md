# Pulse Atlas

Pulse Atlas is an interactive geospatial news intelligence application built for the SerpApi India Hackathon 2026. It turns live search results into event clusters that can be explored on a 3D globe, as an attention heatmap, or in a story list.

**Live demo:** [pulse-atlas-news.yashnkotian300748983.chatgpt.site](https://pulse-atlas-news.yashnkotian300748983.chatgpt.site)

## Why it exists

News feeds show many headlines but often hide geographic context and repeat the same event across publishers. Pulse Atlas identifies where an event happened, groups related coverage, and separates the reported event impact from the article's writing tone.

## Features

- Search any topic, person, event, organization, or place
- Country-specific Google News editions and a combined worldwide view
- One-day, seven-day, and 30-day search windows
- Positive, neutral, and negative event-impact filters
- Topic and subcategory filters
- Interactive orthographic globe with country borders and zoom controls
- Event-marker, attention-heatmap, and list views
- Separate event-impact and article-tone classifications with confidence scores
- Event clustering by headline similarity, publication time, geography, and publisher
- Browser-detected country selection without sending precise coordinates to SerpApi
- Email-and-password accounts used only for stable saved-story snapshots
- Responsive landing page and dashboard

## SerpApi integration

Pulse Atlas calls SerpApi only from its server routes, so `SERPAPI_KEY` is never included in client JavaScript.

- **Google News API** (`engine=google_news`) supplies headlines, snippets, publishers, timestamps, source links, and related stories.
- **Google Maps API** (`engine=google_maps`) verifies extracted event locations and supplies map coordinates.

The backend processes up to 80 articles per refresh and performs at most 10 new Maps lookups. Location results are deduplicated and stored in memory and Cloudflare D1. Identical news requests are cached for five minutes.

## Architecture

```text
Browser search and filters
          |
          v
GET /api/news -- five-minute response cache -- D1 request limiter
          |
          v
SerpApi Google News
          |
          v
normalize -> classify topic, tone, and impact -> extract place candidates
          |
          v
SerpApi Google Maps -> coordinate cache -> event clustering
          |
          v
3D globe / heatmap / list -> authenticated D1 bookmark snapshots
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the detailed request flow, data model, caching, security controls, and classification approach.

## Local development

Requirements:

- Node.js 22.13 or newer
- A SerpApi account and API key for live results

```bash
git clone https://github.com/yking-ly/PulseAtlas.git
cd PulseAtlas
npm install
```

Copy `.env.example` to `.env.local` and add your key:

```text
SERPAPI_KEY=your_serpapi_key
```

Start the development server:

```bash
npm run dev
```

Without a SerpApi key, the interface loads a clearly labelled preview dataset. Account storage and persistent bookmarks require the Cloudflare D1 binding declared in `.openai/hosting.json`.

## Validation

```bash
npm test
npm run lint
npm run build
```

## Public-traffic controls

- Identical successful news responses are cached for five minutes.
- News searches are limited to 12 cache misses per five minutes per client.
- Sign-in is limited to 20 attempts per 15 minutes per client, in addition to per-account lockout.
- Account creation is limited to five attempts per hour per client.
- Client identifiers are SHA-256 hashed before they are stored in the rate-limit table.
- Expired rate-limit records are removed automatically.

## Privacy and provenance

Browser coordinates are converted into a country locally. Only the chosen country edition is sent with a news request. Browsing does not require an account. Saved stories store a stable JSON snapshot under the authenticated user ID.

Headlines, publishers, times, snippets, and source links come from SerpApi results. Pulse Atlas adds location verification, clustering, topic classification, event impact, article tone, and confidence indicators.

## AI disclosure

Development used OpenAI ChatGPT and Codex for planning, implementation, debugging, testing, accessibility work, and documentation. The production application does not call a generative-AI service or generate news content. See [AI_DISCLOSURE.md](./AI_DISCLOSURE.md) for the complete disclosure.
