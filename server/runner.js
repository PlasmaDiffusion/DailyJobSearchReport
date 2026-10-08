import { randomUUID } from 'node:crypto';
import { pairKey,strictMatch } from './config.js';
export function makeRunner(store,providers){
 return (code,source='manual')=>store.locked(code,async()=>{
 const c=await store.get(code);if(!c){const e=new Error('Search not found');e.status=404;throw e;}
 const id=randomUUID();await store.start(id,code,source);
 try {
 const recent=await store.recent(code),urls=new Set(recent.map(r=>r.url)),pairs=new Set(recent.map(pairKey)),results=[],warnings=[];
 const candidates=await providers.search(c);
 for(const item of candidates.slice(0,c.limit)){
 let u;try{u=new URL(item.url);}catch{continue;}if(!['http:','https:'].includes(u.protocol)||urls.has(item.url))continue;
 let text=item.snippet;
 try{text=(await providers.scrape(item.url))||text;}catch{warnings.push(`Could not scrape ${item.url}; evaluated its search snippet.`);}
 const result={...await providers.evaluate(c,item,text),url:item.url};
 if(c.mode==='jobs'&&(!strictMatch(c,result,[result.title,result.company,text].join(' '))||pairs.has(pairKey(result))))continue;
 results.push(result);urls.add(result.url);pairs.add(pairKey(result));
 }
 await store.finish(id,results,warnings);return {id,code,source,status:'completed',results,warnings};
 }catch(e){await store.fail(id);throw e;}
 });
}
export async function runScheduled(store,run){
 for(const code of await store.enabled()){try{await run(code,'cron');}catch(e){console.error('Scheduled search failed',code,e.message);}}
}
