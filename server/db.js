import pg from 'pg';
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:10000});
export const lockPool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:10000});
export class Store {
 async create(code,config){await pool.query('INSERT INTO searches(code,config) VALUES($1,$2)',[code,config]);}
 async get(code){const {rows}=await pool.query('SELECT config FROM searches WHERE code=$1',[code]);return rows[0]?.config;}
 async update(code,config){await pool.query('UPDATE searches SET config=$2,updated_at=now() WHERE code=$1',[code,config]);}
 async delete(code){await pool.query('DELETE FROM searches WHERE code=$1',[code]);}
 async enabled(){const {rows}=await pool.query("SELECT code FROM searches WHERE config->>'enabled'='true'");return rows.map(r=>r.code);}
 async reports(code){const {rows}=await pool.query('SELECT * FROM reports WHERE code=$1 ORDER BY created_at DESC LIMIT 100',[code]);return rows;}
 async recent(code){const {rows}=await pool.query("SELECT results FROM reports WHERE code=$1 AND status='completed' AND created_at >= now()-interval '30 days'",[code]);return rows.flatMap(r=>r.results);}
 async start(id,code,source){await pool.query("INSERT INTO reports(id,code,source,status) VALUES($1,$2,$3,'running')",[id,code,source]);}
 async finish(id,results,warnings){await pool.query("UPDATE reports SET status='completed',results=$2,warnings=$3,finished_at=now() WHERE id=$1",[id,JSON.stringify(results),JSON.stringify(warnings)]);}
 async fail(id){await pool.query("UPDATE reports SET status='failed',error='Search provider or database request failed. Check server logs.',finished_at=now() WHERE id=$1",[id]);}
 async locked(code,fn){
 const client=await lockPool.connect();let locked=false;
 try {const {rows}=await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',[code]);locked=rows[0].locked;if(!locked){const e=new Error('A search is already running');e.status=409;throw e;}return await fn();}
 finally {try{if(locked)await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[code]);}finally{client.release();}}
 }
}
