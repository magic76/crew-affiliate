// Search only the fresh published snapshot, never issue upstream calls per visitor.
const fold=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('zh-TW').trim();
const money=value=>{if(value===null||value===undefined||value===''||!/^\d{1,7}(?:\.\d{1,2})?$/.test(value))return null;return Number(value);};
export function parseFilters(params=new URLSearchParams()){
 const q=String(params.get('q')??'').trim().slice(0,80);
 const source=String(params.get('category')??'');
 const category=source==='deals'||/^[1-9]\d{0,15}$/.test(source)?source:'';
 const min=money(params.get('min')),max=money(params.get('max'));
 const sort=['price-asc','price-desc'].includes(params.get('sort'))?params.get('sort'):'default';
 return {q,category,min,max,sort,rocket:params.get('rocket')==='1',invalidBudget:min!==null&&max!==null&&min>max};
}
export function searchCatalog(catalog,filters){
 if(!catalog||filters.invalidBudget)return [];
 const pool=filters.category==='deals'?catalog.deals:filters.category?catalog.categories.find(c=>c.categoryId===filters.category)?.products??[]:[...catalog.deals,...catalog.categories.flatMap(c=>c.products),...Object.values(catalog.guides).flat(),...(catalog.expanded??[])];
 const seen=new Set(),terms=fold(filters.q).split(/\s+/).filter(Boolean);
 const results=pool.filter(p=>{
  if(seen.has(p.productId))return false;seen.add(p.productId);
  const hay=fold(p.productName+' '+p.categoryName);
  return terms.every(term=>hay.includes(term))&&(filters.min===null||p.productPrice>=filters.min)&&(filters.max===null||p.productPrice<=filters.max)&&(!filters.rocket||p.isRocket);
 });
 if(filters.sort!=='default')results.sort((a,b)=>filters.sort==='price-asc'?a.productPrice-b.productPrice:b.productPrice-a.productPrice);
 return results;
}

// Count validated source occurrences separately from the actual unique searchable pool.
export function catalogCounts(catalog){
 if(!catalog)return {deals:0,categoryProducts:0,guideProducts:0,keywordProducts:0,sourceRows:0,uniqueProducts:0,duplicateRows:0};
 const deals=catalog.deals.length,categoryProducts=catalog.categories.reduce((n,c)=>n+c.products.length,0),guideProducts=Object.values(catalog.guides).reduce((n,rows)=>n+rows.length,0),keywordProducts=(catalog.expanded??[]).length,sourceRows=deals+categoryProducts+guideProducts+keywordProducts,uniqueProducts=searchCatalog(catalog,parseFilters()).length;
 return {deals,categoryProducts,guideProducts,keywordProducts,sourceRows,uniqueProducts,duplicateRows:sourceRows-uniqueProducts};
}
