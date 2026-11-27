import {fetchRows,normalizeProduct} from '../src/catalog.mjs';
import {PRODUCT_PATHS} from './coupang-smoke.mjs';
const credentials={accessKey:process.env.COUPANG_ACCESS_KEY,secretKey:process.env.COUPANG_SECRET_KEY};
const hosts=['www.tw.coupang.com','tw.coupang.com','www.coupang.com','link.tw.coupang.com','link.coupang.com','coupa.ng','coupang.onelink.me','image-cdn.coupang.com','image-cdn.tw.coupang.com','img.tw.coupang.com','t2c.coupangcdn.com'];
function classify(value){
  if(typeof value!=='string')return 'missing-or-not-string';
  try{
    const u=new URL(value);
    const h=hosts.includes(u.hostname)?u.hostname:u.hostname.endsWith('.coupangcdn.com')?'other-coupangcdn':u.hostname.endsWith('.tw.coupang.com')?'other-tw-coupang':u.hostname.endsWith('.coupang.com')?'other-coupang':'other';
    const path=u.pathname.startsWith('/vp/products/')?'vp-products':u.pathname.startsWith('/products/')?'products':u.pathname.startsWith('/re')?'redirect':u.pathname.startsWith('/a/')?'short':'other';
    return [u.protocol==='https:'?'https':u.protocol==='http:'?'http':'other',h,path,u.search?'query':'no-query'].join(':');
  }catch{return 'invalid-url';}
}
function counts(rows,fn){
  const out=Object.create(null);for(const p of rows){const k=fn(p);out[k]=(out[k]||0)+1;}return out;
}
try{
  const rows=await fetchRows({path:PRODUCT_PATHS.search,query:'keyword=USB-C&limit=5',...credentials});
  const report={count:rows.length,normalized:rows.filter(normalizeProduct).length,
    id:counts(rows,p=>Number.isSafeInteger(p.productId)?'safe-number':typeof p.productId==='string'?'string':'other'),
    name:counts(rows,p=>typeof p.productName!=='string'?'missing':!p.productName.trim()?'empty':p.productName.length>200?'over-200':'valid'),
    price:counts(rows,p=>Number.isFinite(p.productPrice)&&p.productPrice>=0?'valid':typeof p.productPrice),
    image:counts(rows,p=>classify(p.productImage)),link:counts(rows,p=>classify(p.productUrl))};
  console.log(JSON.stringify(report));
}catch{console.error('Search shape probe failed');process.exitCode=1;}
