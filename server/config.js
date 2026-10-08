import { z } from 'zod';
const terms=z.array(z.string().trim().min(1).max(120)).max(20).default([]);
export const configSchema=z.object({
 title:z.string().trim().min(1).max(100),mode:z.enum(['jobs','news']).default('jobs'),
 companies:terms,roles:terms,skills:terms,locations:terms,
 strictCompany:z.boolean().default(false),strictRole:z.boolean().default(false),strictSkills:z.boolean().default(false),
 resume:z.string().max(30000).default(''),prompt:z.string().max(3000).default(''),
 limit:z.number().int().min(1).max(20).default(10)
}).superRefine((c,ctx)=>{if(c.mode==='news'&&!c.prompt.trim())ctx.addIssue({code:'custom',path:['prompt'],message:'Enter a news search prompt'});if(c.mode==='jobs'&&!c.roles.length&&!c.companies.length)ctx.addIssue({code:'custom',path:['roles'],message:'Enter at least one role or company'});});
export const normalize=s=>s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const pairKey=r=>normalize(r.company)+'|'+normalize(r.title);
export function strictMatch(c,r,text){
 const has=(items)=>items.some(x=>normalize(text).includes(normalize(x)));
 return (!c.strictCompany||!c.companies.length||has(c.companies))&&(!c.strictRole||!c.roles.length||has(c.roles))&&(!c.strictSkills||c.skills.every(x=>normalize(text).includes(normalize(x))));
}
export function queryFor(c){
 if(c.mode==='news')return c.prompt;
 const group=xs=>xs.length?'('+xs.map(x=>'"'+x.replaceAll('"','')+'"').join(' OR ')+')':'';
 return ['(site:greenhouse.io OR site:lever.co OR site:myworkdayjobs.com OR site:workday.com)',group(c.companies),group(c.roles),group(c.locations),...c.skills].filter(Boolean).join(' ');
}
