# Implementation guide

This short map points to the main parts of the codebase and its verification commands.

The current architecture, setup, manual streaming API, local job/application history, and JSON backup format are documented in [readme.md](readme.md).

- Backend entry point: `server/index.js`.
- Streaming endpoint: `server/app.js`.
- Stateless search pipeline: `server/runner.js`.
- Provider adapters: `server/providers.js`.
- Local-data and backup validation: `shared/history.js`.
- Frontend stream reader: `client/search.js`.
- React interface: `client/main.jsx`.

Use `npm test` and `npm run build` to verify changes.
