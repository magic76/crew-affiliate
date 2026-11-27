import {validateCoupangReport,taipeiReportWindow} from './coupang-report.mjs';
import {validateGsc} from './private-ingest.mjs';
import {summarizeMetrics} from './private-report.mjs';
import {readCatalog} from './live-catalog.mjs';
import {catalogCounts} from './catalog-search.mjs';
const bytes=s=>{if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Invalid token');return Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));};
const parse=s=>JSON.parse(new TextDecoder().decode(bytes(s)));
export async function authorizeAdmin(token,env,{fetchImpl=fetch,now=Date.now()}={}){
 try{
  const issuer=env.ADMIN_ACCESS_ISSUER,aud=env.ADMIN_ACCESS_AUD;
  if(typeof issuer!=='string'||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||typeof aud!=='string'||!/^[a-f0-9]{64}$/.test(aud)||typeof token!=='string'||token.length>16000)return false;
  const [h,p,s,...rest]=token.split('.');if(rest.length||!s)return false;
  const header=parse(h),claims=parse(p),seconds=Math.floor(now/1000);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200||claims.iss!==issuer||!Array.isArray(claims.aud)||!claims.aud.includes(aud)||!Number.isSafeInteger(claims.exp)||claims.exp<=seconds||!Number.isSafeInteger(claims.iat)||claims.iat>seconds+30||claims.exp<=claims.iat||(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>seconds+30))||typeof claims.email!=='string'||!claims.email.includes('@'))return false;
  const res=await fetchImpl(issuer+'/cdn-cgi/access/certs',{redirect:'manual',signal:AbortSignal.timeout(10000)});if(res.status!==200)return false;
  const body=await res.json(),key=body.keys?.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256'));if(!key)return false;
  const publicKey=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',publicKey,bytes(s),new TextEncoder().encode(h+'.'+p));
 }catch{return false;}
}
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>typeof v==='number'&&Number.isFinite(v)?e(new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v)):'—';
const pct=(n,d)=>d>0?fmt(n/d*100)+'%':'—';
const date=v=>e(v??'未同步');
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"};
const card=(title,value,desc='')=>'<div class="kpi"><small>'+e(title)+'</small><strong>'+value+'</strong><p>'+e(desc)+'</p></div>';
const table=(cols,rows)=>'<div class="scroll"><table><thead><tr>'+cols.map(x=>'<th scope="col">'+e(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const section=(title,meta,body)=>'<section><h2>'+e(title)+'</h2><p class="meta">'+e(meta)+'</p>'+body+'</section>';
const unavailable='<p class="empty">尚未取得有效報表，未以零值代替。</p>';
async function readKV(env,key,validate){try{const v=JSON.parse(await env.CATALOG_KV.get(key));if(!v)return null;return {...validate(v),collectedAt:v.collectedAt};}catch{return null;}}
const iso=v=>v.slice(0,4)+'-'+v.slice(4,6)+'-'+v.slice(6);
async function loadMetrics(env){
 const w=taipeiReportWindow(),period={start:iso(w.start),end:iso(w.end)};
 try{const rows=await env.METRICS_DB.prepare('SELECT day,page,event,provider,count FROM daily_metrics WHERE day>=? AND day<=? ORDER BY day,page LIMIT 20001').bind(period.start,period.end).all();return summarizeMetrics(rows.results,period);}catch{return null;}
}
function reportHtml({catalog,metrics,gsc,coupang,draft,guideCount}){
 const catalogSummary='<div class="grid">'+card('有效商品',catalog?fmt(catalog.uniqueProducts):'—','最近同步、依商品 ID 去重')+card('選購指南',fmt(guideCount),'目標 30 篇')+card('網站瀏覽',metrics?fmt(metrics.total.pageviews):'—','最近七個完整台灣日')+card('酷澎連結點擊',metrics?fmt(metrics.total.coupangClicks):'—','本站觀測事件，非官方點擊')+'</div>';
 const metricBody=metrics?'<div class="grid">'+card('商品點擊／瀏覽',pct(metrics.total.coupangClicks+metrics.total.shopeeClicks,metrics.total.pageviews),'事件比例，不是成交率')+card('蝦皮連結點擊',fmt(metrics.total.shopeeClicks))+'</div>'+table(['頁面','瀏覽','酷澎點擊','蝦皮點擊'],metrics.pages.map(p=>[e(p.page),fmt(p.pageviews),fmt(p.coupangClicks),fmt(p.shopeeClicks)])):unavailable;
 const gsBody=gsc?'<div class="grid">'+card('Google 曝光',fmt(gsc.total?.impressions))+card('Google 點擊',fmt(gsc.total?.clicks))+card('搜尋 CTR',pct(gsc.total?.clicks,gsc.total?.impressions))+card('平均排名',fmt(gsc.total?.position))+'</div><h3>可優化關鍵字（曝光 ≥10、排名 8–20）</h3>'+(gsc.opportunities.length?table(['搜尋詞','曝光','點擊','排名'],gsc.opportunities.map(p=>[e(p.query),fmt(p.impressions),fmt(p.clicks),fmt(p.position)])):'<p class="empty">目前沒有符合條件的關鍵字。</p>')+(gsc.possiblyTruncated?'<p>資料達回傳上限，可能不完整。</p>':''):unavailable;
 const csum=(kind,key)=>coupang.reports[kind].reduce((n,r)=>n+r[key],0);
 const cpBody=coupang?'<div class="grid">'+card('官方點擊',fmt(csum('clicks','click')))+card('官方訂單',fmt(csum('commission','order')))+card('官方取消',fmt(csum('commission','cancel')))+card('官方報表收益',fmt(csum('commission','commission')),'非已付款金額；幣別依平台帳務')+card('官方 GMV',fmt(csum('commission','gmv')))+card('訂單明細佣金',fmt(csum('orders','commission')))+card('取消明細佣金',fmt(csum('cancels','commission')),'保留負數')+card('新客訂單',fmt(csum('commission','firstPurchaseOrder')))+'</div>'+table(['日期','點擊','訂單','取消','GMV','收益'],coupang.reports.commission.map(r=>[e(r.date),fmt(r.click),fmt(r.order),fmt(r.cancel),fmt(r.gmv),fmt(r.commission)]))+'<p class="meta">收益彙總與訂單／取消明細分開呈現，不重複相加；不同來源及日期口徑不可直接當成精確成交漏斗。</p>':unavailable;
 const d=draft?.draft;const draftBody=d?.status==='needs-editor-review'&&d.guide?'<div class="notice">待編輯審核，不會自動上架。</div><h3>'+e(d.guide.title)+'</h3><p>'+e(d.guide.description)+'</p>'+d.guide.sections.map(([h,b])=>'<h4>'+e(h)+'</h4><p>'+e(b)+'</p>').join('')+'<h4>來源</h4><ul>'+d.guide.sources.map(([name,url])=>'<li>'+e(name)+' — '+e(url)+'</li>').join('')+'</ul><h4>待查核</h4><ul>'+d.reviewChecklist.map(x=>'<li>'+e(x)+'</li>').join('')+'</ul>':unavailable;
 const period=v=>v?v.period.start+' ～ '+v.period.end:'未同步';
 return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>營運管理｜選購研究室</title><style>body{margin:0;background:#f4f6f4;color:#21302a;font:15px/1.65 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:20px}h1{font-size:26px;margin:0}h2{font-size:20px;margin:0}h3{font-size:17px}h4{margin-bottom:4px}p{margin:6px 0;overflow-wrap:anywhere}.meta,small{color:#56665e;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:12px 0}.kpi{background:white;border:1px solid #d9e2dc;border-radius:12px;padding:12px;min-width:0}.kpi strong{display:block;font-size:26px;overflow-wrap:anywhere;color:#17624c}.kpi p{font-size:12px;color:#56665e}section{background:white;border:1px solid #d9e2dc;border-radius:14px;padding:16px;margin:16px 0}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}th,td{padding:9px;border-bottom:1px solid #e4ebe5;white-space:nowrap}th{color:#56665e;font-weight:600}.notice,.empty{padding:10px;background:#f0f5ef;border-radius:8px}.notice{color:#805719}a{color:#17624c}@media(max-width:440px){main{padding:12px}.grid{grid-template-columns:1fr 1fr}section{padding:12px}.kpi strong{font-size:22px}}</style></head><body><main><header><h1>營運管理</h1><p class="meta">選購研究室 · 管理員專屬 · 即時讀取私有彙總</p><a href="/">返回網站</a></header>'+catalogSummary+section('站內購物轉換',period(metrics)+'｜台灣日、匿名事件',metricBody)+section('Google Search Console',period(gsc)+'｜Pacific 日、最終數據 · 同步 '+(gsc?.collectedAt??'—'),gsBody)+section('酷澎官方業績',period(coupang)+'｜'+(coupang?.scope==='configured-subId'?'指定頻道':'全帳號（非本站獨立收益）')+' · 同步 '+(coupang?.collectedAt??'—'),cpBody)+section('AI 內容待審稿','同步 '+(draft?.collectedAt??'—'),draftBody)+'</main></body></html>';
}
export async function adminPage(request,env,guides,{verify=authorizeAdmin}={}){
 const u=new URL(request.url);
 if(u.origin!=='https://hicrewapps.com'||!['/admin','/admin/'].includes(u.pathname)||!['GET','HEAD'].includes(request.method))return new Response('Not found',{status:404,headers});
 if(!await verify(request.headers.get('Cf-Access-Jwt-Assertion'),env))return new Response('Forbidden',{status:403,headers});
 if(request.method==='HEAD')return new Response(null,{headers});
 const [snapshot,metrics,gsc,coupang,draft]=await Promise.all([readCatalog(env),loadMetrics(env),readKV(env,'private-gsc-v1',validateGsc),readKV(env,'private-coupang-report-v1',validateCoupangReport),readKV(env,'private-editorial-draft-v1',v=>{if(v.version!==1||v.draft?.status!=='needs-editor-review'||!Array.isArray(v.draft.guide?.sections)||!Array.isArray(v.draft.guide?.sources)||!Array.isArray(v.draft.reviewChecklist))throw Error('Invalid draft');return {draft:v.draft};})]);
 return new Response(reportHtml({catalog:snapshot?catalogCounts(snapshot):null,metrics,gsc,coupang,draft,guideCount:guides.length}),{headers});
}
