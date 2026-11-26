import {createHmac} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const ORIGIN='https://api-gateway.coupang.com';
// Candidate Partners gateway: confirm the Taiwan-specific endpoint and auth format in the authenticated Partners docs before live use.
export function sign({accessKey,secretKey,path,query='',now=new Date()}) {
  if(!accessKey||!secretKey||!/^[A-Za-z0-9_-]+$/.test(accessKey)) throw new Error('Missing or invalid API credentials');
  if(!/^\/v2\/providers\/affiliate_open_api\/apis\/openapi\/[A-Za-z0-9/_-]+$/.test(path)||path.includes('//')) throw new Error('Only a Partners API path is allowed');
  if(/[\r\n#?]/.test(query)) throw new Error('Invalid query');
  const signedDate=now.toISOString().replace(/[-:]/g,'').slice(2,15)+'Z';
  const signature=createHmac('sha256',secretKey).update(signedDate+'GET'+path+query).digest('hex');
  return 'CEA algorithm=HmacSHA256, access-key='+accessKey+', signed-date='+signedDate+', signature='+signature;
}
export async function smoke({path,query='',accessKey,secretKey,fetchImpl=fetch}) {
  const authorization=sign({accessKey,secretKey,path,query});
  const res=await fetchImpl(ORIGIN+path+(query?'?'+query:''),{method:'GET',headers:{Authorization:authorization,'X-MARKET':'TW',Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok) return {ok:false,httpStatus:res.status};
  const body=await res.json();
  // Never log credentials or raw response/affiliate URLs. Inspect the authorized response privately.
  return {ok:String(body.rCode)==='0',httpStatus:res.status,apiCode:body.rCode??null,hasData:body.data!=null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--self-test')){
    const h=sign({accessKey:'test',secretKey:'secret',path:'/v2/providers/affiliate_open_api/apis/openapi/v1/products/search',query:'keyword=usb',now:new Date('2026-11-26T08:00:00Z')});
    assert.match(h,/signed-date=261126T080000Z/);
    assert.match(h,/signature=[a-f0-9]{64}$/);
    assert.throws(()=>sign({accessKey:'test',secretKey:'secret',path:'https://other.example/'}));
    const fake=await smoke({path:'/v2/providers/affiliate_open_api/apis/openapi/v1/products/search',accessKey:'test',secretKey:'secret',fetchImpl:async(url,opts)=>{assert(url.startsWith(ORIGIN));assert.equal(opts.redirect,'error');return {ok:true,status:200,json:async()=>({rCode:'0',data:{}})}}});
    assert.equal(fake.ok,true);console.log('Coupang smoke self-test passed');
  }else{
    try{
      const path=process.env.COUPANG_PARTNERS_TEST_PATH;
      if(!path||!process.env.COUPANG_ACCESS_KEY||!process.env.COUPANG_SECRET_KEY)throw new Error('Set credentials and the documented read-only test path locally first');
      const result=await smoke({path,query:process.env.COUPANG_PARTNERS_TEST_QUERY||'',accessKey:process.env.COUPANG_ACCESS_KEY,secretKey:process.env.COUPANG_SECRET_KEY});
      console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
    }catch{console.error('Coupang test failed; verify Taiwan Partners docs, credentials and network. No credentials logged.');process.exitCode=1}
  }
}
