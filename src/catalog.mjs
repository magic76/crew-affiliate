import {sign,PRODUCT_PATHS} from '../scripts/coupang-smoke.mjs';
const ORIGIN='https://api-gateway.tw.coupang.com';
import {GUIDE_QUERIES,products,categories} from './catalog-model.mjs';
export {GUIDE_QUERIES,products,categories,normalizeProduct,normalizeCategory,validateCatalog} from './catalog-model.mjs';
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
