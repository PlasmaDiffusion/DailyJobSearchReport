import { reportSchema } from '../shared/history.js';
export async function search(input,onProgress,signal){
 const response=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal});
 if(!response.ok){const error=await response.json();throw new Error(error.details?.map(x=>x.message).join('; ')||error.error||'Search request failed');}
 if(!response.body)throw new Error('Streaming is unavailable');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',report;
 const consume=line=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==='error')throw new Error(event.message);if(event.type==='progress')onProgress(event);if(event.type==='complete')report=reportSchema.parse(event.report);};
 try{while(true){const {value,done}=await reader.read();buffer+=decoder.decode(value,{stream:!done});let end;while((end=buffer.indexOf('\n'))!==-1){consume(buffer.slice(0,end));buffer=buffer.slice(end+1);}if(done)break;}consume(buffer);if(!report)throw new Error('Search connection ended before the report was complete');return report;}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
