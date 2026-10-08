# Daily Job Search Report

This branch implements the proposal in `readme.md`: a React/React Router/Tailwind interface and an Express backend with PostgreSQL/Neon persistence. The original proposal and notes are preserved.

## Setup

Use Node.js 24 and a PostgreSQL connection string (Neon is supported).

```sh
npm ci
cp .env.example .env
# Fill in DATABASE_URL and provider credentials in .env.
npm run db:migrate
npm run dev
```

The development interface is at http://localhost:5173; Express runs on port 3001. Vite proxies API requests to Express. For a production process:

```sh
npm run build
npm start
```

Express serves the built interface and API from the same origin. Database migration is idempotent and must run before startup. Keep `.env` out of source control.

### Providers

- `SEARCH_PROVIDER=google`: requires `GOOGLE_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID`. Google Custom Search JSON API is closed to new customers and ends January 1, 2027 for existing customers; see [Google's notice](https://developers.google.com/custom-search/v1/overview). Use this only with an existing eligible account.
- `SEARCH_PROVIDER=firecrawl`: uses `FIRECRAWL_API_KEY` for web search instead, without Google credentials. Search credits and scrape credits are billed separately; the old cost estimates in `firecrawlNotes.txt` are historical, not validated pricing.
- `OPENAI_API_KEY` is required for evaluation. `OPENAI_MODEL` defaults to `gpt-4o-mini`; choose a model that supports strict structured outputs.
- `FIRECRAWL_API_KEY` optionally enables full-page scraping with either search provider. Without it, evaluation uses search snippets. Scrape failures produce a report warning and fall back to snippets. Search/evaluation failures mark the run failed without saving partial results.

The Google search request contains criteria but never the resume. Resume text is sent to OpenAI, stored in PostgreSQL, and retained in browser tab settings. News mode does not send the resume to OpenAI. Provider calls have a 45-second timeout each.

## Scheduled and manual execution

Both triggers call `makeRunner` in `server/runner.js`; there is no separate copy of the search logic.

The in-process scheduler runs enabled tabs at **02:00 America/Toronto** by default. Configure `CRON_TIMEZONE` and set `CRON_ENABLED=false` to disable it. Run one always-on scheduler instance; sleeping/serverless hosts will not execute this scheduler, and missed runs are not replayed. Additional API replicas should disable their schedulers. A dedicated PostgreSQL connection pool holds per-code advisory locks, preventing concurrent manual and scheduled runs from racing. Locks release on failure and database connection termination.

The manual endpoint is an ordinary backend HTTP request:

```sh
curl -X POST http://localhost:3001/api/searches/YOUR_GENERATED_CODE/run
```

It runs synchronously and returns the completed report as JSON. Configure reverse-proxy request timeouts for long searches (20 candidates can involve 40 sequential provider calls). If the client times out, retrieve reports to check the outcome before retrying. This implementation has no durable background queue; process termination can leave a report marked `running`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/searches` | Create configuration; server generates an immutable UUID code |
| GET | `/api/searches/:code` | Restore configuration |
| PUT | `/api/searches/:code` | Update configuration |
| DELETE | `/api/searches/:code` | Delete configuration and its backend reports |
| POST | `/api/searches/:code/run` | Run the same pipeline used by cron |
| GET | `/api/searches/:code/reports` | Fetch the latest 100 reports, including status |
| GET | `/api/health` | Process health (does not check providers or DB) |

Example creation:

```sh
curl http://localhost:3001/api/searches -H 'Content-Type: application/json' -d '{"title":"Software roles","roles":["Software Engineer"],"companies":["Acme"],"locations":["Toronto"],"skills":["TypeScript"],"resume":"Your resume text","limit":10,"enabled":true}'
```

Configuration supports `mode` (`jobs` or `news`), `prompt` (required in news mode), `strictCompany`, `strictRole`, and `strictSkills`. The result limit is validated from 1 to 20. Search candidates are bounded to that limit, so filters can yield fewer accepted results. Strict company/title matching requires at least one listed term; strict skills requires every listed skill. Matching uses normalized text from the extracted title/company and page or snippet. Location is a query criterion, not a strict filter.

Completed reports from the preceding 30 days prevent repeated URLs and normalized title/company combinations within the same code. News mode deduplicates URLs only. OpenAI extracts title/company before pair deduplication, so alternative URLs can still incur evaluation costs. No cross-user cache or raw HTML fallback is implemented.

## Browser behavior

- Tabs are saved automatically to local storage after the backend creates the search code. Unsaved drafts are not retained.
- “Run search now” saves the current criteria and calls the manual endpoint.
- “Restore tab” loads an existing code from the backend.
- Reports appear with timestamps, source, status, summaries, fit scores, gaps, keywords, and original links.
- “Save report locally” keeps a report for offline inspection. Export produces a JSON download.
- A confirmation dialog removes locally saved reports created 30 or more days ago. It does not remove backend reports or tabs.
- Storage usage estimates UTF-16 bytes across this origin's local storage; it is not a browser quota measurement.

The generated code is a bearer capability: anyone possessing it can read the resume/configuration, run searches, update criteria, and delete the search. Keep it private. This is a personal app foundation rather than an account-based multi-user service. Before making a paid-provider deployment publicly accessible, restrict registration/access and enforce usage limits at the hosting layer. Local report copies must be deleted separately from backend searches.

## Validation

```sh
npm test
npm run build
```

Tests exercise the manual HTTP endpoint and scheduled trigger, persistence calls, 30-day duplicate filtering, strict matching, snippet fallback, overlapping runs, failures, configuration bounds, Google pagination, Firecrawl v2 search mapping, and structured evaluation validation. Provider calls use mocks and persistence uses a test store; live Neon/provider integration requires your credentials. GitHub Actions runs these tests and the production build on pushes and pull requests.
