export async function verifyPublished(snapshot,{fetchImpl=fetch,delayImpl=ms=>new Promise(r=>setTimeout(r,ms)),attempts=12}={}){
  const origin='https://hicrewapps.com',endpoint=origin+'/api/catalog';
  const guide=Object.entries(snapshot.guides).find(([,rows])=>rows.length)?.[0];
  const category=snapshot.categories.find(c=>c.products.length)?.categoryId;
  const expected=[['/','id="daily-deals"'],['/deals/','每日特價'],...(category?[['/categories/'+category+'/','catalog-grid']]:[]),...(guide?[['/guides/'+guide+'/','相關商品搜尋結果']]:[])];
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const response=await fetchImpl(endpoint,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
      const status=await response.json();
      if(response.ok&&status.ready===true&&Date.parse(status.fetchedAt)>=Date.parse(snapshot.fetchedAt)){
        const pages=await Promise.all(expected.map(async ([path,marker])=>{
          const response=await fetchImpl(origin+path,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Cache-Control':'no-cache'}});
          const html=await response.text();
          return response.ok&&html.includes(marker)&&html.includes('rel="sponsored nofollow noopener noreferrer"')&&html.includes('catalog-card')&&html.includes('NT$');
        }));
        if(pages.every(Boolean))return expected.length;
      }
    }catch{}
    if(attempt+1<attempts)await delayImpl(10000);
  }
  throw Error('Public page verification failed');
}
