import {checkIdentity} from '../src/live-catalog.mjs';
import {verifyPublished} from '../src/catalog-readback.mjs';
import {syncCatalog,validateCatalog} from '../src/catalog.mjs';
const endpoint='https://hicrewapps.com/api/catalog';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForEndpoint(){
  const attempts=process.env.GITHUB_EVENT_NAME==='push'?24:3;
  let disabled=false;
  for(let i=0;i<attempts;i++){
    try{
      const res=await fetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
      if(res.ok&&res.headers.get('Content-Type')?.includes('application/json')){
        const status=await res.json();
        if(status.enabled===true&&status.protocol===3)return true;
        if(status.enabled===false){disabled=true;if(process.env.GITHUB_EVENT_NAME!=='push')return false;}
      }
    }catch{}
    if(i+1<attempts)await delay(15000);
  }
  if(disabled)return false;
  throw Error('Catalog endpoint not available');
}
async function token(){
  const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if(url.protocol!=='https:')throw Error('Unexpected identity URL');
  url.searchParams.set('audience',endpoint);
  const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('OIDC request failed');
  const body=await response.json();if(typeof body.value!=='string')throw Error('OIDC unavailable');
  return body.value;
}
let stage='preflight',httpStatus=null,authCheck=null;
try{
  if(process.env.GITHUB_REPOSITORY!=='magic76/crew-affiliate'||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Not main');
  if(!await waitForEndpoint()){console.log('Catalog publishing disabled or endpoint not available. No provider request made.');process.exit(0);}
  stage='provider-sync';
  const snapshot=validateCatalog(await syncCatalog({accessKey:process.env.COUPANG_ACCESS_KEY,secretKey:process.env.COUPANG_SECRET_KEY}));
  stage='github-identity';
  const jwt=await token();
  const claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString('utf8'));
  console.log(JSON.stringify({identityChecks:{aud:claims.aud===endpoint,issuer:claims.iss==='https://token.actions.githubusercontent.com',repository:claims.repository==='magic76/crew-affiliate',repositoryId:String(claims.repository_id)==='1472854687',ref:claims.ref==='refs/heads/main',workflow:claims.workflow_ref==='magic76/crew-affiliate/.github/workflows/catalog-publish.yml@refs/heads/main',subjectPresent:typeof claims.sub==='string'&&claims.sub.length>0}}));
  authCheck=await checkIdentity(jwt);
  console.log(JSON.stringify({localOidcVerification:authCheck}));
  if(authCheck!=='ok')throw Error('Local identity validation failed');
  stage='upload';
  const res=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(snapshot),redirect:'error',signal:AbortSignal.timeout(20000)});
  httpStatus=res.status;
  if(!res.ok){
    const failure=await res.json().catch(()=>({}));
    authCheck=['format','claims','time','jwks','key','signature','invalid'].includes(failure.check)?failure.check:null;
    throw Error('Catalog upload rejected');
  }
  const result=await res.json();
  if(result.ok!==true)throw Error('Upload not acknowledged');
  stage='public-readback';
  const verifiedPages=await verifyPublished(snapshot);
  console.log(JSON.stringify({published:true,verifiedPages,deals:snapshot.deals.length,categories:snapshot.categories.length,guideMatches:Object.fromEntries(Object.entries(snapshot.guides).map(([k,v])=>[k,v.length]))}));
}catch{console.error(JSON.stringify({published:false,stage,httpStatus,authCheck}));process.exitCode=1;}
