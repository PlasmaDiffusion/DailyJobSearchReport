import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { configSchema } from './config.js';
export function createApp(store,run){
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'100kb'}));
 // The generated UUID is a bearer capability: never expose codes in logs or public URLs.
 app.param('code',(req,res,next,code)=>{if(!z.uuid().safeParse(code).success)return res.status(400).json({error:'Invalid search code'});req.params.code=code.toLowerCase();next();});
 app.get('/api/health',(req,res)=>res.json({ok:true}));
 app.post('/api/searches',async(req,res)=>{const config=configSchema.parse(req.body);const code=randomUUID();await store.create(code,config);res.status(201).json({code,config});});
 app.get('/api/searches/:code',async(req,res)=>{const config=await store.get(req.params.code);if(!config)return res.status(404).json({error:'Search not found'});res.json({code:req.params.code,config});});
 app.put('/api/searches/:code',async(req,res)=>{const config=configSchema.parse(req.body);if(!await store.get(req.params.code))return res.status(404).json({error:'Search not found'});await store.update(req.params.code,config);res.json({config});});
 app.delete('/api/searches/:code',async(req,res)=>{await store.delete(req.params.code);res.sendStatus(204);});
 app.get('/api/searches/:code/reports',async(req,res)=>{res.json(await store.reports(req.params.code));});
 app.post('/api/searches/:code/run',async(req,res)=>{res.json(await run(req.params.code,'manual'));});
 app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found'}));
 app.use((err,req,res,next)=>{if(err instanceof z.ZodError)return res.status(400).json({error:'Invalid configuration',details:err.issues});if(err.type==='entity.parse.failed')return res.status(400).json({error:'Invalid JSON'});if(err.type==='entity.too.large')return res.status(413).json({error:'Request too large'});console.error(err.message);res.status(err.status||502).json({error:err.status?err.message:'Search provider or database request failed. Check server configuration.'});});
 return app;
}
