import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {APPROVED_GUIDES} from '../src/seo.mjs';
const guides=JSON.parse(await readFile('data/guides.json','utf8')),queue=JSON.parse(await readFile('data/topic-queue.json','utf8'));
const clean=s=>typeof s==='string'&&s.trim()===s&&s.length>0;
const https=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port;}catch{return false;}};
const unique=(rows,label)=>assert.equal(new Set(rows).size,rows.length,'Duplicate '+label);
unique(guides.map(g=>g.slug),'guide slug');unique(guides.map(g=>g.title),'guide title');unique(guides.map(g=>g.description),'guide description');
for(const slug of APPROVED_GUIDES){
 const g=guides.find(x=>x.slug===slug);assert(g,'Approved guide missing: '+slug);
 assert(clean(g.title)&&g.title.length<=100&&clean(g.description)&&g.description.length<=200);
 assert(g.quick?.length>=2&&g.quick.every(clean));assert(g.checks?.length>=3&&g.checks.every(clean));
 assert(g.comparison?.length>=2&&g.comparison.every(r=>r.length===3&&r.every(clean)));
 assert(g.sections?.length>=4&&g.sections.every(r=>r.length===2&&r.every(clean)));
 assert(g.faq?.length>=2&&g.faq.every(r=>r.length===2&&r.every(clean)));
 assert(g.sources?.length>=1&&g.sources.every(r=>r.length===2&&clean(r[0])&&https(r[1])));
 assert(/^\d{4}-\d{2}-\d{2}$/.test(g.reviewedOn)&&Number.isFinite(Date.parse(g.reviewedOn)));
 assert(!/(保證最低價|保證有效|親測第一名|全網最低)/.test(JSON.stringify(g)),'Unsupported claim');
}
assert.equal(queue.version,1);unique(queue.topics.map(x=>x.id),'topic ID');unique(queue.topics.map(x=>x.keyword),'keyword');
for(const t of queue.topics){assert(/^[a-z0-9-]+$/.test(t.id)&&clean(t.keyword)&&clean(t.angle));assert([1,2,3].includes(t.intent)&&[1,2,3].includes(t.fit));assert(t.evidence.length&&t.evidence.every(x=>https(x.url)));assert(t.searchVolume===null&&t.competition===null,'Unmeasured metrics must stay null');}
const candidates=queue.topics.filter(t=>t.status==='candidate').sort((a,b)=>b.intent+b.fit-a.intent-a.fit||a.id.localeCompare(b.id));
if(process.argv.includes('--topics'))console.log(JSON.stringify(candidates.map(({id,keyword,cluster,angle,evidence})=>({id,keyword,cluster,angle,evidence})),null,2));
else console.log('Editorial checks passed; '+candidates.length+' research candidates (not volume forecasts)');
