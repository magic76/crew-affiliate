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
