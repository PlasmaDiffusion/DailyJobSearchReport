/** Starts Express, serves the built client, and closes cleanly on shutdown. */
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { providers } from './providers.js';
import { makeRunner } from './runner.js';
import { createApp } from './app.js';

const app = createApp(makeRunner(providers));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));

app.use(express.static(dist));
app.get('/{*path}', (req, res) => res.sendFile(`${dist}index.html`));

const server = app.listen(process.env.PORT || 3001, () => {
  console.log('Daily Job Search Report server ready');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
