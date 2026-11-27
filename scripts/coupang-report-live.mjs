import {collectCoupangReports,taipeiReportWindow} from '../src/coupang-report.mjs';
import {fetchRows} from '../src/catalog.mjs';
const endpoint='https://hicrewapps.com/api/private-report';
let stage='config';
try{
 if(process.env.GITHUB_REPOSITORY!=='magic76/crew-affiliate'||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Not main');
 const accessKey=process.env.COUPANG_ACCESS_KEY,secretKey=process.env.COUPANG_SECRET_KEY,subId=process.env.COUPANG_REPORT_SUB_ID??'';
 if(!accessKey||!secretKey)throw Error('Missing credentials');
 stage='provider';
 const report=await collectCoupangReports({...taipeiReportWindow(),subId,request:(path,query)=>fetchRows({path,query,accessKey,secretKey})});
 stage='identity';
 const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);if(url.protocol!=='https:')throw Error('Invalid identity URL');url.searchParams.set('audience',endpoint);
 const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('OIDC unavailable');const jwt=(await response.json()).value;if(typeof jwt!=='string')throw Error('Missing token');
 stage='private-upload';
 for(let i=0;i<12;i++){
  const res=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(report),redirect:'error',signal:AbortSignal.timeout(20000)});
  if(res.ok&&(await res.json()).ok===true){console.log('Four Coupang report endpoints verified; private daily aggregates uploaded. No report data logged.');process.exit(0);}
  if(res.status!==404&&res.status!==503)throw Error('Upload HTTP '+res.status);
  if(i<11)await new Promise(r=>setTimeout(r,10000));
 }
 throw Error('Private upload unavailable');
}catch(e){console.error('Coupang reporting failed at '+stage+(Number.isInteger(e.httpStatus)?' HTTP '+e.httpStatus:''));process.exitCode=1;}
