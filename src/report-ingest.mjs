import {checkIdentity} from './live-catalog.mjs';
import {validateCoupangReport} from './coupang-report.mjs';
export const REPORT_KEY='private-coupang-report-v1';
const json=(body,status)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'}});
export async function ingestReport(request,env,{verify=t=>checkIdentity(t,{purpose:'report'})}={}){
 if(new URL(request.url).origin==='https://hicrewapps.com'&&request.method==='HEAD')return new Response(null,{status:env.CATALOG_KV&&env.CATALOG_PUBLISH_ENABLED==='1'?204:503,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
 if(new URL(request.url).origin!=='https://hicrewapps.com'||request.method!=='POST')return json({error:'not found'},404);
 const auth=request.headers.get('Authorization')??'';
 if(!auth.startsWith('Bearer ')||await verify(auth.slice(7))!=='ok')return json({error:'unauthorized'},401);
 if(!env.CATALOG_KV||env.CATALOG_PUBLISH_ENABLED!=='1')return json({error:'disabled'},503);
 let report;
 try{
  if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw Error('Content type');
  const reader=request.body?.getReader();if(!reader)throw Error('Missing body');
  let n=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;n+=value.byteLength;if(n>128*1024){await reader.cancel();throw Error('Too large');}chunks.push(value);}
  const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  report=validateCoupangReport(JSON.parse(new TextDecoder().decode(bytes)));
 }catch{return json({error:'invalid report'},400);}
 try{
  const stored=JSON.stringify({...report,collectedAt:new Date().toISOString()});
  await env.CATALOG_KV.put(REPORT_KEY,stored,{expirationTtl:7*86400});
  return json({ok:true},200);
 }catch{return json({error:'storage'},503);}
}
