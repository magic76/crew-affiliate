import {guideOffers} from './catalog-model.mjs';
import {catalogCounts} from './catalog-search.mjs';
export async function verifyPublished(snapshot,{fetchImpl=fetch,delayImpl=ms=>new Promise(r=>setTimeout(r,ms)),attempts=12}={}){
  const origin='https://hicrewapps.com',endpoint=origin+'/api/catalog';
  const guides=Object.keys(snapshot.guides).filter(slug=>guideOffers(snapshot,slug).length);
  const category=snapshot.categories.find(c=>c.products.length)?.categoryId;
  const count=catalogCounts(snapshot).uniqueProducts;
  const expected=[['/search/',`找到 <strong>${count}</strong> 筆商品`],['/','id="daily-deals"'],['/deals/','每日特價'],...(category?[['/categories/'+category+'/','catalog-grid']]:[]),...guides.map(slug=>['/guides/'+slug+'/','id="guide-products"'])];
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const response=await fetchImpl(endpoint,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
      const status=await response.json();
      if(response.ok&&status.ready===true&&status.counts?.uniqueProducts===count&&Date.parse(status.fetchedAt)>=Date.parse(snapshot.fetchedAt)){
        const pages=[];
        for(let i=0;i<expected.length;i+=5)pages.push(...await Promise.all(expected.slice(i,i+5).map(async ([path,marker])=>{
          const response=await fetchImpl(origin+path,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
          const html=await response.text();
          return response.ok&&html.includes(marker)&&html.includes('rel="sponsored nofollow noopener noreferrer"')&&html.includes('catalog-card')&&html.includes('NT$')&&(!path.startsWith('/guides/')||(html.includes('data-product-image')&&html.includes('assets/product-image.js')));
        })));
        if(pages.every(Boolean))return expected.length;
        console.warn(JSON.stringify({readbackMissing:expected.filter((_,i)=>!pages[i]).map(([path])=>path)}));
      }else console.warn(JSON.stringify({readbackReady:status.ready===true,countMatches:status.counts?.uniqueProducts===count,fresh:Date.parse(status.fetchedAt)>=Date.parse(snapshot.fetchedAt)}));
    }catch{console.warn('Catalog readback request failed');}
    if(attempt+1<attempts)await delayImpl(10000);
  }
  throw Error('Public page verification failed');
}
