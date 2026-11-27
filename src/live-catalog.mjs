import {indexable,canonicalPath} from './seo.mjs';
import {validateCatalog} from './catalog-model.mjs';
import {render} from './render.mjs';
export const KEY='catalog-v1';
export const HOST='hicrewapps.com';
export const AUDIENCE='https://hicrewapps.com/api/catalog';
const ISSUER='https://token.actions.githubusercontent.com';
const WORKFLOW='magic76/crew-affiliate/.github/workflows/catalog-publish.yml@refs/heads/main';
const REPO_ID='1472854687';
const MAX_BYTES=512*1024;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
const enabled=env=>env.CATALOG_PUBLISH_ENABLED==='1'&&!!env.CATALOG_KV;
const bytes=s=>{
  if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Invalid token');
  return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
};
const parse=s=>JSON.parse(new TextDecoder().decode(bytes(s)));
const numericDate=value=>Number.isSafeInteger(value)?value:(typeof value==='string'&&/^\d{1,12}$/.test(value)?Number(value):null);
export async function checkIdentity(token,{fetchImpl=fetch,now=Date.now()}={}){
  let stage='format';
  try{
    if(typeof token!=='string'||token.length>16000)return stage;
    const parts=token.split('.');
    if(parts.length!==3)return stage;
    const [h,p,s]=parts,header=parse(h),claims=parse(p);
    const seconds=Math.floor(now/1000);
    if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid.length||header.kid.length>200)return stage;
    stage='claims';
    if(claims.iss!==ISSUER||claims.aud!==AUDIENCE||claims.repository!=='magic76/crew-affiliate'||String(claims.repository_id)!==REPO_ID||claims.ref!=='refs/heads/main'||claims.workflow_ref!==WORKFLOW||(typeof claims.sub!=='string'||!claims.sub.length)||!['push','schedule','workflow_dispatch'].includes(claims.event_name))return stage;
    stage='time';
    const exp=numericDate(claims.exp),iat=numericDate(claims.iat),nbf=claims.nbf===undefined?iat:numericDate(claims.nbf);
    // Reject expired, future and old tokens even if GitHub issues a longer-lived credential.
    if(exp===null||iat===null||nbf===null||exp<=seconds||exp<=iat||nbf>seconds+30||iat>seconds+30||seconds-iat>600)return stage;
    stage='jwks';
    // Workers does not implement redirect:'error'; manual + exact HTTP 200 rejects redirects safely.
    const res=await fetchImpl(ISSUER+'/.well-known/jwks',{redirect:'manual',signal:AbortSignal.timeout(10000)});
    if(res.status!==200)return stage;
    const jwks=await res.json();
    stage='key';
    const key=jwks.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));
    if(!key)return stage;
    const pub=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    stage='signature';
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pub,bytes(s),new TextEncoder().encode(h+'.'+p))?'ok':stage;
  }catch{return stage;}
}
export async function authorize(token,opts){return await checkIdentity(token,opts)==='ok';}
export async function readCatalog(env){
  if(!enabled(env))return null;
  try{
    const raw=await env.CATALOG_KV.get(KEY);
    return raw?validateCatalog(JSON.parse(raw)):null;
  }catch{return null;}
}
async function readBody(request){
  const reader=request.body?.getReader();
  if(!reader)throw Error('Missing body');
  const chunks=[];let size=0;
  while(true){
    const {value,done}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>MAX_BYTES){await reader.cancel();throw Error('Too large');}
    chunks.push(value);
  }
  const out=new Uint8Array(size);let offset=0;
  for(const c of chunks){out.set(c,offset);offset+=c.byteLength;}
  return JSON.parse(new TextDecoder().decode(out));
}
export async function catalogApi(request,env,{verify=checkIdentity}={}){
  if(new URL(request.url).hostname!==HOST)return json({enabled:false},404);
  if(request.method==='GET'){
    const current=await readCatalog(env);
    return json({protocol:4,enabled:enabled(env),ready:!!current,...(current?{fetchedAt:current.fetchedAt,deals:current.deals.length,categories:current.categories.length,guideMatches:Object.fromEntries(Object.entries(current.guides).map(([k,v])=>[k,v.length]))}:{})});
  }
  if(request.method!=='POST')return json({error:'method'},405);
  if(!enabled(env))return json({error:'disabled'},503);
  const auth=request.headers.get('Authorization')||'';
  const check=auth.startsWith('Bearer ')?await verify(auth.slice(7)):'format';
  if(check!==true&&check!=='ok')return json({error:'unauthorized',check:['format','claims','time','jwks','key','signature'].includes(check)?check:'invalid'},401);
  let snapshot;
  try{
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('Content type');
    snapshot=validateCatalog(await readBody(request));
    if(Date.now()-Date.parse(snapshot.fetchedAt)>5*60*1000)throw Error('Stale upload');
  }catch{return json({error:'invalid catalog'},400);}
  try{
    const old=await readCatalog(env);
    if(old&&Date.parse(old.fetchedAt)>=Date.parse(snapshot.fetchedAt))return json({ok:true,unchanged:true});
    const ttl=Math.floor((Date.parse(snapshot.fetchedAt)+3600000-Date.now())/1000);
    if(ttl<60)return json({error:'expired'},400);
    await env.CATALOG_KV.put(KEY,JSON.stringify(snapshot),{expirationTtl:ttl});
    return json({ok:true,deals:snapshot.deals.length,categories:snapshot.categories.length});
  }catch{return json({error:'storage unavailable'},503);}
}
function route(path){
  if(path==='/'||path==='/index.html'||path==='/index')return 'index.html';
  const clean=path.replace(/\/(?:index(?:\.html)?)$/,'/').replace(/\/$/,'');
  if(/^\/(?:tools|about|search|deals|categories\/[1-9]\d{0,15}|guides\/[a-z0-9-]+)$/.test(clean))return clean.slice(1)+'/index.html';
  return null;
}
export async function catalogPage(request,env,next,guides,products){
  const url=new URL(request.url);
  if(url.hostname!==HOST||!['GET','HEAD'].includes(request.method))return next();
  const base=env.SEO_INDEX_ENABLED==='1'?'https://'+HOST:'';
  const key=route(url.pathname);
  if(url.pathname==='/robots.txt'||url.pathname==='/sitemap.xml'){
    const body=render(guides,products,base)[url.pathname.slice(1)];
    if(body===undefined)return new Response('Not found',{status:404});
    return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':url.pathname.endsWith('.xml')?'application/xml; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  }
  if(!key)return next();
  const eligible=!!base&&indexable(key);
  if(eligible&&url.pathname!==canonicalPath(key)){url.pathname=canonicalPath(key);return Response.redirect(url.href,301);}
  const current=await readCatalog(env);
  if(!current&&!eligible&&key!=='search/index.html')return next();
  const html=render(guides,products,base,current,url.searchParams,{production:true,metricsEnabled:env.METRICS_ENABLED==='1'&&!!env.METRICS_DB})[key];
  if(!html)return next();
  return new Response(request.method==='HEAD'?null:html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':eligible?'index, follow':'noindex, follow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
