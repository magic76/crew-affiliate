import {checkIdentity} from './live-catalog.mjs';
import {makeBrief,validateDraft} from './editorial-draft.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'}});
const assert=(ok)=>{if(!ok)throw Error('Invalid private input');};
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const count=v=>Number.isSafeInteger(v)&&v>=0;
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const text=(v,n)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
export function validateGsc(v){
 assert(v?.version===1&&v.property==='sc-domain:hicrewapps.com'&&day(v.period?.start)&&day(v.period?.end)&&v.period.start<=v.period.end&&Date.parse(v.period.end)-Date.parse(v.period.start)<=30*86400000);
 const metric=r=>{assert(r&&count(r.clicks)&&count(r.impressions)&&finite(r.position));return {clicks:r.clicks,impressions:r.impressions,position:r.position};};
 assert(Array.isArray(v.daily)&&v.daily.length<=31&&Array.isArray(v.opportunities)&&v.opportunities.length<=20);
 const seen=new Set();
 const daily=v.daily.map(r=>{assert(day(r.date)&&r.date>=v.period.start&&r.date<=v.period.end&&!seen.has(r.date));seen.add(r.date);return {date:r.date,...metric(r)};});
 const opportunities=v.opportunities.map(r=>{assert(text(r.query,512));return {query:r.query,...metric(r)};});
 assert(typeof v.possiblyTruncated==='boolean');
 return {version:1,property:v.property,period:{start:v.period.start,end:v.period.end},total:v.total===null?null:metric(v.total),daily,opportunities,possiblyTruncated:v.possiblyTruncated};
}
export function validatePrivateDraft(v){
 const brief=makeBrief({...v?.brief?.topic,status:'candidate'},v?.brief?.evidence);
 const draft=validateDraft(v.raw,brief);
 return {version:1,brief,draft};
}
export async function privateIngest(request,env,purpose,{verify=t=>checkIdentity(t,{purpose})}={}){
 const allowed={gsc:{key:'private-gsc-v1',validate:validateGsc},draft:{key:'private-editorial-draft-v1',validate:validatePrivateDraft}};
 const conf=allowed[purpose];
 if(!conf||new URL(request.url).origin!=='https://hicrewapps.com')return json({error:'not found'},404);
 if(request.method==='HEAD')return new Response(null,{status:env.CATALOG_KV&&env.CATALOG_PUBLISH_ENABLED==='1'?204:503,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
 if(request.method!=='POST')return json({error:'not found'},404);
 if(!env.CATALOG_KV||env.CATALOG_PUBLISH_ENABLED!=='1')return json({error:'disabled'},503);
 const auth=request.headers.get('Authorization')??'';
 if(!auth.startsWith('Bearer ')||await verify(auth.slice(7))!=='ok')return json({error:'unauthorized'},401);
 let value;
 try{
  assert(request.headers.get('Content-Type')?.split(';')[0]==='application/json');
  const reader=request.body?.getReader();assert(reader);let n=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;n+=value.byteLength;if(n>128*1024){await reader.cancel();throw Error('Too large');}chunks.push(value);}
  const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  value=conf.validate(JSON.parse(new TextDecoder().decode(bytes)));
 }catch{return json({error:'invalid input'},400);}
 try{await env.CATALOG_KV.put(conf.key,JSON.stringify({...value,collectedAt:new Date().toISOString()}),{expirationTtl:7*86400});return json({ok:true});}catch{return json({error:'storage'},503);}
}
