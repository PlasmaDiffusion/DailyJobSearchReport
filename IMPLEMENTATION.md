# Implementation guide

This short map points to the main parts of the codebase and its verification commands.

The current architecture, setup, manual streaming API, local job/application history, and JSON backup format are documented in [readme.md](readme.md).

- Backend entry point: `server/index.ts`.
- Streaming endpoint: `server/app.ts`.
- Stateless search pipeline: `server/runner.ts`.
- Provider adapters: `server/providers.ts`.
- Local-data and backup validation: `shared/history.ts`.
- Frontend stream reader: `client/search.ts`.
- React interface: `client/main.tsx`.

The application and tests use TypeScript. Use `npm run typecheck`, `npm test`, and `npm run build` to verify changes.
