import {createHmac} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const ORIGIN='https://api-gateway.tw.coupang.com';
const PATH='/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
const TEST_URL='https://www.tw.coupang.com/search?component=&q=USB-C&channel=user';
// Taiwan Partners Guide: timestamp + method + path + query (without ?).
export function sign({accessKey,secretKey,method='POST',path=PATH,query='',now=new Date()}) {
  if(!accessKey||!secretKey||!/^[A-Za-z0-9_-]+$/.test(accessKey)) throw new Error('Missing or invalid API credentials');
  if(path!==PATH||method!=='POST'||query!=='') throw new Error('Only documented deeplink probe is allowed');
  const signedDate=now.toISOString().replace(/[-:]/g,'').slice(2,15)+'Z';
  const signature=createHmac('sha256',secretKey).update(signedDate+method+path+query).digest('hex');
  return 'CEA algorithm=HmacSHA256, access-key='+accessKey+', signed-date='+signedDate+', signature='+signature;
}
export async function smoke({accessKey,secretKey,fetchImpl=fetch}) {
  const authorization=sign({accessKey,secretKey});
  const res=await fetchImpl(ORIGIN+PATH,{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({coupangUrls:[TEST_URL]}),redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok) return {ok:false,httpStatus:res.status};
  const body=await res.json();
  const hasDeeplink=Array.isArray(body.data)&&body.data.some(row=>row.originalUrl===TEST_URL&&typeof row.shortenUrl==='string'&&/^https:\/\/coupa\.ng\/[A-Za-z0-9_-]+$/.test(row.shortenUrl));
  // Never log raw response, affiliate URLs or credentials.
  return {ok:String(body.rCode)==='0'&&hasDeeplink,httpStatus:res.status,apiCode:String(body.rCode)==='0'?'0':'nonzero',hasDeeplink};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--self-test')){
    const h=sign({accessKey:'test',secretKey:'secret',now:new Date('2026-11-26T08:00:00Z')});
    const expected=createHmac('sha256','secret').update('261126T080000ZPOST/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink').digest('hex');
    assert.equal(h,'CEA algorithm=HmacSHA256, access-key=test, signed-date=261126T080000Z, signature='+expected);
    assert.throws(()=>sign({accessKey:'test',secretKey:'secret',path:'https://other.example/'}));
    const fake=await smoke({accessKey:'test',secretKey:'secret',fetchImpl:async(url,opts)=>{
      assert.equal(url,ORIGIN+PATH);assert.equal(opts.method,'POST');assert.equal(opts.redirect,'error');
      assert.deepEqual(JSON.parse(opts.body),{coupangUrls:[TEST_URL]});
      assert.equal(opts.headers['Content-Type'],'application/json');
      return {ok:true,status:200,json:async()=>({rCode:'0',data:[{originalUrl:TEST_URL,shortenUrl:'https://coupa.ng/test123'}]})};
    }});
    assert.equal(fake.ok,true);
    const empty=await smoke({accessKey:'test',secretKey:'secret',fetchImpl:async()=>({ok:true,status:200,json:async()=>({rCode:'0',data:[]})})});
    assert.equal(empty.ok,false);
    console.log('Coupang smoke self-test passed');
  }else{
    try{
      const result=await smoke({accessKey:process.env.COUPANG_ACCESS_KEY,secretKey:process.env.COUPANG_SECRET_KEY});
      console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;
    }catch{console.error('Coupang test failed; verify Taiwan Partners credentials and network. No credentials logged.');process.exitCode=1}
  }
}
