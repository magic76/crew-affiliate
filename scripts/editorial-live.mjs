import {makeBrief,generateDraft} from '../src/editorial-draft.mjs';
import {seed} from '../src/editorial-live-brief.mjs';
import {readFile} from 'node:fs/promises';
const endpoint='https://hicrewapps.com/api/private-draft';
let stage='config',httpStatus=null;
try{
 if(process.env.GITHUB_REPOSITORY!=='magic76/crew-affiliate'||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Not main');
 const queue=JSON.parse(await readFile('data/topic-queue.json','utf8'));if(!queue.topics.some(t=>t.id===seed.topic.id&&t.status==='candidate')){console.log('Seed no longer candidate; no request made.');process.exit(0);}
 const apiKey=process.env.GEMINI_API_KEY,model=process.env.GEMINI_MODEL;
 if(!apiKey||!model)throw Error('Missing Gemini configuration');
 stage='deployment-ready';let ready=false;
 for(let i=0;i<24;i++){try{ready=(await fetch(endpoint,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(10000)})).status===204;}catch{}if(ready)break;if(i<23)await new Promise(r=>setTimeout(r,10000));}if(!ready)throw Error('Endpoint not ready');
 stage='gemini';let raw;
 const brief=makeBrief(seed.topic,seed.evidence);
 // Capture only the structured model response, not credentials or raw responses in logs.
 await generateDraft(brief,{apiKey,model,fetchImpl:async(url,opts)=>{const res=await fetch(url,opts);httpStatus=res.status;if(res.ok){const body=await res.clone().json();raw=JSON.parse(body.candidates?.[0]?.content?.parts?.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('')??'');}return res;}});
 stage='identity';
 const url=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);if(url.protocol!=='https:')throw Error('Invalid identity URL');url.searchParams.set('audience',endpoint);
 const response=await fetch(url,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('OIDC unavailable');const jwt=(await response.json()).value;
 stage='upload';const res=await fetch(endpoint,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify({brief,raw}),signal:AbortSignal.timeout(20000)});httpStatus=res.status;
 if(!res.ok||(await res.json()).ok!==true)throw Error('Private upload failed');
 console.log('Gemini generated a source-bound draft, validated and stored privately. Editorial review required; nothing published.');
}catch{console.error('Editorial live failed at '+stage+(httpStatus?' HTTP '+httpStatus:''));process.exitCode=1;}
