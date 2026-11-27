import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {sign,PRODUCT_PATHS} from './coupang-smoke.mjs';
const ORIGIN='https://api-gateway.tw.coupang.com';
const names=['search','hotcategories','goldbox'];
// Parameter names and response schema are diagnostic candidates until the expanded Document is reviewed.
const searchQuery='keyword=USB-C&limit=5';
function getRows(body){
  const d=body?.data;
  for(const [shape,rows] of [['data',d],['data.productData',d?.productData],['data.result',d?.result],['data.categoryData',d?.categoryData],['data.categories',d?.categories]]){
    if(Array.isArray(rows))return {shape,rows};
  }
  return {shape:'unrecognized',rows:[]};
}
function https(value){
  try{const url=new URL(value);return typeof value==='string'&&url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}
}
export function summarize(endpoint,body,httpStatus){
  const apiOk=String(body?.rCode)==='0';
  const {shape,rows}=getRows(body);
  const products=rows.filter(p=>p&&((Number.isSafeInteger(p.productId)&&p.productId>0)||(typeof p.productId==='string'&&/^[1-9]\d*$/.test(p.productId)))&&typeof p.productName==='string'&&p.productName.trim()&&Number.isFinite(p.productPrice)&&p.productPrice>=0&&https(p.productImage)&&https(p.productUrl));
  const categories=rows.filter(p=>p&&(Number.isSafeInteger(p.categoryId)||typeof p.categoryId==='string')&&typeof p.categoryName==='string'&&p.categoryName.trim());
  return {endpoint,ok:apiOk&&shape!=='unrecognized',httpStatus,apiCode:apiOk?'0':'nonzero',shape,rowCount:rows.length,completeProductCount:products.length,categoryCount:categories.length};
}
export async function probe({endpoint,accessKey,secretKey,fetchImpl=fetch}){
  if(!names.includes(endpoint))throw new Error('Unknown endpoint');
  const path=PRODUCT_PATHS[endpoint];
  const query=endpoint==='search'?searchQuery:'';
  const authorization=sign({accessKey,secretKey,method:'GET',path,query});
  const res=await fetchImpl(ORIGIN+path+(query?'?'+query:''),{method:'GET',headers:{Authorization:authorization,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok)return {endpoint,ok:false,httpStatus:res.status};
  return summarize(endpoint,await res.json(),res.status);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--self-test')){
    const now=new Date('2026-11-26T08:00:00Z');
    const signature=createHmac('sha256','secret').update('261126T080000ZGET'+PRODUCT_PATHS.search+searchQuery).digest('hex');
    assert.equal(sign({accessKey:'test',secretKey:'secret',method:'GET',path:PRODUCT_PATHS.search,query:searchQuery,now}),'CEA algorithm=HmacSHA256, access-key=test, signed-date=261126T080000Z, signature='+signature);
    assert.throws(()=>sign({accessKey:'test',secretKey:'secret',method:'GET',path:PRODUCT_PATHS.search,query:'keyword=a&limit=500'}));
    const product={productId:1,productName:'Test',productPrice:99,productImage:'https://example.invalid/image',productUrl:'https://example.invalid/product'};
    const result=await probe({endpoint:'search',accessKey:'test',secretKey:'secret',fetchImpl:async(url,opts)=>{
      assert.equal(url,ORIGIN+PRODUCT_PATHS.search+'?'+searchQuery);assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
      return {ok:true,status:200,json:async()=>({rCode:'0',data:{productData:[product]}})};
    }});
    assert.equal(result.ok,true);assert.equal(result.completeProductCount,1);
    assert.equal(summarize('hotcategories',{rCode:'0',data:[{categoryId:1,categoryName:'Test'}]},200).categoryCount,1);
    assert.equal(summarize('goldbox',{rCode:'0',data:[{...product,productUrl:'javascript:alert(1)'}]},200).completeProductCount,0);
    assert.equal(summarize('search',{rCode:'0',data:{}},200).ok,false);
    console.log('Coupang product self-test passed');
  }else{
    const results=await Promise.all(names.map(async endpoint=>{
      try{return await probe({endpoint,accessKey:process.env.COUPANG_ACCESS_KEY,secretKey:process.env.COUPANG_SECRET_KEY});}
      catch{return {endpoint,ok:false,error:'request-or-parse-failed'};}
    }));
    for(const result of results)console.log(JSON.stringify(result));
    if(results.some(r=>!r.ok))process.exitCode=1;
  }
}
