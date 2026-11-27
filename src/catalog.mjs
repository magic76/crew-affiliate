import {sign,PRODUCT_PATHS} from '../scripts/coupang-smoke.mjs';
const ORIGIN='https://api-gateway.tw.coupang.com';
export const GUIDE_QUERIES=Object.freeze({
  'usb-c-phone-charger':{keyword:'USB-C 充電器',match:/充電器|充電頭|charger/i},
  'usb-c-cable-60w-100w':{keyword:'USB-C 充電線',match:/充電線|傳輸線|線材|cable/i},
  'travel-multiport-charger':{keyword:'多孔 充電器',match:/(?=.*(?:充電器|充電頭|charger))(?=.*(?:多孔|雙孔|三孔|四孔|[2345]\s*(?:孔|port)|[234]C[123]?A?))/i}
});
const id=v=>(typeof v==='string'||Number.isSafeInteger(v))&&/^[1-9]\d{0,15}$/.test(String(v))?String(v):null;
const name=v=>typeof v==='string'&&v.trim().length>0&&v.length<=200?v.trim():null;
function safeUrl(value,kind){
  if(typeof value!=='string'||value.length>4096||/[\s\\<>"]/.test(value))return null;
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
    const host=u.hostname;
    const valid=kind==='image'?(host==='ads-partners.tw.coupang.com'||host==='coupangcdn.com'||host.endsWith('.coupangcdn.com')):['coupa.ng','link.tw.coupang.com','coupang.onelink.me'].includes(host);
    return valid?u.href:null;
  }catch{return null;}
}
export function normalizeProduct(p){
  if(!p||typeof p!=='object')return null;
  const productId=id(p.productId),productName=name(p.productName),productImage=safeUrl(p.productImage,'image'),productUrl=safeUrl(p.productUrl,'link');
  if(!productId||!productName||!productImage||!productUrl||!Number.isFinite(p.productPrice)||p.productPrice<0)return null;
  return {productId,productName,productImage,productUrl,productPrice:p.productPrice,categoryName:name(p.categoryName)||'',isRocket:p.isRocket===true};
}
export function normalizeCategory(c){
  const categoryId=id(c?.categoryId),categoryName=name(c?.categoryName);
  return categoryId&&categoryName?{categoryId,categoryName}:null;
}
function unique(rows,normalize,key,max){
  const seen=new Set(),result=[];
  for(const row of rows){const value=normalize(row);if(!value||seen.has(value[key]))continue;seen.add(value[key]);result.push(value);if(result.length===max)break;}
  return result;
}
export function products(rows,max=30){return unique(rows,normalizeProduct,'productId',max);}
export function categories(rows){return unique(rows,normalizeCategory,'categoryId',10);}
export async function fetchRows({path,query='',accessKey,secretKey,fetchImpl=fetch}){
  const auth=sign({accessKey,secretKey,path,query,method:'GET'});
  const res=await fetchImpl(ORIGIN+path+(query?'?'+query:''),{headers:{Authorization:auth,Accept:'application/json'},method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new Error('Catalog request failed: '+res.status);
  const body=await res.json();
  if(String(body?.rCode)!=='0')throw new Error('Catalog API rejected request');
  const rows=Array.isArray(body.data)?body.data:body.data?.productData;
  if(!Array.isArray(rows))throw new Error('Unknown catalog response shape');
  return rows;
}
export async function syncCatalog({accessKey,secretKey,fetchImpl=fetch,now=new Date()}){
  const request=(path,query='')=>fetchRows({path,query,accessKey,secretKey,fetchImpl});
  const [rawDeals,rawCategories,...rawGuides]=await Promise.all([
    request(PRODUCT_PATHS.goldbox),request(PRODUCT_PATHS.hotcategories),
    ...Object.values(GUIDE_QUERIES).map(g=>request(PRODUCT_PATHS.search,'keyword='+encodeURIComponent(g.keyword)+'&limit=5'))
  ]);
  const deals=products(rawDeals),cats=categories(rawCategories);
  if(!deals.length||!cats.length)throw new Error('No usable deals or categories; refuse replacement');
  const categoryResults=[];
  // Bound concurrency to three. Category detail endpoint confirmed in Document; no undocumented query parameters.
  for(let i=0;i<cats.length;i+=3){
    const batch=await Promise.all(cats.slice(i,i+3).map(async c=>{
      try{return {...c,products:products(await request(PRODUCT_PATHS.hotcategories+'/'+c.categoryId)),available:true};}
      catch{return {...c,products:[],available:false};}
    }));
    categoryResults.push(...batch);
  }
  const entries=Object.entries(GUIDE_QUERIES);
  const guides=Object.fromEntries(entries.map(([slug,g],i)=>[slug,products(rawGuides[i]).filter(p=>g.match.test(p.productName))]));
  const guideDiagnostics=Object.fromEntries(entries.map(([slug],i)=>[slug,{returned:rawGuides[i].length,usable:products(rawGuides[i]).length,matched:guides[slug].length}]));
  let fallback=null;
  if(entries.some(([slug])=>guides[slug].length===0)){
    // One bounded fallback using the previously verified broad search keyword.
    try{
      const rows=await request(PRODUCT_PATHS.search,'keyword=USB-C&limit=5');
      const usable=products(rows);
      fallback={returned:rows.length,usable:usable.length};
      for(const [slug,g] of entries){if(!guides[slug].length)guides[slug]=usable.filter(p=>g.match.test(p.productName));}
    }catch{fallback={unavailable:true};}
  }
  return {version:1,fetchedAt:now.toISOString(),deals,categories:categoryResults,guides,guideDiagnostics,fallback};
}
export function validateCatalog(snapshot,now=new Date()){
  const fetched=Date.parse(snapshot?.fetchedAt);
  // Conservative preview freshness guard, not a statement of platform-approved retention.
  if(snapshot?.version!==1||!Number.isFinite(fetched)||fetched>now.getTime()+60000||now.getTime()-fetched>3600000)throw new Error('Catalog missing, expired, or invalid');
  if(!Array.isArray(snapshot.deals)||!Array.isArray(snapshot.categories)||!snapshot.guides||typeof snapshot.guides!=='object')throw new Error('Invalid catalog shape');
  const deals=products(snapshot.deals);
  const cats=categories(snapshot.categories).map(c=>{
    const row=snapshot.categories.find(v=>String(v.categoryId)===c.categoryId);
    return {...c,available:row.available===true,products:row.available===true&&Array.isArray(row.products)?products(row.products):[]};
  });
  if(!deals.length||!cats.length)throw new Error('Empty catalog');
  const guides=Object.fromEntries(Object.entries(GUIDE_QUERIES).map(([slug,g])=>[slug,products(Array.isArray(snapshot.guides[slug])?snapshot.guides[slug]:[]).filter(p=>g.match.test(p.productName))]));
  return {version:1,fetchedAt:new Date(fetched).toISOString(),deals,categories:cats,guides};
}
