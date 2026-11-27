import {writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {syncCatalog,validateCatalog,normalizeProduct} from '../src/catalog.mjs';
import {render} from '../src/render.mjs';

const fixture={productId:123,productName:'USB-C 充電器 cable',productImage:'https://t2c.coupangcdn.com/image/test.png',productUrl:'https://link.tw.coupang.com/re/test',productPrice:199,categoryName:'充電配件',isRocket:true};
const credentials={accessKey:process.env.COUPANG_ACCESS_KEY,secretKey:process.env.COUPANG_SECRET_KEY};
async function verify(snapshot){
  const guides=JSON.parse(await readFile('data/guides.json','utf8'));
  const products=JSON.parse(await readFile('data/products.json','utf8'));
  const files=render(guides,products,'',snapshot);
  assert(files['index.html'].includes('每日特價'));
  assert(files['deals/index.html'].includes('rel="sponsored nofollow noopener noreferrer"'));
  assert(!files['sitemap.xml']);
  for(const [path,html] of Object.entries(files)){
    if(!path.endsWith('.html'))continue;
    assert(html.includes('content="noindex,follow"'));
    assert(!html.includes('impressionUrl'));
    for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
      const target=m[1].split(/[?#]/)[0];
      if(!target||target.startsWith('https:'))continue;
      const resolved=new URL(target,'https://preview.invalid/'+path).pathname.slice(1);
      assert(['assets/site.css','assets/unit-price.js'].includes(resolved)||Object.hasOwn(files,resolved),'Broken preview link');
    }
  }
  assert.throws(()=>render(guides,products,'https://hicrewapps.com',snapshot));
  return Object.keys(files).filter(p=>p.endsWith('.html')).length;
}
if(process.argv.includes('--self-test')){
  const calls=[];
  const snapshot=await syncCatalog({accessKey:'test',secretKey:'secret',fetchImpl:async(url,opts)=>{
    const u=new URL(url);calls.push(u.pathname);assert.equal(opts.redirect,'error');
    const rows=u.pathname.endsWith('/hotcategories')?[{categoryId:1,categoryName:'充電配件'}]:[fixture,fixture];
    return {ok:true,status:200,json:async()=>({rCode:'0',data:u.pathname.endsWith('/search')?{productData:rows}:rows})};
  }});
  assert.equal(calls.length,10);
  assert.equal(snapshot.deals.length,1);
  assert.equal(snapshot.categories[0].products.length,1);
  assert.equal(snapshot.guides['usb-c-phone-charger'].length,1);
  assert.equal(normalizeProduct({...fixture,productUrl:'https://link.tw.coupang.com.evil.invalid/x'}),null);
  assert.equal(normalizeProduct({...fixture,productImage:'https://evil.invalid/x'}),null);
  assert(normalizeProduct({...fixture,productImage:'https://ads-partners.tw.coupang.com/image/test.png',productUrl:'https://coupang.onelink.me/test?pid=test'}));
  assert.equal(normalizeProduct({...fixture,productImage:'https://ads-partners.tw.coupang.com.evil.invalid/image.png'}),null);
  assert.equal(normalizeProduct({...fixture,productImage:'https://other.tw.coupang.com/image.png'}),null);
  assert.throws(()=>validateCatalog({...snapshot,fetchedAt:'2000-01-01T00:00:00Z'}));
  const bad={...snapshot,deals:[{...fixture,productName:'<script>alert(1)</script>'}]};
  const guides=JSON.parse(await readFile('data/guides.json','utf8'));
  const html=render(guides,[],'',bad)['index.html'];
  assert(!html.includes('<script>alert(1)</script>'));
  await verify(snapshot);
  console.log('Catalog preview self-test passed');
}else{
  try{
    const snapshot=await syncCatalog(credentials);
    const pages=await verify(snapshot);
    const report={deals:snapshot.deals.length,categories:snapshot.categories.length,categoryPagesWithProducts:snapshot.categories.filter(c=>c.products.length).length,categoryProducts:snapshot.categories.reduce((sum,c)=>sum+c.products.length,0),guideDiagnostics:snapshot.guideDiagnostics,fallback:snapshot.fallback,guideMatches:Object.fromEntries(Object.entries(snapshot.guides).map(([k,v])=>[k,v.length])),previewPages:pages};
    if(process.env.CATALOG_PREVIEW_FILE){
      // Caller must choose an external private directory; do not write within checkout or public output.
      const target=process.env.CATALOG_PREVIEW_FILE;
      const {resolve,relative,isAbsolute}=await import('node:path');
      const rel=relative(process.cwd(),resolve(target));
      if(!isAbsolute(target)||!(rel==='..'||rel.startsWith('../')))throw Error('Preview snapshot must be outside checkout');
      await writeFile(target,JSON.stringify(snapshot),{mode:0o600,flag:'wx'});
    }
    console.log(JSON.stringify(report));
  }catch(e){
    // Fixed diagnostic only; never print raw provider responses or URLs.
    console.error('Catalog preview failed; no snapshot published.');process.exitCode=1;
  }
}
