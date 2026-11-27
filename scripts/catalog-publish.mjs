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
        if(status.enabled===true)return true;
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
async function verifyPublished(snapshot){
  const origin='https://hicrewapps.com';
  const guide=Object.entries(snapshot.guides).find(([,rows])=>rows.length)?.[0];
  const category=snapshot.categories.find(c=>c.products.length)?.categoryId;
  const expected=[['/','id="daily-deals"'],['/deals/','每日特價'],...(category?[['/categories/'+category+'/','catalog-grid']]:[]),...(guide?[['/guides/'+guide+'/','相關商品搜尋結果']]:[])];
  for(let attempt=0;attempt<12;attempt++){
    try{
      const statusResponse=await fetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
      const status=await statusResponse.json();
      if(statusResponse.ok&&status.ready===true&&Date.parse(status.fetchedAt)>=Date.parse(snapshot.fetchedAt)){
        const pages=await Promise.all(expected.map(async ([path,marker])=>{
          const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
          const html=await response.text();
          return response.ok&&html.includes(marker)&&html.includes('rel="sponsored nofollow noopener noreferrer"')&&html.includes('catalog-card')&&html.includes('NT!=='magic76/crew-affiliate'||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Not main');
  if(!await waitForEndpoint()){console.log('Catalog publishing disabled or endpoint not available. No provider request made.');process.exit(0);}
  const snapshot=validateCatalog(await syncCatalog({accessKey:process.env.COUPANG_ACCESS_KEY,secretKey:process.env.COUPANG_SECRET_KEY}));
  const jwt=await token();
  const res=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(snapshot),redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw Error('Catalog upload rejected: '+res.status);
  const result=await res.json();
  if(result.ok!==true)throw Error('Upload not acknowledged');
  const verifiedPages=await verifyPublished(snapshot);
  console.log(JSON.stringify({published:true,verifiedPages,deals:snapshot.deals.length,categories:snapshot.categories.length,guideMatches:Object.fromEntries(Object.entries(snapshot.guides).map(([k,v])=>[k,v.length]))}));
}catch{console.error('Catalog publication failed; no raw responses or credentials logged.');process.exitCode=1;}
);
        }));
        if(pages.every(Boolean))return expected.length;
      }
    }catch{}
    if(attempt<11)await delay(10000);
  }
  throw Error('Public page verification failed');
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
