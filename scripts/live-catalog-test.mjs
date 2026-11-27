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
const fetchImpl=async (u,opts)=>{assert.equal(opts.redirect,'manual');assert.equal(u,'https://token.actions.githubusercontent.com/.well-known/jwks');return Response.json({keys:[jwk]});};
const verify=t=>authorize(t,{fetchImpl,now});
const valid=await jwt(claim);assert(await verify(valid));
assert.equal(await authorize(valid,{now,fetchImpl:async()=>new Response(null,{status:302,headers:{Location:'https://untrusted.invalid/jwks'}})}),false);
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
const status=await (await catalogApi(new Request(url),env)).json();assert.equal(status.ready,true);assert.equal(status.protocol,4);
const next=()=>new Response('fallback',{status:404});
for(const path of ['/','/deals/','/categories/1/','/guides/usb-c-phone-charger/']){
 const res=await catalogPage(new Request('https://hicrewapps.com'+path),env,next,guides,products);
 assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');assert((await res.text()).includes('USB-C 充電器'));
}
assert.equal((await catalogPage(new Request('https://preview.pages.dev/'),env,next,guides,products)).status,404);
assert.equal((await catalogPage(new Request('https://hicrewapps.com/assets/site.css'),env,next,guides,products)).status,404);
const search=await catalogPage(new Request('https://hicrewapps.com/search/?q=USB-C&max=200'),env,next,guides,products);
assert.equal(search.status,200);assert((await search.text()).includes('找到 <strong>1</strong> 筆商品'));
const emptySearch=await catalogPage(new Request('https://hicrewapps.com/search/index.html?max=10'),env,next,guides,products);
assert((await emptySearch.text()).includes('沒有符合條件的商品'));
const saved=data.get(KEY);
data.clear();
const unavailable=await catalogPage(new Request('https://hicrewapps.com/search/'),env,next,guides,products);
assert((await unavailable.text()).includes('商品資料暫未同步'));
assert.equal((await catalogPage(new Request('https://hicrewapps.com/'),env,next,guides,products)).status,404);
data.set(KEY,saved);
console.log('Live catalog auth, storage and HTML route checks passed');

const seo={...env,SEO_INDEX_ENABLED:'1'};
const urls=['/','/unit-price/','/tools/','/about/',...guides.map(g=>'/guides/'+g.slug+'/')];
for(const path of urls){
 const res=await catalogPage(new Request('https://hicrewapps.com'+path),seo,next,guides,products);
 assert.equal(res.status,200);assert.equal(res.headers.get('X-Robots-Tag'),'index, follow');
 const html=await res.text();assert(html.includes('content="index,follow"'));assert(html.includes('rel="canonical" href="https://hicrewapps.com'+path+'"'));
}
for(const path of ['/search/?q=USB-C','/deals/','/categories/1/']){
 const res=await catalogPage(new Request('https://hicrewapps.com'+path),seo,next,guides,products);
 assert.equal(res.status,200);assert.equal(res.headers.get('X-Robots-Tag'),'noindex, follow');assert((await res.text()).includes('content="noindex,follow"'));
}
const alias=await catalogPage(new Request('https://hicrewapps.com/guides/usb-c-phone-charger/index.html?utm_source=test'),seo,next,guides,products);
assert.equal(alias.status,301);assert.equal(alias.headers.get('Location'),'https://hicrewapps.com/guides/usb-c-phone-charger/?utm_source=test');
const map=await catalogPage(new Request('https://hicrewapps.com/sitemap.xml'),seo,next,guides,products);
assert.equal(map.status,200);const xml=await map.text();assert.equal((xml.match(/<loc>/g)||[]).length,urls.length);for(const path of urls)assert(xml.includes('<loc>https://hicrewapps.com'+path+'</loc>'));
assert(!xml.includes('/search/'));assert(!xml.includes('/deals/'));assert(!xml.includes('/categories/'));
const robots=await catalogPage(new Request('https://hicrewapps.com/robots.txt'),seo,next,guides,products);assert((await robots.text()).includes('Sitemap: https://hicrewapps.com/sitemap.xml'));
assert.equal((await catalogPage(new Request('https://hicrewapps.com/sitemap.xml'),env,next,guides,products)).status,404);
assert.equal((await catalogPage(new Request('https://preview.pages.dev/'),seo,next,guides,products)).status,404);
data.clear();
const fallback=await catalogPage(new Request('https://hicrewapps.com/'),seo,next,guides,products);
assert.equal(fallback.status,200);assert.equal(fallback.headers.get('X-Robots-Tag'),'index, follow');assert((await fallback.text()).includes('content="index,follow"'));
console.log('SEO allowlist, canonical, sitemap and fallback checks passed');


const affiliate=await catalogPage(new Request('https://hicrewapps.com/affiliate?x=1'),seo,next,guides,products);assert.equal(affiliate.status,301);assert.equal(affiliate.headers.get('Location'),'https://hicrewapps.com/?x=1');
