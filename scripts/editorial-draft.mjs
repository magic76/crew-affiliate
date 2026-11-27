import {readFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {makeBrief,prompt,generateDraft,validateDraft} from '../src/editorial-draft.mjs';
try{
 const [mode,id,evidencePath,outPath,draftPath]=process.argv.slice(2);
 if(!['brief','generate','validate'].includes(mode)||!id||!evidencePath||!outPath||!isAbsolute(outPath))throw Error('Usage: node scripts/editorial-draft.mjs brief|generate|validate TOPIC EVIDENCE_JSON ABSOLUTE_OUT [RAW_DRAFT_JSON]');
 const root=await realpath(process.cwd()),parent=await realpath(dirname(outPath)),rel=relative(root,parent);
 if(!(rel==='..'||rel.startsWith('../')))throw Error('Output must be outside checkout');
 const queue=JSON.parse(await readFile('data/topic-queue.json','utf8'));
 const evidence=JSON.parse(await readFile(evidencePath,'utf8'));
 const brief=makeBrief(queue.topics.find(t=>t.id===id),evidence);
 const value=mode==='brief'?{brief,prompt:prompt(brief)}:mode==='validate'?validateDraft(JSON.parse(await readFile(draftPath,'utf8')),brief):await generateDraft(brief,{apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL});
 await writeFile(resolve(outPath),JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log('Private '+mode+' output created; no site changes or publication.');
}catch(e){console.error('Editorial draft operation failed. Verify inputs, configured model/key and output path. No raw data or secrets logged.');process.exitCode=1;}
