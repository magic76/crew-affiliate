// Taiwan Partners Document: four ordinary (non-ads) daily reports.
export const REPORT_TYPES=Object.freeze(['clicks','orders','cancels','commission']);
const pathBase='/v2/providers/affiliate_open_api/apis/openapi/v1/reports/';
export const REPORT_PATHS=Object.freeze(Object.fromEntries(REPORT_TYPES.map(k=>[k,pathBase+k])));
const check=(ok,msg)=>{if(!ok)throw Error(msg);};
const date=v=>typeof v==='string'&&/^\d{8}$/.test(v)&&Number.isFinite(Date.parse(v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6)))&&new Date(v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6)).toISOString().slice(0,10).replaceAll('-','')===v;
const millis=v=>Date.parse(v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6)+'T00:00:00Z');
const number=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e15;
const count=v=>Number.isSafeInteger(v)&&v>=0;
const iso=v=>v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6);
export function reportQuery(start,end,page=0,subId=''){
 check(date(start)&&date(end)&&start>='20181101'&&start<=end&&millis(end)-millis(start)<=30*86400000,'Invalid report dates');
 check(Number.isInteger(page)&&page>=0&&page<20,'Invalid report page');
 check(typeof subId==='string'&&/^[A-Za-z0-9_-]{0,100}$/.test(subId),'Invalid subId');
 return 'startDate='+start+'&endDate='+end+(subId?'&subId='+subId:'')+'&page='+page;
}
export function isReportRequest(path,query){
 if(!Object.values(REPORT_PATHS).includes(path))return false;
 const m=/^startDate=(\d{8})&endDate=(\d{8})(?:&subId=([A-Za-z0-9_-]{1,100}))?&page=(\d{1,2})$/.exec(query);
 try{return !!m&&reportQuery(m[1],m[2],Number(m[4]),m[3]??'')===query;}catch{return false;}
}
export function taipeiReportWindow(now=new Date()){
 const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const end=new Date(local+'T00:00:00Z');end.setUTCDate(end.getUTCDate()-1);
 const start=new Date(end);start.setUTCDate(start.getUTCDate()-6);
 return {start:start.toISOString().slice(0,10).replaceAll('-',''),end:end.toISOString().slice(0,10).replaceAll('-','')};
}
const metrics={
 clicks:['click'],
 orders:['quantity','gmv','commission'],
 cancels:['quantity','gmv','commission'],
 commission:['commission','click','order','cancel','gmv','firstPurchaseOrder','firstPurchaseOrderCancel','firstPurchaseGmv']
};
function rowValues(kind,row,start,end){
 check(row&&date(row.date)&&row.date>=start&&row.date<=end,'Invalid report row date');
 const values={};
 for(const key of metrics[kind]){
  const v=row[key];
  check(number(v),'Missing or invalid '+kind+' field');
  if(['click','order','cancel','firstPurchaseOrder','firstPurchaseOrderCancel'].includes(key))check(count(v),'Invalid report count');
  if(kind==='orders')check(v>=0,'Unexpected negative order amount');
  if(kind==='cancels')check(v<=0,'Unexpected positive cancellation amount');
  if(key==='quantity')check(Number.isSafeInteger(v),'Invalid quantity');
  values[key]=v;
 }
 return values;
}
export async function collectCoupangReports({start,end,subId='',request,delay=ms=>new Promise(r=>setTimeout(r,ms))}){
 reportQuery(start,end,0,subId);
 const reports={};
 for(const kind of REPORT_TYPES){
  const daily=new Map();
  let complete=false;
  for(let page=0;page<20;page++){
   const rows=await request(REPORT_PATHS[kind],reportQuery(start,end,page,subId));
   check(Array.isArray(rows)&&rows.length<=1000,'Invalid report page');
   for(const row of rows){
    const values=rowValues(kind,row,start,end),d=iso(row.date),bucket=daily.get(d)??Object.fromEntries(metrics[kind].map(k=>[k,0]));
    for(const k of metrics[kind]){bucket[k]+=values[k];check(number(bucket[k]),'Aggregate overflow');}
    daily.set(d,bucket);
   }
   if(rows.length<1000){complete=true;break;}
   await delay(250);
  }
  check(complete,'Report pagination exceeded safety limit; do not publish partial data');
  reports[kind]=[...daily.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,...values}));
 }
 return {version:1,source:'coupang-partners-v1',scope:subId?'configured-subId':'account-wide',period:{start:iso(start),end:iso(end)},reports};
}
export function validateCoupangReport(value){
 check(value?.version===1&&value.source==='coupang-partners-v1'&&['configured-subId','account-wide'].includes(value.scope),'Invalid report envelope');
 const start=value.period?.start?.replaceAll('-',''),end=value.period?.end?.replaceAll('-','');
 reportQuery(start,end);
 const reports={};
 for(const kind of REPORT_TYPES){
  const rows=value.reports?.[kind];check(Array.isArray(rows)&&rows.length<=31,'Invalid daily rows');
  const seen=new Set();
  reports[kind]=rows.map(row=>{
   check(typeof row.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&!seen.has(row.date),'Duplicate or invalid day');
   seen.add(row.date);
   return {date:row.date,...rowValues(kind,{...row,date:row.date.replaceAll('-','')},start,end)};
  });
 }
 return {version:1,source:value.source,scope:value.scope,period:{start:iso(start),end:iso(end)},reports};
}
