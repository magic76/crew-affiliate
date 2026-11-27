import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseFilters,searchCatalog,catalogCounts} from '../src/catalog-search.mjs';
import {validateCatalog,guideOffers,GUIDE_QUERIES} from '../src/catalog-model.mjs';
import {render} from '../src/render.mjs';
const product=(id,name,price,rocket=false)=>({productId:id,productName:name,productPrice:price,isRocket:rocket,productImage:'https://t2c.coupangcdn.com/test.png',productUrl:'https://coupa.ng/test',categoryName:'電子配件'});
const one=product(1,'USB-C 充電器',499,true),two=product(2,'USB-C 充電線',199),three=product(3,'洗衣精',99,true);
const snapshot={version:1,fetchedAt:new Date().toISOString(),deals:[one,three],categories:[{categoryId:11,categoryName:'電子配件',available:true,products:[two,one]}],guides:{'usb-c-phone-charger':[one]}};
const catalog=validateCatalog(snapshot);
const run=q=>searchCatalog(catalog,parseFilters(new URLSearchParams(q))).map(p=>p.productId);
assert.deepEqual(run(''),['1','3','2']);
assert.deepEqual(run('q=USB-C&sort=price-asc'),['2','1']);
assert.deepEqual(run('q=ＵＳＢ－Ｃ+充電線'),['2']);
assert.deepEqual(run('category=11&max=200'),['2']);
assert.deepEqual(run('category=deals&rocket=1&sort=price-desc'),['1','3']);
assert.deepEqual(run('min=400&max=200'),[]);
assert.deepEqual(run('q=missing'),[]);
assert.deepEqual(run('min=-1&sort=invalid'),['1','3','2']);
assert.equal(parseFilters(new URLSearchParams('q='+('x'.repeat(100)))).q.length,80);
const guides=JSON.parse(await readFile('data/guides.json','utf8'));
const pages=render(guides,[],'',snapshot,new URLSearchParams('q=USB-C&max=200'));
const html=pages['search/index.html'];
assert(html.includes('USB-C 充電線'));assert(!html.includes('USB-C 充電器</h3>'));assert(html.includes('找到 <strong>1</strong> 筆商品'));
assert(pages['index.html'].includes('今天想買什麼？'));assert(pages['index.html'].includes('id="daily-deals"'));
assert(render(guides,[])['search/index.html'].includes('商品資料暫未同步'));
const evil=render(guides,[],'',snapshot,new URLSearchParams('q='+encodeURIComponent('"><script>alert(1)</script>')))['search/index.html'];
assert(!evil.includes('<script>alert(1)</script>'));
assert(render(guides,[],'',snapshot,new URLSearchParams('min=500&max=10'))['search/index.html'].includes('最低價格不能高於最高價格'));
console.log('Shopping discovery tests passed');

assert.deepEqual(catalogCounts(catalog),{deals:2,categoryProducts:2,guideProducts:1,keywordProducts:0,sourceRows:5,uniqueProducts:3,duplicateRows:2});assert(pages['search/index.html'].includes('全站 3 件不重複商品'));assert(pages['search/index.html'].includes('data-product-image'));assert(pages['search/index.html'].includes('assets/product-image.js'));console.log('Catalog count checks passed');

const expanded=validateCatalog({...snapshot,expanded:[product(4,'無線滑鼠',299),one]});assert.equal(catalogCounts(expanded).uniqueProducts,4);assert.equal(searchCatalog(expanded,parseFilters(new URLSearchParams('q=無線滑鼠'))).length,1);

assert.deepEqual(Object.keys(GUIDE_QUERIES).sort(),guides.map(g=>g.slug).sort());
const coverageSnapshot={...snapshot,expanded:[product(4,'無線滑鼠',299),product(5,'成人尿布',399),product(6,'嬰兒尿布',0),{...product(7,'嬰兒尿布',399),productUrl:'https://evil.example/product'}]};
const coverage=validateCatalog(coverageSnapshot);
assert.deepEqual(guideOffers(coverage,'usb-c-cable-60w-100w').map(p=>p.productId),['2']);
assert.deepEqual(guideOffers(coverage,'detergent-unit-price').map(p=>p.productId),['3']);
assert.deepEqual(guideOffers(coverage,'wireless-mouse').map(p=>p.productId),['4']);
assert.deepEqual(guideOffers(coverage,'diaper-unit-price'),[]);
assert.deepEqual(guideOffers(null,'wireless-mouse'),[]);
const coveragePages=render(guides,[],'',coverageSnapshot);
for(const slug of ['usb-c-cable-60w-100w','detergent-unit-price','wireless-mouse']){const html=coveragePages['guides/'+slug+'/index.html'];assert(html.includes('id="guide-products"'));assert(html.includes('rel="sponsored nofollow noopener noreferrer"'));}
assert(!coveragePages['guides/diaper-unit-price/index.html'].includes('id="guide-products"'));
assert.throws(()=>validateCatalog({...coverageSnapshot,fetchedAt:new Date(Date.now()-3600001).toISOString()}));
