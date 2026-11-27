import {parseFilters,searchCatalog} from './catalog-search.mjs';
export function comparison(catalog,params=new URLSearchParams()){
 const pool=searchCatalog(catalog,parseFilters());
 const byId=new Map(pool.map(p=>[p.productId,p]));
 const requested=[...new Set(params.getAll('id').filter(id=>/^[1-9]\d{0,15}$/.test(id)))].slice(0,3);
 const selected=requested.map(id=>byId.get(id)).filter(Boolean);
 return {pool,selected,missing:requested.length-selected.length};
}
export function compareMarkup(catalog,params,e,note){
 const {pool,selected,missing}=comparison(catalog,params);
 const price=p=>'NT$ '+new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(p.productPrice);
 let html='<section class="catalog-page"><a class="back" href="../search/index.html">← 商品探索</a><h1>商品比較</h1><p>選擇兩至三件商品，比對本站最近同步的酷澎價格、分類及配送。</p>';
 if(!catalog)return html+'<p class="search-empty" role="status">商品資料暫未同步，請稍後再試。</p></section>';
 html+=note+'<form class="shopping-search search-filters" action="index.html" method="get"><div class="compare-selects">';
 for(let i=0;i<3;i++){
  html+='<label>商品 '+(i+1)+'<select name="id"><option value="">選擇商品</option>'+pool.map(p=>'<option value="'+e(p.productId)+'"'+(selected[i]?.productId===p.productId?' selected':'')+'>'+e(p.productName+' · '+price(p))+'</option>').join('')+'</select></label>';
 }
 html+='</div><div class="filter-actions"><button class="primary" type="submit">開始比較</button><a href="index.html">清除選擇</a></div></form>';
 if(missing)html+='<p role="status">部分商品已不在最新快照，請重新選擇。</p>';
 if(selected.length<2)return html+'<p class="search-empty">請選擇至少兩件不同商品。</p></section>';
 const row=(label,cell)=>'<tr><th scope="row">'+label+'</th>'+selected.map(p=>'<td>'+cell(p)+'</td>').join('')+'</tr>';
 html+='<div class="compare-scroll" role="region" tabindex="0" aria-label="商品比較表"><table class="guide-table compare-table"><thead><tr><th scope="col">比較項目</th>'+selected.map((p,i)=>'<th scope="col">商品 '+(i+1)+'<img data-product-image src="'+e(p.productImage)+'" alt="" width="100" height="100" loading="lazy" referrerpolicy="no-referrer"><span>'+e(p.productName)+'</span></th>').join('')+'</tr></thead><tbody>';
 html+=row('目前價格',p=>'<strong>'+e(price(p))+'</strong>'+(p.productPrice===Math.min(...selected.map(x=>x.productPrice))?'<small>所選商品中價格最低</small>':''));
 html+=row('配送',p=>p.isRocket?'火箭配送':'未標示火箭配送');
 html+=row('分類',p=>e(p.categoryName||'未提供'));
 html+=row('購買連結',p=>'<a class="primary" href="'+e(p.productUrl)+'" rel="sponsored nofollow noopener noreferrer" target="_blank">查看酷澎最新價格 ↗</a>');
 return html+'</tbody></table></div><p class="note">價差不代表規格或品質差異；商品可能有不同容量、組合、運費及優惠條件，請前往賣場確認。</p></section>';
}
