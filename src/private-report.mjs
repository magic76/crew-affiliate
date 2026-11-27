const SITE='sc-domain:hicrewapps.com';
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const count=v=>Number.isSafeInteger(v)&&v>=0;
const check=(x,msg)=>{if(!x)throw Error(msg);};
const sum=(arr,key)=>arr.reduce((n,r)=>n+r[key],0);
const rate=(n,d)=>d>0?n/d:null;
export function reportWindow(now=new Date()){
 const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const end=new Date(local+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-4);const start=new Date(end);start.setUTCDate(start.getUTCDate()-6);
 return {start:endless(start),end:endless(end)};
}
const endless=d=>d.toISOString().slice(0,10);
function dates(period){check(day(period?.start)&&day(period?.end)&&period.start<=period.end&&Date.parse(period.end)-Date.parse(period.start)<=31*86400000,'Invalid period');return period;}
function gscRow(row,dimensions){
 check(Array.isArray(row.keys??[])&&(row.keys??[]).length===dimensions.length&&(row.keys??[]).every(k=>typeof k==='string'&&k.length<=2048)&&num(row.clicks)&&num(row.impressions)&&num(row.ctr)&&row.ctr<=1&&num(row.position),'Invalid GSC row');
 return {keys:row.keys??[],clicks:row.clicks,impressions:row.impressions,ctr:row.ctr,position:row.position};
}
export async function collectGsc(token,period=reportWindow(),fetchImpl=fetch){
 dates(period);check(typeof token==='string'&&token.length>0,'Set GSC_ACCESS_TOKEN');
 const url='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(SITE)+'/searchAnalytics/query';
 const groups={};
 for(const [name,dimensions] of [['total',[]],['date',['date']],['query',['query']],['page',['page']]]){
  const res=await fetchImpl(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({startDate:period.start,endDate:period.end,dimensions,type:'web',dataState:'final',rowLimit:1000})});
  check(res.ok,'GSC HTTP '+res.status);const result=await res.json();const rows=result.rows??[];check(Array.isArray(rows)&&rows.length<=1000,'Invalid GSC response');
  groups[name]={rows:rows.map(r=>gscRow(r,dimensions)),possiblyTruncated:rows.length===1000};
 }
 return {version:1,property:SITE,period,groups,limitations:'Final web data; query/page rows may omit data. Do not infer search volume from impressions.'};
}
export function summarizeMetrics(rows,period){
 dates(period);check(Array.isArray(rows)&&rows.length<=20000,'Invalid daily metrics');const map=new Map();
 for(const r of rows){
  check(day(r.day)&&typeof r.page==='string'&&/^\/[a-z0-9/-]*$/.test(r.page)&&r.page.length<=180&&count(r.count)&&['pageview','affiliate_click'].includes(r.event)&&((r.event==='pageview'&&r.provider==='')||(r.event==='affiliate_click'&&['coupang','shopee'].includes(r.provider))),'Invalid metrics row');
  if(r.day<period.start||r.day>period.end)continue;
  const p=map.get(r.page)??{page:r.page,pageviews:0,coupangClicks:0,shopeeClicks:0};
  p[r.event==='pageview'?'pageviews':r.provider==='coupang'?'coupangClicks':'shopeeClicks']+=r.count;map.set(r.page,p);
 }
 const pages=[...map.values()].map(p=>({...p,clicksPerView:rate(p.coupangClicks+p.shopeeClicks,p.pageviews)})).sort((a,b)=>b.pageviews-a.pageviews);
 const total={pageviews:sum(pages,'pageviews'),coupangClicks:sum(pages,'coupangClicks'),shopeeClicks:sum(pages,'shopeeClicks')};
 return {period,total:{...total,clicksPerView:rate(total.coupangClicks+total.shopeeClicks,total.pageviews)},pages,limitations:'Observed events, not unique visitors, orders, or settled commission; can be affected by repeated clicks, bots and blocking.'};
}
// This is an internal normalized import contract, NOT a claim about Coupang API response keys.
// Require explicit currency and status; never assume pending commission is paid.
export function summarizeCommission(rows,period){
 dates(period);check(Array.isArray(rows)&&rows.length<=20000,'Invalid normalized commission data');const keys=new Set();
 for(const r of rows){
  check(r&&day(r.day)&&r.currency==='TWD'&&['pending','confirmed','paid','reversed'].includes(r.status)&&count(r.orders)&&num(r.commission)&&Object.keys(r).every(k=>['day','currency','status','orders','commission'].includes(k)),'Invalid normalized commission row');
  const key=r.day+'|'+r.status;check(!keys.has(key),'Duplicate day/status aggregate');keys.add(key);
 }
 const selected=rows.filter(r=>r.day>=period.start&&r.day<=period.end);
 const byStatus=Object.fromEntries(['pending','confirmed','paid','reversed'].map(status=>{const a=selected.filter(r=>r.status===status);return [status,{orders:sum(a,'orders'),commission:sum(a,'commission')}] }));
 return {period,currency:'TWD',byStatus,limitations:'Caller must map official export definitions. Status buckets are reported separately; do not sum pending, confirmed and paid as revenue. Reversals not automatically netted.'};
}
export function buildReport({period,metrics=null,gsc=null,commission=null}){
 dates(period);
 if(gsc)check(gsc.property===SITE&&gsc.period?.start===period.start&&gsc.period?.end===period.end&&gsc.groups,'Mismatched GSC property or period');
 const opportunities=gsc?(gsc.groups.query?.rows??[]).filter(r=>r.impressions>=10&&r.position>=8&&r.position<=20).sort((a,b)=>b.impressions-a.impressions).slice(0,20):null;
 return {version:1,period,metrics:metrics===null?null:summarizeMetrics(metrics,period),gsc:gsc?{total:gsc.groups.total?.rows??[],opportunities,limitations:gsc.limitations}:null,commission:commission===null?null:summarizeCommission(commission,period),warnings:['GSC dates are Pacific time; site events are Taipei time. Compare trends, not exact event-level attribution.','Missing inputs remain null, not zero.','No product-level or page-level settlement attribution without verified provider data.']};
}
