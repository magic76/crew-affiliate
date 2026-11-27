import {sign,PRODUCT_PATHS} from '../scripts/coupang-smoke.mjs';
const ORIGIN='https://api-gateway.tw.coupang.com';
import {GUIDE_QUERIES,products,categories,SHOPPING_KEYWORDS,MAX_EXPANDED_PRODUCTS} from './catalog-model.mjs';
export {GUIDE_QUERIES,products,categories,normalizeProduct,normalizeCategory,validateCatalog} from './catalog-model.mjs';
export async function fetchRows({path,query='',accessKey,secretKey,fetchImpl=fetch}){
  const auth=sign({accessKey,secretKey,path,query,method:'GET'});
  const res=await fetchImpl(ORIGIN+path+(query?'?'+query:''),{headers:{Authorization:auth,Accept:'application/json'},method:'GET',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Object.assign(new Error('Catalog request failed: '+res.status),{httpStatus:res.status});
  const body=await res.json();
  if(String(body?.rCode)!=='0')throw Object.assign(new Error('Catalog API rejected request'),{apiRejected:true});
  const rows=Array.isArray(body.data)?body.data:body.data?.productData;
  if(!Array.isArray(rows))throw new Error('Unknown catalog response shape');
  return rows;
}
export async function syncCatalog({accessKey,secretKey,fetchImpl=fetch,now=new Date(),expand=true,delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
  const request=(path,query='')=>fetchRows({path,query,accessKey,secretKey,fetchImpl});
  const [rawDeals,rawCategories]=await Promise.all([request(PRODUCT_PATHS.goldbox),request(PRODUCT_PATHS.hotcategories)]);
  const rawGuides=[];
  for(const g of Object.values(GUIDE_QUERIES)){
    if(expand)await delay(2000);
    rawGuides.push(await request(PRODUCT_PATHS.search,'keyword='+encodeURIComponent(g.keyword)+'&limit=5'));
  }
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
      if(expand)await delay(2000);
      const rows=await request(PRODUCT_PATHS.search,'keyword=USB-C&limit=5');
      const usable=products(rows);
      fallback={returned:rows.length,usable:usable.length};
      for(const [slug,g] of entries){if(!guides[slug].length)guides[slug]=usable.filter(p=>g.match.test(p.productName));}
    }catch{fallback={unavailable:true};}
  }
  const pool=[...deals,...categoryResults.flatMap(c=>c.products),...Object.values(guides).flat()];
  const seen=new Set(pool.map(p=>p.productId)),expanded=[];
  const diagnostic={keywordRequests:0,bestCategoryRequests:0,keywordLimit:10,returned:0,added:0,failed:0,rateLimited:false};
  const add=rows=>{diagnostic.returned+=rows.length;for(const p of products(rows,30)){if(!seen.has(p.productId)&&expanded.length<MAX_EXPANDED_PRODUCTS){seen.add(p.productId);expanded.push(p);}}};
  if(expand){
    // Probe the existing search parameter with a modest limit=10. Fall back only on explicit parameter/API rejection, never on rate limit or auth errors.
    for(const [i,keyword] of SHOPPING_KEYWORDS.entries()){
      if(diagnostic.rateLimited||seen.size>=600)break;
      await delay(2000);
      try{
        diagnostic.keywordRequests++;
        add(await request(PRODUCT_PATHS.search,'keyword='+encodeURIComponent(keyword)+'&limit='+diagnostic.keywordLimit));
      }catch(error){
        diagnostic.failed++;
        if(error.httpStatus===429||error.httpStatus===401||error.httpStatus===403){diagnostic.rateLimited=true;break;}
        if(i===0&&(error.httpStatus===400||error.apiRejected))diagnostic.keywordLimit=5;
      }
    }
    // Documented bestcategories endpoint; no undocumented query parameters. Only needed if keyword expansion misses target.
    if(!diagnostic.rateLimited&&seen.size<501)for(const c of cats){
      await delay(2000);
      try{diagnostic.bestCategoryRequests++;add(await request(PRODUCT_PATHS.hotcategories.replace('/hotcategories','/bestcategories')+'/'+c.categoryId));}
      catch(error){diagnostic.failed++;if([429,401,403].includes(error.httpStatus)){diagnostic.rateLimited=true;break;}}
      if(seen.size>=600)break;
    }
  }
  diagnostic.added=expanded.length;
  return {version:1,fetchedAt:now.toISOString(),deals,categories:categoryResults,guides,expanded,expansion:diagnostic,guideDiagnostics,fallback};
}
