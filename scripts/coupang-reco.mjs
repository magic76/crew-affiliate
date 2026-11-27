import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {sign,RECO_PATH} from './coupang-smoke.mjs';

const ORIGIN='https://api-gateway.tw.coupang.com';
// One diagnostic request for our actual site. No viewer identity or invented device data.
const payload={site:{domain:'hicrewapps.com',page:'https://hicrewapps.com/'},imp:{adType:3,imageSize:'300x300',placementId:'crew-affiliate-home-reco'}};
const isHttps=value=>{
  try{const u=new URL(value);return typeof value==='string'&&u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}
};
export function summarize(body,httpStatus) {
  const apiOk=String(body?.rCode)==='0';
  const rows=body?.data?.result;
  const hasResult=Array.isArray(rows);
  const products=hasResult?rows:[];
  const complete=products.filter(p=>p&&((typeof p.productId==='number'&&Number.isSafeInteger(p.productId)&&p.productId>0)||(typeof p.productId==='string'&&/^[1-9]\d*$/.test(p.productId)))&&typeof p.productName==='string'&&p.productName.trim().length>0&&Number.isFinite(p.productPrice)&&p.productPrice>=0&&isHttps(p.productImage)&&isHttps(p.productUrl)&&isHttps(p.impressionUrl));
  return {ok:apiOk&&hasResult,httpStatus,apiCode:apiOk?'0':'nonzero',productCount:products.length,completeProductCount:complete.length,hasProducts:complete.length>0};
}
export async function probe({accessKey,secretKey,fetchImpl=fetch}) {
  const authorization=sign({accessKey,secretKey,path:RECO_PATH});
  const res=await fetchImpl(ORIGIN+RECO_PATH,{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok)return {ok:false,httpStatus:res.status};
  // Never fetch impressionUrl or productUrl, or log the raw response.
  return summarize(await res.json(),res.status);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--self-test')){
    const product={productId:123,productName:'Test',productPrice:99,productImage:'https://example.invalid/image',productUrl:'https://example.invalid/product',impressionUrl:'https://example.invalid/impression'};
    let calls=0;
    const result=await probe({accessKey:'test',secretKey:'secret',fetchImpl:async(url,opts)=>{
      calls++;assert.equal(url,ORIGIN+RECO_PATH);assert.equal(opts.method,'POST');assert.equal(opts.redirect,'error');
      assert.deepEqual(JSON.parse(opts.body),payload);assert.match(opts.headers.Authorization,/signature=[a-f0-9]{64}$/);
      return {ok:true,status:200,json:async()=>({rCode:'0',data:{result:[product]}})};
    }});
    assert.equal(calls,1);assert.equal(result.ok,true);assert.equal(result.completeProductCount,1);
    assert.equal(summarize({rCode:'0',data:{result:[]}},200).hasProducts,false);
    assert.equal(summarize({rCode:'0',data:{}},200).ok,false);
    assert.equal(summarize({rCode:'0',data:{result:[{...product,impressionUrl:'javascript:alert(1)'}]}},200).completeProductCount,0);
    console.log('Coupang Reco self-test passed');
  }else{
    try{
      const result=await probe({accessKey:process.env.COUPANG_ACCESS_KEY,secretKey:process.env.COUPANG_SECRET_KEY});
      console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
    }catch{console.error('Coupang Reco probe failed; no credentials or tracking URLs logged.');process.exitCode=1}
  }
}
