import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pairKey,strictMatch,configSchema } from './config.js';
export const requestSchema=z.object({tabId:z.uuid(),config:configSchema,history:z.array(z.object({title:z.string().max(30000),company:z.string().max(30000),url:z.url().max(4000),recordedAt:z.iso.datetime({offset:true})})).max(2000).default([])});
export function makeRunner(providers){
 return async({tabId,config:c,history},emit=()=>{},signal)=>{
 const checkpoint=()=>signal?.throwIfAborted();checkpoint();
 const recent=history.filter(r=>Date.parse(r.recordedAt)>Date.now()-30*86400000&&Date.parse(r.recordedAt)<=Date.now());
 const urls=new Set(recent.map(r=>r.url)),pairs=new Set(recent.map(pairKey)),results=[],warnings=[];
 emit({type:'progress',stage:'searching',message:`Searching with ${process.env.SEARCH_PROVIDER==='firecrawl'?'Firecrawl':'SerpApi'}…`});
 const candidates=await providers.search(c,signal);checkpoint();
 const items=candidates.slice(0,c.limit);
 for(const [index,item] of items.entries()){
 checkpoint();let u;try{u=new URL(item.url);}catch{continue;}if(!['http:','https:'].includes(u.protocol)||urls.has(item.url))continue;
 let text=item.snippet;
 emit({type:'progress',stage:'scraping',message:process.env.FIRECRAWL_API_KEY?'Reading postings with Firecrawl…':'Using search snippets (Firecrawl is not configured)…',current:index+1,total:items.length});
 try{text=(await providers.scrape(item.url,signal))||text;}catch{checkpoint();warnings.push(`Could not scrape ${item.url}; evaluated its search snippet.`);}
 checkpoint();emit({type:'progress',stage:'generating',message:'Generating your report with OpenAI…',current:index+1,total:items.length});
 const result={...await providers.evaluate(c,item,text,signal),url:item.url};checkpoint();
 if(c.mode==='jobs'&&(!strictMatch(c,result,[result.title,result.company,text].join(' '))||pairs.has(pairKey(result))))continue;
 results.push(result);urls.add(result.url);pairs.add(pairKey(result));
 }
 checkpoint();return {id:randomUUID(),tabId,createdAt:new Date().toISOString(),status:'completed',results,warnings};
 };
}
