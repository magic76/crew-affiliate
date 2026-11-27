import {unitPrice,MODES} from './unit-price-model.js';
const form=document.querySelector('#unit-price');
const fmt=n=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:4}).format(n);
function calc(){
 const [label,unit,scale]=MODES[form.elements.mode.value];
 document.querySelectorAll('[data-unit]').forEach(x=>x.textContent=unit);
 for(const id of ['A','B'])form.elements[id+'quantity'].step=scale===1?'1':'0.01';
 const status=document.querySelector('#unit-result');
 const ids=['A','B'];const values=ids.map(id=>unitPrice(...['price','shipping','packs','quantity'].map(key=>form.elements[id+key].valueAsNumber),scale));
 if(!form.checkValidity()||values.some(x=>!x)){ids.forEach(id=>document.querySelector('#unit-'+id).textContent='');status.textContent='請輸入有效的非負金額及正數數量。';return;}
 values.forEach((v,i)=>document.querySelector('#unit-'+ids[i]).textContent=label+' NT$ '+fmt(v.per));
 const [a,b]=values;
 if(Math.abs(a.per-b.per)<1e-10)status.textContent='兩組單位價格相同。';
 else {const low=a.per<b.per?'A':'B';const saving=(1-Math.min(a.per,b.per)/Math.max(a.per,b.per))*100;status.textContent='商品 '+low+' 的單位成本較低，約省 '+fmt(saving)+'%。';}
}
form.addEventListener('input',calc);form.addEventListener('submit',e=>{e.preventDefault();calc()});calc();
