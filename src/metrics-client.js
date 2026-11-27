(()=>{if(location.origin!=='https://hicrewapps.com'||navigator.globalPrivacyControl===true||navigator.doNotTrack==='1'||window.doNotTrack==='1')return;
const send=(event,provider='')=>{try{fetch('/api/metrics',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,body:JSON.stringify({page:location.pathname,event,provider})}).catch(()=>{});}catch{}};
let viewed=false;const view=()=>{if(!viewed&&document.visibilityState==='visible'&&!document.prerendering){viewed=true;send('pageview');}};
document.addEventListener('visibilitychange',view);document.addEventListener('prerenderingchange',view);view();
const click=e=>{if(!e.isTrusted||(e.type==='auxclick'&&e.button!==1)||(e.type==='click'&&e.button!==0))return;const a=e.target instanceof Element?e.target.closest('a[rel~="sponsored"]'):null;if(!a)return;try{const host=new URL(a.href).hostname;const provider=['coupa.ng','link.tw.coupang.com','coupang.onelink.me'].includes(host)?'coupang':['s.shopee.tw','shope.ee','shopee.tw'].includes(host)?'shopee':null;if(provider)send('affiliate_click',provider);}catch{}};
document.addEventListener('click',click);document.addEventListener('auxclick',click);
})();
