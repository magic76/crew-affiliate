export const SHOPPING_KEYWORDS=Object.freeze(["65W GaN 充電器","100W 充電器","45W PPS 充電器","20W USB C 充電器","100W USB C 充電線","240W USB C 充電線","行動電源 10000mAh","行動電源 20000mAh","USB C 集線器","HDMI 傳輸線","無線滑鼠","無線鍵盤","筆電支架","手機支架","旅行轉接頭","延長線","抽取式衛生紙 箱購","捲筒衛生紙","廚房紙巾","濕紙巾","嬰兒尿布 L","嬰兒尿布 M","嬰兒拉拉褲","濃縮洗衣精","洗衣膠囊","洗衣精 補充包","洗碗精","洗碗機 清潔錠","垃圾袋","保鮮袋","保鮮盒","洗碗海綿","除濕盒","衣架","收納箱","牙刷","牙膏","電動牙刷 替換刷頭","保溫瓶","濾水壺 濾芯"]);
export const MAX_EXPANDED_PRODUCTS=850;
export const GUIDE_QUERIES=Object.freeze({
  'usb-c-phone-charger':{keyword:'USB-C 充電器',match:/充電器|充電頭|charger/i},
  'usb-c-cable-60w-100w':{keyword:'USB-C 充電線',match:/充電線|傳輸線|線材|cable/i},
  'travel-multiport-charger':{keyword:'多孔 充電器',match:/(?=.*(?:充電器|充電頭|charger))(?=.*(?:多孔|雙孔|三孔|四孔|[2345]\s*(?:孔|port)|[234]C[123]?A?))/i}
  ,'tissue-unit-price':{keyword:'抽取式衛生紙',match:/衛生紙/i},
  'diaper-unit-price':{keyword:'嬰兒尿布',match:/(?=.*(?:尿布|紙尿褲|拉拉褲))(?!(?:.*(?:成人|寵物|看護|尿布墊|尿布台|尿布袋)))/i},
  'galaxy-pps-charger':{keyword:'45W PPS 充電器',match:/(?=.*45\s*w)(?=.*(?:充電器|充電頭|charger))/i},
  'power-bank-capacity':{keyword:'行動電源',match:/行動電源|power bank/i},
  'usb-c-hub-hdmi':{keyword:'USB C 集線器',match:/集線器|擴充基座|hub|多功能轉接/i},
  'kitchen-paper-unit-price':{keyword:'廚房紙巾',match:/廚房紙巾|廚房用紙/i},
  'detergent-unit-price':{keyword:'洗衣精',match:/(?=.*洗衣精)(?!.*(?:空瓶|洗衣精瓶|洗衣精收納))/i}
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
  const expanded=products(Array.isArray(snapshot.expanded)?snapshot.expanded:[],MAX_EXPANDED_PRODUCTS);
  return {version:1,fetchedAt:new Date(fetched).toISOString(),deals,categories:cats,guides,expanded};
}
