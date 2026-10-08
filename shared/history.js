import { z } from 'zod';
import { configSchema } from '../server/config.js';
export const DAYS_30=30*86400000;
const date=z.iso.datetime({offset:true});
const url=z.url().refine(value=>['http:','https:'].includes(new URL(value).protocol),'Only HTTP(S) links are allowed');
const text=z.string().max(30000);
export const jobSchema=z.object({title:text,company:text,url,summary:text.default(''),fitScore:z.number().min(0).max(100).nullable().default(null),keyGaps:z.array(text).max(100).default([]),missingKeywords:z.array(text).max(100).default([]),resumeMatch:text.default('')});
const application=jobSchema.extend({appliedAt:date});
export const reportSchema=z.object({id:z.uuid(),tabId:z.uuid(),createdAt:date,status:z.literal('completed'),results:z.array(jobSchema).max(20),warnings:z.array(text).max(20).default([])});
const tabSchema=z.object({id:z.uuid(),config:configSchema});
export const backupSchema=z.object({version:z.literal(2),tabs:z.array(tabSchema),reports:z.array(reportSchema),applications:z.array(application)}).superRefine((data,ctx)=>{for(const [key,identity] of [['tabs',x=>x.id],['reports',x=>x.id],['applications',x=>x.url]])if(new Set(data[key].map(identity)).size!==data[key].length)ctx.addIssue({code:'custom',path:[key],message:'Duplicate records in backup'});});
export const emptyState=()=>({version:2,tabs:[],reports:[],applications:[]});
export function mergeBackup(current,incoming){const parsed=backupSchema.parse(incoming);const merge=(a,b,key)=>[...a,...b.filter(item=>!a.some(old=>key(old)===key(item)))];return backupSchema.parse({version:2,tabs:merge(current.tabs,parsed.tabs,x=>x.id),reports:merge(current.reports,parsed.reports,x=>x.id),applications:merge(current.applications,parsed.applications,x=>x.url)});}
export function recentHistory(state,tabId,now=Date.now()){const cutoff=now-DAYS_30;return [...state.reports.filter(r=>r.tabId===tabId&&Date.parse(r.createdAt)>cutoff&&Date.parse(r.createdAt)<=now).flatMap(r=>r.results.map(j=>({title:j.title,company:j.company,url:j.url,recordedAt:r.createdAt}))),...state.applications.filter(j=>Date.parse(j.appliedAt)>cutoff&&Date.parse(j.appliedAt)<=now).map(j=>({title:j.title,company:j.company,url:j.url,recordedAt:j.appliedAt}))].sort((a,b)=>Date.parse(a.recordedAt)-Date.parse(b.recordedAt)).slice(-2000);}
export function pruneReports(state,now=Date.now()){return {...state,reports:state.reports.filter(r=>Date.parse(r.createdAt)>now-DAYS_30)};}
export function loadState(storage){
 const raw=storage.getItem('djs.state');if(raw)return backupSchema.parse(JSON.parse(raw));
 const tabs=JSON.parse(storage.getItem('djs.tabs')||'[]').map(t=>({id:t.code,config:t.config}));
 const reports=JSON.parse(storage.getItem('djs.reports')||'[]').map(r=>({id:r.id,tabId:r.code,createdAt:r.created_at,status:'completed',results:r.results,warnings:r.warnings||[]}));
 return backupSchema.parse({version:2,tabs,reports,applications:[]});
}
