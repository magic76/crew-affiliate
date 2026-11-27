import {syncCatalog,validateCatalog} from '../src/catalog.mjs';
const endpoint='https://hicrewapps.com/api/catalog';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForEndpoint(){
  const attempts=process.env.GITHUB_EVENT_NAME==='push'?24:1;
  for(let i=0;i<attempts;i++){
    try{
      const res=await fetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
      if(res.ok&&res.headers.get('Content-Type')?.includes('application/json')){
        const status=await res.json();
        if(status.enabled===true)return true;
        if(status.enabled===false&&attempts===1)return false;
      }
    }catch{}
    if(i+1<attempts)await delay(15000);
  }
  return false;
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
try{
  if(process.env.GITHUB_REPOSITORY!=='magic76/crew-affiliate'||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Not main');
  if(!await waitForEndpoint()){console.log('Catalog publishing disabled or endpoint not available. No provider request made.');process.exit(0);}
  const snapshot=validateCatalog(await syncCatalog({accessKey:process.env.COUPANG_ACCESS_KEY,secretKey:process.env.COUPANG_SECRET_KEY}));
  const jwt=await token();
  const res=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(snapshot),redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw Error('Catalog upload rejected: '+res.status);
  const result=await res.json();
  if(result.ok!==true)throw Error('Upload not acknowledged');
  console.log(JSON.stringify({published:true,deals:snapshot.deals.length,categories:snapshot.categories.length,guideMatches:Object.fromEntries(Object.entries(snapshot.guides).map(([k,v])=>[k,v.length]))}));
}catch{console.error('Catalog publication failed; no raw responses or credentials logged.');process.exitCode=1;}
