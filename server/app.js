import express from 'express';
import { z } from 'zod';
import { requestSchema } from './runner.js';
export function createApp(run){
 const app=express();app.disable('x-powered-by');app.use(express.json({limit:'2mb'}));
 app.get('/api/health',(req,res)=>res.json({ok:true}));
 app.post('/api/search',async(req,res)=>{
 const input=requestSchema.parse(req.body);
 const controller=new AbortController();const abort=()=>{if(!res.writableEnded)controller.abort();};res.on('close',abort);
 res.set({'Content-Type':'application/x-ndjson','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'});res.flushHeaders();
 const emit=event=>{if(!res.destroyed)res.write(JSON.stringify(event)+'\n');};
 const heartbeat=setInterval(()=>emit({type:'heartbeat'}),15000);heartbeat.unref();
 try{const report=await run(input,emit,controller.signal);emit({type:'complete',report});}
 catch(e){if(!controller.signal.aborted){console.error('Search failed:',e.message);emit({type:'error',message:'Search failed. Check provider credentials and try again.'});}}
 finally{clearInterval(heartbeat);res.off('close',abort);res.end();}
 });
 app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found'}));
 app.use((err,req,res,next)=>{if(err instanceof z.ZodError)return res.status(400).json({error:'Invalid search request',details:err.issues});if(err.type==='entity.parse.failed')return res.status(400).json({error:'Invalid JSON'});if(err.type==='entity.too.large')return res.status(413).json({error:'Request too large'});console.error(err.message);res.status(500).json({error:'Request failed'});});
 return app;
}
