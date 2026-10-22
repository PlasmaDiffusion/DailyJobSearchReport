# Daily Job Search Report

This guide explains the app's behavior, setup, API, and local data handling.

A personal job-search and tech-news app built with TypeScript, React, React Router, Tailwind CSS, and a Node.js/Express backend. Search manually when you are ready. All persistent user data lives in the browser's local storage; the interface runs one search at a time and the backend retains no user records.

## How it works

1. Create a search tab and save its criteria locally.
2. Click **Search now**. The browser sends the criteria, resume (for job evaluation), and recent shown/applied job history to the backend.
3. **SerpApi** searches for posting links and snippets. Your resume is not sent to the search provider.
4. **Firecrawl** optionally reads full posting text. If unavailable or a scrape fails, the backend uses the search snippet instead.
5. **OpenAI** evaluates job fit, gaps, ATS keywords, and resume matches, or summarizes news/articles.
6. The backend streams progress updates and the completed report through the same request. The browser saves the completed report locally.

Progress messages include **Searching with SerpApi…**, **Reading postings with Firecrawl…**, and **Generating your report with OpenAI…**, with per-candidate progress counts. Scraping and evaluation alternate as each candidate is processed. The UI also provides **Cancel search**; cancellation or closing the connection stops further provider work. Provider work already completed may still incur charges.

## Search tabs

Each tab has a locally generated immutable UUID and a user-chosen title. It stores:

- Job mode or tech-news/article mode.
- Target companies, job titles, skills, and locations.
- Strict flags requiring any listed company, any listed title, or all listed skills.
- Resume text for job mode, or a freeform prompt for news mode.
- A candidate limit from **1 to 20**.

Locations guide the query; they are not a strict filter. Candidate limits bound provider work. Duplicate removal and strict filters may return fewer accepted results. Save settings before switching tabs; unsaved edits are drafts.

## Shown jobs and application history

These are separate records:

- **Shown jobs:** results in saved reports for the current tab.
- **Applied jobs:** jobs explicitly marked using **Mark as applied**, with an application timestamp. Finding a job does not count as applying. Use **Applied — undo** or **Undo applied** to correct a record.

Each search sends shown jobs from its tab and applied jobs across all tabs from the preceding **30 days**. The backend excludes matching URLs and normalized job-title/company pairs, including duplicates within the new report. History older than 30 days does not exclude a posting. News mode excludes repeated URLs only.

Known URLs are skipped before scraping. Title/company pair checks happen after OpenAI extracts those fields, so a duplicate on a different URL can still incur evaluation costs. History sent per request is bounded to the most recent 2,000 records.

## Local storage and JSON export/import

Tabs, resumes, completed reports, and application history are stored locally under `djs.state`. The storage indicator estimates UTF-16 bytes used by this origin's local storage, not the browser's total available quota.

- **Export JSON** downloads `daily-job-search-backup.json`, a versioned backup containing **all tabs, resumes, reports, and application history**.
- **Import JSON** validates a backup before merging it. Existing tab/report IDs and applied-job URLs are kept; missing records are added. Import does not overwrite existing records.
- Invalid files, unsafe posting links, unsupported backup versions, and files larger than 5 MB are rejected without importing any records.
- **Delete reports 30+ days old** opens a confirmation dialog and removes only reports at least 30 days old. Tabs and application history are kept.
- Deleting a tab removes its reports after confirmation, while keeping application history.
- If storage fills during a search, the completed report stays visible in memory and is included in Export JSON. Export it before leaving that tab or starting another search.

Browser storage does not sync across devices and can be erased by clearing site data. Export/import provides backup and transfer between browsers. Backups contain resume text and should be kept private.

Existing locally stored tabs and locally saved reports from the previous app version are read on first load. Records that existed only on the old server are not automatically recovered. Previous report-only JSON exports are not version-2 full backups.

## Setup

Use **Node.js 24**. The application, tests, and Vite configuration are written in TypeScript. `tsx` runs the backend and tests, while Vite compiles the browser client.

```sh
npm ci
cp .env.example .env
# Fill in your server-side API keys.
npm run dev
```

Development UI: http://localhost:5173. Express: http://localhost:3001. Vite proxies `/api` requests to Express.

For production:

```sh
npm run build
npm start
```

Express serves the built interface and API from the same origin. No database connection, migration command, or scheduled task is required.

Run `npm run typecheck` to check TypeScript without creating a build.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SERPAPI_API_KEY` | Required for default SerpApi search |
| `SEARCH_PROVIDER` | `serpapi` by default; optionally `firecrawl` |
| `FIRECRAWL_API_KEY` | Enables full-page scraping; also required if choosing Firecrawl search |
| `OPENAI_API_KEY` | Required for evaluations and article summaries |
| `OPENAI_MODEL` | Defaults to `gpt-4o-mini`; must support strict structured outputs |
| `PORT` | Express port; defaults to 3001 |

Obtain a SerpApi key from its [dashboard](https://serpapi.com/manage-api-key). Search uses its [Google organic results API](https://serpapi.com/search-api), including zero-based pagination, capped to at most two search requests and 20 candidates. General news prompts use ordinary web search so articles and news can both appear. Firecrawl remains an optional alternate search provider.

API keys remain on the backend in `.env`; they are never included in local storage or JSON backups. Resume text goes to OpenAI for job-mode evaluation, not to SerpApi or Firecrawl. The backend retains request data only during execution and does not save resumes or reports. External providers have their own retention policies. Keep `.env` out of source control. Restrict access and usage at the hosting layer before exposing paid-provider searches publicly.

## Backend streaming API

`POST /api/search` accepts:

```json
{
  "tabId": "159f4603-eaee-47c4-bd9a-a43308e80545",
  "config": {
    "title": "Software roles",
    "mode": "jobs",
    "roles": ["Software Engineer"],
    "companies": ["Acme"],
    "locations": ["Toronto"],
    "skills": ["TypeScript"],
    "resume": "Your resume text",
    "limit": 10
  },
  "history": [
    {
      "title": "Software Engineer",
      "company": "Acme",
      "url": "https://example.com/jobs/123",
      "recordedAt": "2026-10-07T12:00:00Z"
    }
  ]
}
```

The response is newline-delimited JSON (`application/x-ndjson`):

```json
{"type":"progress","stage":"searching","message":"Searching with SerpApi…"}
{"type":"progress","stage":"scraping","message":"Reading postings with Firecrawl…","current":1,"total":10}
{"type":"progress","stage":"generating","message":"Generating your report with OpenAI…","current":1,"total":10}
```

The final line is a `complete` event with a `report` containing `id`, `tabId`, `createdAt`, `status`, `results`, and `warnings`. A failed search emits an `error` event and saves no partial report. Invalid request bodies receive an HTTP error before streaming starts. Heartbeat events keep idle streams active; the frontend ignores them.

Provider calls have a 45-second timeout each. Configure hosting/proxy timeouts for long searches, and disable response buffering/compression that delays streamed progress. A disconnected search cannot be resumed or fetched later because the backend does not retain it. `GET /api/health` checks process health only.

## Verification

```sh
npm test
npm run build
```

Tests cover streaming progress before completion, request validation, client chunk decoding and error handling, cancellation, recent duplicate filtering, strict matching, provider fallback/error handling, SerpApi pagination, separate shown/applied histories, backup validation/merging, pruning, and legacy local-data migration. Provider calls are mocked; live searches need your API credentials. GitHub Actions runs tests and the production build on pushes and pull requests.
