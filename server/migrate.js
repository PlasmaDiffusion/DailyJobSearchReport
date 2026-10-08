import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { pool } from './db.js';
try {await pool.query(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));console.log('Database schema ready');}finally{await pool.end();}
