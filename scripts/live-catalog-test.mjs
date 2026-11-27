import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {authorize,catalogApi,catalogPage,KEY,AUDIENCE} from '../src/live-catalog.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const guides=JSON.parse(await readFile('data/guides.json','utf8')),products=JSON.parse(await readFile('data/products.json','utf8'));
const fixture={productId:123,productName:'USB-C 充電器',productImage:'https://ads-partners.tw.coupang.com/example.png',productUrl:'https://coupa.ng/test',productPrice:199,categoryName:'電子配件'};
const snapshot={version:1,fetchedAt:new Date().toISOString(),deals:[fixture],categories:[{categoryId:1,categoryName:'電子配件',available:true,products:[fixture]}],guides:{'usb-c-phone-charger':[fixture]}};
const data=new Map(),env={CATALOG_PUBLISH_ENABLED:'1',CATALOG_KV:{get:async k=>data.get(k)??null,put:async(k,v,opts)=>{assert(opts.expirationTtl<=3600&&opts.expirationTtl>=60);data.set(k,v);}}};
const url=AUDIENCE,now=Date.now(),seconds=Math.floor(now/1000);
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test',alg:'RS256'};
const claim={iss:'https://token.actions.githubusercontent.com',aud:AUDIENCE,repository:'magic76/crew-affiliate',repository_id:'1472854687',ref:'refs/heads/main',workflow_ref:'magic76/crew-affiliate/.github/workflows/catalog-publish.yml@refs/heads/main',sub:'repo:magic76/crew-affiliate:ref:refs/heads/main',event_name:'push',iat:seconds,nbf:seconds,exp:seconds+300};
const b64=v=>Buffer.from(v).toString('base64url');
async function jwt(c){const unsigned=b64(JSON.stringify({alg:'RS256',kid:'test'}))+'.'+b64(JSON.stringify(c));return unsigned+'.'+b64(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(unsigned)));}
const fetchImpl=async u=>{assert.equal(u,'https://token.actions.githubusercontent.com/.well-known/jwks');return Response.json({keys:[jwk]});};
const verify=t=>authorize(t,{fetchImpl,now});
const valid=await jwt(claim);assert(await verify(valid));
assert(await verify(await jwt({...claim,sub:'custom:repo_id:1472854687'})));
assert(await verify(await jwt({...claim,nbf:undefined,exp:seconds+3600})));
assert(await verify(await jwt({...claim,iat:String(seconds),exp:String(seconds+300)})));
assert.equal(await verify(await jwt({...claim,iat:seconds-601})),false);
assert.equal(await verify(await jwt({...claim,nbf:seconds+31})),false);
for(const bad of [{aud:'wrong'},{repository_id:'0'},{ref:'refs/heads/evil'},{exp:seconds-1},{workflow_ref:'other'},{sub:''},{event_name:'pull_request'},{repository:'other/repo'}])assert.equal(await verify(await jwt({...claim,...bad})),false);
assert.equal(await verify(valid.slice(0,-8)+'AAAAAAAA'),false);
function post(token,body=snapshot){return new Request(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});}
assert.equal((await catalogApi(post(valid),{...env,CATALOG_PUBLISH_ENABLED:'0'},{verify})).status,503);
assert.equal((await catalogApi(post('bad'),env,{verify})).status,401);
assert.equal((await catalogApi(post(valid,{...snapshot,fetchedAt:'2000-01-01T00:00:00Z'}),env,{verify})).status,400);
assert.equal((await catalogApi(post(valid),env,{verify})).status,200);
assert(data.has(KEY));
const status=await (await catalogApi(new Request(url),env)).json();assert.equal(status.ready,true);assert.equal(status.protocol,3);
const next=()=>new Response('fallback',{status:404});
for(const path of ['/','/deals/','/categories/1/','/guides/usb-c-phone-charger/']){
 const res=await catalogPage(new Request('https://hicrewapps.com'+path),env,next,guides,products);
 assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');assert((await res.text()).includes('USB-C 充電器'));
}
assert.equal((await catalogPage(new Request('https://preview.pages.dev/'),env,next,guides,products)).status,404);
assert.equal((await catalogPage(new Request('https://hicrewapps.com/assets/site.css'),env,next,guides,products)).status,404);
data.clear();
assert.equal((await catalogPage(new Request('https://hicrewapps.com/'),env,next,guides,products)).status,404);
console.log('Live catalog auth, storage and HTML route checks passed');
